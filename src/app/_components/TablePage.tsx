'use client';

import { api } from '~/trpc/react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useRef, useEffect, useState } from 'react';
import React from 'react';
import { useDebounce } from 'use-debounce';
import type { Column, TableView } from '@prisma/client';
import type { ViewConfig } from '~/server/api/routers/table';
import GlobalFilterPopover from '~/app/_components/GlobalFilterPopover';
import GlobalSortPopover from './GlobalSortPopover';
import GlobalColVisibilityPopover from '~/app/_components/GlobalColVisibilityPopover';
import { createPortal } from 'react-dom';
import { Dialog } from '@headlessui/react';
import TopBar from '~/app/_components/TopBar';
import isEqual from 'lodash.isequal';
import { Menu } from '@headlessui/react';
import GlobalSortEditor from './GlobalSortEditor';
import AddFieldPopover from '~/app/_components/AddFieldPopover';
import AddFieldConfigurePanel from '~/app/_components/AddFieldConfigurePanel';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';

type TableRow = {
  id: string;
  [key: string]: string | number;
};

type FilterCondition = {
  field: string;
  type: 'TEXT' | 'NUMBER';
  op: string;
  value: string | number | null;
};


function isViewConfig(config: unknown): config is ViewConfig {
  return typeof config === 'object' && config !== null && 'filters' in config;
}

type FieldType = 'TEXT' | 'NUMBER';

function nextAutoName(type: FieldType, existingLower: Set<string>) {
  const base = type === 'NUMBER' ? 'number' : 'label';
  let i = 1;
  while (existingLower.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}


export default function TablePage({ tableId }: { tableId: string }) {
  const [rowCount, setRowCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sort, setSort] = useState<{ columnId: string; order: "asc" | "desc" }[]>([]);
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [debouncedFilters] = useDebounce(filters, 500);
  const [debouncedSort] = useDebounce(sort, 500);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  const [pendingFieldType, setPendingFieldType] = useState<
    'TEXT' | 'NUMBER'
    | null
  >(null);
  const [pendingFieldName, setPendingFieldName] = useState("");

  const { data: views } = api.table.getViews.useQuery({ tableId });
  const [selectedView, setSelectedView] = useState<TableView | null>(null);
  // optimistic "new row" placeholders so UI updates instantly
  const [optimisticRows, setOptimisticRows] = useState<TableRow[]>([]);
  // Columns being optimistically removed from the UI while the backend deletes them
  const [pendingDeleteCols, setPendingDeleteCols] = useState<Set<string>>(new Set());


  function makeBlankOptimisticRow(): TableRow {
    const vals: Record<string, string | number> = {};
    for (const c of (table?.columns ?? [])) vals[c.id] = '';
    const tmpId = `__optimistic__${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { id: tmpId, ...vals };
  }

  useEffect(() => {
    if (!selectedView && Array.isArray(views) && views.length > 0) {
      const defaultGridView = views.find((v) => v.name === "Grid view") ?? views[0];
      if (defaultGridView) {
        handleSelectView(defaultGridView);
      }
    }
  }, [views, selectedView]);

  useEffect(() => {
    if (selectedView) saveCurrentViewConfig(); // 🛠️ auto-save whenever debounced state changes
    }, [debouncedSearch, debouncedFilters, debouncedSort, columnVisibility]);


  
  const [viewName, setViewName] = useState("");
//   const [sortConfig, setSortConfig] = useState<{ columnId: string; order: "asc" | "desc" } | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<typeof sort>([]);
  const [viewSavedMessage, setViewSavedMessage] = useState<string | null>(null);



  const [addingRows, setAddingRows] = useState(false);

  // const { data: table, isLoading, refetch } = api.table.getTableById.useQuery({ tableId });
  const { data: table, isLoading, refetch: refetchTable } = api.table.getTableById.useQuery({ tableId }, {
    refetchOnWindowFocus: false, // prevents double-fetching
  });
  const [rowCache, setRowCache] = useState<Record<number, TableRow>>({});

  const [isViewTypeOpen, setIsViewTypeOpen] = useState(false);
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [newViewType, setNewViewType] = useState<'grid' | null>(null);

  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  
  const parentRef = useRef<HTMLDivElement>(null);

  
  const virtualizer = useVirtualizer({
    count: rowCount, // can be approximate or fetched separately
    getScrollElement: () => parentRef.current,
    estimateSize: () => 47,
    overscan: 100,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const start = virtualItems[0]?.index ?? 0;
  const end = virtualItems.at(-1)?.index ?? 0;
  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  const [showColumnPopover, setShowColumnPopover] = useState(false);
  const columnPopoverRef = useRef<HTMLDivElement>(null);

  const [localEdits, setLocalEdits] = useState<Map<string, Map<string, string>>>(new Map());
  // Cells currently saving in the background (purely for UI; doesn't block typing)
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());

  function saveCell(rowId: string, columnId: string, value: string) {
    const key = `${rowId}__${columnId}`;

    // Optimistic overlay: user sees value immediately
    setLocalEdits(prev => {
      const copy = new Map(prev);
      const rowMap = new Map(copy.get(rowId) ?? []);
      rowMap.set(columnId, value);
      copy.set(rowId, rowMap);
      return copy;
    });

    // Background save (non-blocking, allows parallel edits)
    setPendingCells(prev => new Set(prev).add(key));
    updateCell.mutate(
      { tableId, rowId, columnId, value },
      {
        onSettled: () => {
          // remove "pending" dot
          setPendingCells(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        },
        onError: (err) => {
          // Optional: roll back overlay or mark error
          console.error('Save failed', err);
          // Example rollback (comment out if you prefer to keep the optimistic value):
          // setLocalEdits(prev => {
          //   const copy = new Map(prev);
          //   const rowMap = new Map(copy.get(rowId) ?? []);
          //   rowMap.delete(columnId);
          //   if (rowMap.size) copy.set(rowId, rowMap); else copy.delete(rowId);
          //   return copy;
          // });
          alert('Failed to save cell. The value you typed is still visible.');
        },
      }
    );
  }

  
  const [showSortEditor, setShowSortEditor] = useState(false);
  
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  // Airtable-style column editor
  const [editName, setEditName] = useState('');
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null);


  type UICol =
    | (Column & { isOptimistic?: false })
    | { id: string; name: string; type: FieldType; isOptimistic: true };

  const [optimisticCols, setOptimisticCols] = useState<UICol[]>([]);
  const [optimisticColNames, setOptimisticColNames] = useState<Record<string, string>>({});


  // Server cols + optimistic placeholders shown immediately
  const uiColumns = useMemo<UICol[]>(
    () => {
      const base = (table?.columns ?? []).filter(c => !pendingDeleteCols.has(c.id));
      return [...base, ...optimisticCols];
    },
    [table, optimisticCols, pendingDeleteCols]
  );



  const updateCell = api.table.updateCell.useMutation();
  const [addFieldStep, setAddFieldStep] = useState<null | 'choose' | 'configure'>(null);
  const addColumnAndPopulate = api.table.addColumnAndPopulate.useMutation({
    onSuccess: async () => {
      await refetchTable(); // updates column structure
      await utils.table.getRows.invalidate({ tableId }); // clear rows cache
      setRowCache({}); // reset client cache
    },
  });

  const renameColumn = api.table.renameColumn.useMutation({
    onSuccess: async () => {
      await refetchTable();
      await utils.table.getRows.invalidate({ tableId });
    },
  });

  const deleteColumn = api.table.deleteColumn.useMutation({
    onSuccess: async () => {
      await refetchTable();
      await utils.table.getRows.invalidate({ tableId });
      setRowCache({});
    },
  });

  const addRow = api.table.addRow.useMutation({
    onSuccess: async () => {
      await utils.table.getRows.invalidate({ tableId });
    },
  });

  const addFakeRows = api.table.addFakeRows.useMutation({
    onSuccess: async () => {
        console.log("✅ 100k rows added successfully");
        await utils.table.getTableById.invalidate({ tableId });
        await refetchTable(); // <-- ensure visible update
    },
    onError: (err) => {
        console.error("❌ Failed to add 100k rows:", err);
        alert("Error adding 100k rows: " + err.message);
    },
    });

  const utils = api.useUtils();

  const saveView = api.table.saveView.useMutation({
  onSuccess: async () => {
    setViewSavedMessage("✅ View saved successfully!");
    await utils.table.getViews.invalidate({ tableId });

    // Auto-hide the message after 3 seconds
    setTimeout(() => setViewSavedMessage(null), 3000);
  },
  onError: () => {
    setViewSavedMessage("❌ Failed to save view. Please try again.");
    setTimeout(() => setViewSavedMessage(null), 3000);
  }
});

const [hoveredView, setHoveredView] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        columnPopoverRef.current &&
        !columnPopoverRef.current.contains(e.target as Node)
      ) {
        setShowColumnPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const createView = api.table.createView.useMutation({
    onSuccess: async () => {
      await utils.table.getViews.invalidate({ tableId });
    },
    onError: (err) => {
      alert("Failed to create view: " + err.message);
    }
  });

  const viewTypeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isViewTypeOpen &&
        viewTypeRef.current &&
        !viewTypeRef.current.contains(event.target as Node)
      ) {
        setIsViewTypeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isViewTypeOpen]);


  function saveCurrentViewConfig() {

    const filtersAsObject: Record<string, any> = {};
    const config = {
      search: searchQuery,
      sort: sort,
      filters: filtersAsObject,
      hiddenColumns: Object.entries(columnVisibility)
        .filter(([, isVisible]) => !isVisible)
        .map(([colId]) => colId),
    };

    for (const f of filters) {
      if (f.field && f.op && (f.value !== "" && f.value !== null)) {
        filtersAsObject[f.field] = {
          type: f.type.toUpperCase() as 'TEXT' | 'NUMBER',
          op: f.op,
          value: f.value,
        };
      }
    }

    const currentConfig = selectedView?.config;
    if (isEqual(config, currentConfig)) return;

    saveView.mutate({
      tableId,
      name: selectedView?.name ?? 'default',
      config,
    });
  }


  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = api.table.getRows.useInfiniteQuery(
    {
      tableId,
      limit: 50,
      search: debouncedSearch,
      sort,
      filters,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
      staleTime: 30_000,         // serve cached pages for 30s
      gcTime: 5 * 60_000,        // keep them in memory for 5 minutes
    }
  );


  useEffect(() => {
  if (!data?.pages?.length) {
    setRowCount(optimisticRows.length + 1);
    return;
  }

  // Get all fetched rows from all pages
  const allRows = data.pages.flatMap((page) => page.rows);

  // Estimate row count (optional: make more precise if your backend returns total count separately)
  setRowCount(allRows.length + optimisticRows.length + 1);

  // Cache each row by its index (assumes order is consistent and stable)
  setRowCache((prev) => {
    const updated = { ...prev };
    allRows.forEach((row, i) => {
      updated[i] = {
        id: row.id,
        ...(typeof row.values === 'object' && row.values !== null
          ? (row.values as Record<string, string | number>)
          : {}),
      };
    });
    return updated;
  });
}, [data, optimisticRows]);


  useEffect(() => {
    const listener = (e: FocusEvent) => {
      console.log('🧠 blur:', e.target);
    };
    window.addEventListener('blur', listener, true);
    return () => window.removeEventListener('blur', listener, true);
  }, []);

  useEffect(() => {
    setColumnVisibility(prev => {
      const next = { ...prev };
      for (const c of uiColumns) {
        if (next[c.id] === undefined) next[c.id] = true;
      }
      return next;
    });
  }, [uiColumns]);


  
  

  function handleSelectView(view: TableView) {
    const config = view.config as ViewConfig;
    setSelectedView(view);
    setFilters(
      Array.isArray(config.filters)
        ? config.filters
        : Object.entries(config.filters ?? {}).map(([field, f]) => ({
            field,
            ...f,
            type: f.type.toUpperCase() as 'TEXT' | 'NUMBER',
          }))
    );
    setSort(Array.isArray(config.sort) ? config.sort : []);
    setSearchQuery(config.search ?? '');
    const hiddenCols = config.hiddenColumns ?? [];
    const visibility = Object.fromEntries(
      table?.columns.map((col) => [col.id, !hiddenCols.includes(col.id)]) ?? []
    );
    setColumnVisibility(visibility);
  }


  
  
  function getCellValue(rowId: string, columnId: string, defaultValue: string): string {
    const rowMap = localEdits.get(rowId);
    return rowMap?.get(columnId) ?? defaultValue;
  }


  const flatRows = useMemo<TableRow[]>(() => {
    const all = data?.pages.flatMap((page) =>
      page.rows.map((row) => ({
        id: row.id,
        ...(typeof row.values === 'object' && row.values !== null
          ? (row.values as Record<string, string | number>)
          : {}),
      }))
    ) ?? [];

    const seen = new Set();
      for (const row of all) {
        if (seen.has(row.id)) {
          console.warn("🚨 Duplicate row id found:", row.id);
        }
        seen.add(row.id);
      }

  return [...all, ...optimisticRows];
}, [data, optimisticRows]);
  
  console.log("DEBUG flatRows:", flatRows);

  
  const lastVirtualRow = [...virtualRows].reverse().find((vr) => vr.index < flatRows.length);
  const addRowY = lastVirtualRow ? lastVirtualRow.start + lastVirtualRow.size : totalHeight;

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
  if (!table) return [];

  const optimisticIdSet = new Set(optimisticCols.map(c => c.id));
  const colsForDefs = uiColumns; // use merged columns

  return colsForDefs.map((col: UICol, index: number) => ({
    accessorKey: col.id ?? `col-${index}`, // fallback ID
    size: 240,
    
    header: () => (
      <div className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100 rounded">
        <div className="flex items-center space-x-1 text-sm font-medium text-gray-700">
          <span className="truncate">
            {('isOptimistic' in col && col.isOptimistic)
              ? `${col.name} (creating…)`
              : (optimisticColNames[col.id] ?? col.name)}
          </span>

        </div>

        {('isOptimistic' in col && col.isOptimistic) ? (
          <span className="text-xs italic text-gray-400">New field…</span>
        ) : (

          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 text-sm cursor-pointer">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <use href="/icons/icon_definitions.svg#DotsThree" />
              </svg>
            </Menu.Button>
            <Menu.Items 
              className={`absolute ${index === 0 ? 'left-0' : 'right-0'} mt-1 w-56 origin-top-right overflow-hidden
                rounded-xl border border-gray-200 bg-white
                shadow-[0_12px_32px_rgba(16,24,40,0.12)] ring-1 ring-black/5
                focus:outline-none z-[999]`}>
              {/* caret */}
              <span
                aria-hidden
                className={`absolute -top-1.5 ${index === 0 ? 'left-3' : 'right-3'} h-3 w-3 rotate-45
                  bg-white border-l border-t border-gray-200`}
              />
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={(e) => {
                        setEditingColumn(col);
                        setEditName(col.name ?? '');
                        const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement | null;
                        const rect = th?.getBoundingClientRect();
                        if (rect) setEditAnchor(rect);
                      }}

                      className={`group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium
                        ${active ? 'bg-gray-50' : 'bg-white'} text-gray-800`}
                    >
                      <svg className="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100" viewBox="0 0 24 24">
                        <use href="/icons/icon_definitions.svg#Pencil" />
                      </svg>
                      <span className="truncate">Edit</span>
                    </button>
                  )}
                </Menu.Item>

                <Menu.Item>
                  {({ active }) => {
                    const isFirstCol = index === 0; // disable delete for the first column
                    const isOpt = 'isOptimistic' in col && col.isOptimistic;

                    return (
                      <button
                        disabled={isFirstCol}
                        onClick={() => {
                          if (isFirstCol) return;

                          // If it's an optimistic column placeholder, just remove it locally.
                          if (isOpt) {
                            setOptimisticCols(prev => prev.filter(c => (c as any).id !== (col as any).id));
                            return;
                          }

                          // 1) Optimistically hide the column from the UI
                          setPendingDeleteCols(prev => {
                            const next = new Set(prev);
                            next.add(col.id);
                            return next;
                          });
                          // (optional) also hide in visibility map so any other UI respects it
                          setColumnVisibility(prev => ({ ...prev, [col.id]: false }));

                          // 2) Fire backend delete
                          deleteColumn.mutate(
                            { columnId: col.id },
                            {
                              onSuccess: async () => {
                                // Data will refetch; clear the pending flag so new server state shows
                                setPendingDeleteCols(prev => {
                                  const next = new Set(prev);
                                  next.delete(col.id);
                                  return next;
                                });
                                await refetchTable();
                                await utils.table.getRows.invalidate({ tableId });
                                setRowCache({});
                              },
                              onError: (err) => {
                                // Roll back optimistic removal
                                setPendingDeleteCols(prev => {
                                  const next = new Set(prev);
                                  next.delete(col.id);
                                  return next;
                                });
                                setColumnVisibility(prev => ({ ...prev, [col.id]: true }));
                                alert('Failed to delete column: ' + err.message);
                              },
                            }
                          );
                        }}
                        className={`group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium
                          ${active ? 'bg-gray-50' : 'bg-white'}
                          ${isFirstCol ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-700'}`}
                        title={isFirstCol ? 'Cannot delete the first column' : undefined}
                      >
                        <svg
                          className={`w-4 h-4 shrink-0 ${isFirstCol ? 'opacity-40' : 'opacity-80 group-hover:opacity-100'}`}
                          viewBox="0 0 24 24"
                        >
                          <use href="/icons/icon_definitions.svg#Trash" />
                        </svg>
                        <span className="truncate">Delete</span>
                      </button>
                    );
                  }}
                </Menu.Item>

              </div>
            </Menu.Items>
          </Menu>
        )}
      </div>
    ),


    cell: ({ row, column, getValue }) => {
      // 1️⃣ bail out if table isn't ready
      if (!table) return null;

      const cols     = table.columns;
      const visibleCols = tableInstance.getVisibleLeafColumns();
      const colCount = visibleCols.length;
      const columnIndex = visibleCols.findIndex(c => c.id === column.id);

      const rowId     = row.original.id;
      const rowIndex  = row.index;
      const columnId  = column.id;
      const defaultValue = (getValue() as string) ?? "";
      const isOptimistic = String(rowId).startsWith('__optimistic__');

      const rowOverlay = localEdits.get(rowId);
      const overlayValue = rowOverlay?.get(columnId); // ← only this cell
      const displayValue = String(overlayValue ?? defaultValue);



      // const handleBlurAndSave = () => {
      //   const trimmed = String(editingValue ?? "").trim();
      //   if (trimmed !== String(defaultValue).trim()) {
      //     // update local cache
      //     setLocalEdits(prev => {
      //       const copy = new Map(prev);
      //       const rowMap = new Map(copy.get(rowId) ?? []);
      //       rowMap.set(columnId, trimmed);
      //       copy.set(rowId, rowMap);
      //       return copy;
      //     });
      //     // send to server
      //     updateCell.mutate({ tableId, rowId, columnId, value: trimmed });
      //   }
      // };

      const handleBlurAndSave = () => {
        const trimmed = editingValue.trim();
        if (trimmed !== String(defaultValue).trim()) {
          saveCell(rowId, columnId, trimmed); // non-blocking, optimistic
        }
      };


      const focusCell = (nextRow: number, nextColId: string) => {
        const tryFocus = () => {
          const sel = `input[data-row-index="${nextRow}"][data-col-id="${nextColId}"]`;
          const el = document.querySelector<HTMLInputElement>(sel);
          if (el) {
            el.focus();
            el.select();
            return true;
          }
          return false;
        };

        // If it is already mounted, focus now
        if (tryFocus()) return;

        // Ensure it renders in the virtual window, then retry
        virtualizer.scrollToIndex(nextRow, { align: 'auto' });
        requestAnimationFrame(() => {
          if (!tryFocus()) setTimeout(tryFocus, 50);
        });
      };


      const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          handleBlurAndSave();

          if (e.key === 'Enter') {
            // same column, next row
            focusCell(rowIndex + 1, columnId);
            return;
          }

          const dir = e.shiftKey ? -1 : 1;
          let nextColIdx = columnIndex + dir;
          let nextRow    = rowIndex;

          if (nextColIdx < 0) {
            nextRow    = rowIndex - 1;
            nextColIdx = colCount - 1;
          } else if (nextColIdx >= colCount) {
            nextRow    = rowIndex + 1;
            nextColIdx = 0;
          }

          const nextColumn = visibleCols[nextColIdx];
          if (!nextColumn) return;
          focusCell(nextRow, nextColumn.id);
        }
      };


      // standard editing state
      const [editingValue, setEditingValue] = useState(displayValue);

      // Re-sync only when this cell's source value changes
      useEffect(() => {
        setEditingValue(displayValue);
      }, [displayValue, rowId, columnId]);

      // const [editingValue, setEditingValue] = useState(() =>
      //   getCellValue(rowId, columnId, defaultValue)
      // );
      // useEffect(() => {
      //   setEditingValue(getCellValue(rowId, columnId, defaultValue));
      // }, [defaultValue, rowId, columnId, localEdits]);

      return (
        <input
          disabled={isOptimistic}
          placeholder={isOptimistic ? 'Creating…' : undefined}
          data-row-index={rowIndex}
          data-col-id={columnId}
          className="w-full bg-transparent text-sm focus:outline-none"
          value={editingValue}
          onChange={e => setEditingValue(e.target.value)}
          onBlur={handleBlurAndSave}
          onKeyDown={onKeyDown}
        />
      );
    }
  }));
}, [table, uiColumns, optimisticColNames, updateCell, pendingDeleteCols]);




function handleAddRow() {
  // 1) show a blank row immediately
  const temp = makeBlankOptimisticRow();
  setOptimisticRows(prev => [...prev, temp]);

  // 2) fire the mutation; when the server responds, swap temp for real
  addRow.mutate(
    { tableId },
    {
      onSuccess: async () => {
        // remove one optimistic placeholder and refetch real data
        setOptimisticRows(prev => prev.slice(1));
        await utils.table.getRows.invalidate({ tableId });
      },
      onError: (err) => {
        // roll back optimistic row
        setOptimisticRows(prev => prev.slice(1));
        alert('Failed to add row: ' + err.message);
      },
    }
  );
}



const tableInstance = useReactTable({
  data: flatRows,
  columns,
  state: {
    columnVisibility, // Track visibility
  },
  onColumnVisibilityChange: setColumnVisibility,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(), 
  getRowId: (row) => row.id,
  columnResizeMode: 'onChange', // optional if you want to allow resizing
  defaultColumn: {
    size: 240, // ← default fallback size for any new column
    filterFn: 'includesString',
  },
});

  useEffect(() => {
    const last = virtualRows.at(-1);
    if (!last) return;

    if (last.index >= flatRows.length - 30 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualRows, flatRows.length, hasNextPage, isFetchingNextPage]);
  

  // if (isLoading) return <p className="p-4">Loading table...</p>;
  if (isLoading || !table?.columns?.length) return <p className="p-4">Loading table...</p>;
  if (!table) return <p className="p-4">Table not found.</p>;

  
  return (
    
    <div className="h-screen bg-white font-sans flex flex-col overflow-hidden">
      {/* ✅ Top row - full width */}
      <TopBar
        viewName={selectedView?.name ?? "Grid view"}
        columns={uiColumns.map((c: any) => ({ ...c, name: optimisticColNames[c.id] ?? c.name })) as any}
        visibility={columnVisibility}
        filters={filters}
        setFilters={setFilters}
        onToggleColumn={(columnId, visible) =>
          setColumnVisibility((prev) => ({ ...prev, [columnId]: visible }))
        }
        saveCurrentViewConfig={saveCurrentViewConfig}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        addFakeRows={addFakeRows.mutate}
        tableId={tableId}
        sort={sort}
        setSort={setSort}
        onOpenSort={() => setShowSortEditor(true)}
      />

      {showSortEditor && (
        <GlobalSortEditor
          tableId={tableId}
          viewName={selectedView?.name ?? ""}
          columns={table?.columns ?? []}
          sort={sort}
          setSort={setSort}
          onClose={() => {
            setShowSortEditor(false);
            saveCurrentViewConfig();   // ← push the new sort up in one atomic call
          }}
        />
      )}


      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar for Views */}
          <div className="w-64 border-r border-t border-gray-300 p-4 overflow-y-auto">

            {/* Create New View Button + View Type Popup */}
            <div className="mb-4 relative">
              <button
                onClick={() => setIsViewTypeOpen(true)}
                className="w-full flex items-center gap-2 px-2 py-1 text-sm text-gray-700 rounded border border-transparent hover:border-gray-300 hover:bg-gray-300 transition cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <use href="/icons/icon_definitions.svg#Plus" />
                </svg>
                Create new...
              </button>

              {/* Search Bar for Views (non-functional) */}
              <div className="relative mb-4">
                <svg className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" viewBox="0 0 24 24">
                  <use href="/icons/icon_definitions.svg#Lookup" />
                </svg>
                <input
                  type="text"
                  placeholder="Find a view"
                  className="w-full pl-8 pr-3 py-1.5 text-sm text-gray-800 rounded border border-transparent focus:outline-none transition cursor-text"
                  disabled // optional
                />
              </div>

              {isViewTypeOpen &&
                createPortal(
                  <div
                    ref={viewTypeRef}
                    className="fixed top-[100px] left-[300px] w-64 bg-white shadow-xl border rounded z-[9999] p-4"
                  >
                    <p className="text-sm text-gray-500 mb-2">View types</p>
                    <div className="space-y-2">
                      <button
                        className="w-full text-left px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded"
                        onClick={() => {
                          setNewViewType('grid');
                          setIsViewTypeOpen(false);
                          setIsNameDialogOpen(true);
                        }}
                      >
                        📊 Grid
                      </button>
                      <button disabled className="w-full text-left px-3 py-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed">
                        📅 Calendar
                      </button>
                      <button disabled className="w-full text-left px-3 py-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed">
                        🖼️ Gallery
                      </button>
                      <button disabled className="w-full text-left px-3 py-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed">
                        📌 Kanban
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
            </div>

            {/* View List */}
            <ul className="space-y-1 mb-4">
              {views?.map((view) => {
                const isActive = selectedView?.id === view.id;
                return (
                  
                  <li key={view.id}>
                    <button
                      onClick={() => handleSelectView(view)}
                      onMouseEnter={() => setHoveredView(view.id)}
                      onMouseLeave={() => setHoveredView(null)}
                      className={`group w-full flex items-center justify-between text-left px-2 py-1 text-sm rounded transition ${
                        isActive ? 'bg-gray-300 font-medium' : 'hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 fill-current text-gray-600" viewBox="0 0 24 24">
                          <use
                            href={`/icons/icon_definitions.svg#${
                              hoveredView === view.id ? 'Star' : 'GridFeature'
                            }`}
                          />
                        </svg>
                        <span className="truncate">{view.name}</span>
                      </div>

                      {/* Extra icons on hover */}
                      <div className={`flex items-center space-x-1 ${hoveredView === view.id ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition`}>
                        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24">
                          <use href="/icons/icon_definitions.svg#DotsThree" />
                        </svg>
                        
                        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24">
                          <use href="/icons/icon_definitions.svg#DotsSixVertical" />
                        </svg>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

          </div>
        
        {/* Right Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-t border-gray-300 flex-1 flex flex-col overflow-hidden">

              {viewSavedMessage && (
                <div className="mb-4 px-4 py-2 bg-green-100 border border-green-400 text-green-700 rounded shadow">
                  {viewSavedMessage}
                </div>
              )}


              <div className="flex flex-wrap items-center gap-2">
                {/* progress indicator */}
                {addingRows && (
                    <p className="text-sm text-gray-500 mt-2">
                        ⏳ Please wait... Generating 100,000 rows. This may take a few seconds.
                    </p>
                )}

              </div>
              

              <div
                className="flex-1 overflow-auto pt-0 pl-0 bg-gray-100"
                ref={parentRef}
              >

                {/* Virtualised body */}
                <div
                  style={{ height: totalHeight, position: 'relative' }}
                  className="pt-0 pl-0"
                >
                  <table className="table-fixed border-separate border-spacing-0 border-gray-200 bg-white">
                    <colgroup>
                      {/* Row number column (narrow) */}
                      <col
                        style={{
                          width: '48px',
                          minWidth: '48px',
                          maxWidth: '48px',
                        }}
                      />
                      {tableInstance.getFlatHeaders().map((header) => (
                        <col
                          key={header.id}
                          style={{
                            width: '150px',
                            minWidth: '150px',
                            maxWidth: '150px',
                          }}
                        />
                      ))}
                    </colgroup>

                    {/* Sticky Header inside scroll container */}
                    <thead className="sticky top-0 z-20 bg-white">
                      {tableInstance.getHeaderGroups().map((group) => (
                        <tr key={group.id}>
                          {/* Add row number header */}
                          <th
                            className="sticky left-0 z-30 bg-gray-50 relative"
                            style={{ height: '40px' }}
                          >
                            #
                          </th>

                          {group.headers.map((header, idx) => (
                            <th
                              key={`${group.id}-${header.id}`}
                              className={`px-3 py-2 text-left text-xs tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200 ${idx === 0 ? `
                                sticky left-[48px] z-20 relative overflow-visible
                                after:content-[''] after:absolute after:top-0 after:left-[100%] after:ml-[-1px] after:h-full after:w-8
                                after:bg-gradient-to-r after:from-gray-300/50 after:to-transparent
                                after:pointer-events-none
                              ` : ''}`}
                              style={{ height: '40px' }}
                            >
                              <div className="flex justify-between items-center">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                            </th>
                          ))}

                          <th 
                          key={`add-field-${group.id}`}
                          className="px-8 py-2 text-left text-xs tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                            <Popover className="relative">
                              {({ open, close }) => (
                                <>
                                  <Popover.Button
                                    className={`rounded-full px-2 py-1 cursor-pointer ${open ? 'text-gray-500' : ''}`}
                                    onClick={() => {
                                      // always start at step 1 when opening
                                      setAddFieldStep('choose');
                                      setPendingFieldType(null);
                                      setPendingFieldName('');
                                    }}
                                  >
                                    <svg className="w-4 h-4 fill-current text-gray-400 hover:text-gray-600">
                                      <use href="/icons/icon_definitions.svg#Plus" />
                                    </svg>
                                  </Popover.Button>

                                  <Transition
                                    as={Fragment}
                                    show={open}
                                    enter="transition ease-out duration-200"
                                    enterFrom="opacity-0 translate-y-1"
                                    enterTo="opacity-100 translate-y-0"
                                    leave="transition ease-in duration-150"
                                    leaveFrom="opacity-100 translate-y-0"
                                    leaveTo="opacity-0 translate-y-1"
                                  >
                                    {/* IMPORTANT: no `{open && ...}` here, and as="div" to ensure a DOM node */}
                                    <Popover.Panel as="div" className="absolute top-full left-0 mt-2 z-50">
                                      {/* animated container size change between steps */}
                                      <div
                                        className={`transition-all duration-200 ease-out ${
                                          addFieldStep === 'choose' ? 'w-80' : 'w-[420px]'
                                        }`}
                                      >
                                        {/* Step 1: chooser */}
                                        <Transition
                                          as="div" // ensure a real element
                                          show={addFieldStep === 'choose'}
                                          enter="transition ease-out duration-150"
                                          enterFrom="opacity-0 scale-95 -translate-y-1"
                                          enterTo="opacity-100 scale-100 translate-y-0"
                                          leave="transition ease-in duration-150"
                                          leaveFrom="opacity-100 scale-100 translate-y-0"
                                          leaveTo="opacity-0 scale-95 -translate-y-1"
                                        >
                                          <div className="bg-white border border-gray-200 rounded shadow overflow-hidden">
                                            <AddFieldPopover
                                              onAddField={(type) => {
                                                // go to step 2, prefill chosen type
                                                setPendingFieldType(type);
                                                setPendingFieldName('');
                                                setAddFieldStep('configure');
                                              }}
                                            />
                                          </div>
                                        </Transition>

                                        {/* Step 2: configure (smaller) */}
                                        <Transition
                                          as="div" // ensure a real element
                                          show={addFieldStep === 'configure'}
                                          enter="transition ease-out duration-150"
                                          enterFrom="opacity-0 scale-95 -translate-y-1"
                                          enterTo="opacity-100 scale-100 translate-y-0"
                                          leave="transition ease-in duration-150"
                                          leaveFrom="opacity-100 scale-100 translate-y-0"
                                          leaveTo="opacity-0 scale-95 -translate-y-1"
                                        >
                                          {/* Do not wrap in `{pendingFieldType && ...}` — keep the element stable */}
                                          <AddFieldConfigurePanel
                                            type={pendingFieldType ?? 'TEXT'} // safe default; you set it before showing
                                            name={pendingFieldName}
                                            setName={setPendingFieldName}
                                            onChangeType={(t) => setPendingFieldType(t)}
                                            onCancel={() => {
                                              // Close first so the leave animation runs with a real node,
                                              // then reset state on the next tick.
                                              close();
                                              requestAnimationFrame(() => {
                                                setAddFieldStep(null);
                                                setPendingFieldType(null);
                                                setPendingFieldName('');
                                              });
                                            }}
                                            onCreate={() => {
                                              const t: FieldType = (pendingFieldType ?? 'TEXT');

                                              // avoid name collision with both server + optimistic columns
                                              const existingNamesLower = new Set(
                                                (uiColumns ?? []).map((c: any) =>
                                                  String(c.name ?? c.title ?? c.id).toLowerCase()
                                                )
                                              );
                                              const userName = (pendingFieldName || '').trim();
                                              const finalName = userName || nextAutoName(t, existingNamesLower);

                                              // 1) add optimistic column immediately
                                              const tempColId = `__colopt__${Date.now()}_${Math.random().toString(36).slice(2)}`;
                                              setOptimisticCols(prev => [
                                                ...prev,
                                                { id: tempColId, name: finalName, type: t, isOptimistic: true },
                                              ]);
                                              setColumnVisibility(prev => ({ ...prev, [tempColId]: true }));

                                              // 2) fire mutation; on success, remove placeholder and refresh real data
                                              addColumnAndPopulate.mutate(
                                                {
                                                  tableId,
                                                  name: finalName,
                                                  type: t,
                                                  defaultValue: '',
                                                },
                                                {
                                                  onSuccess: async () => {
                                                    setOptimisticCols(prev => prev.filter(c => c.id !== tempColId));
                                                    await refetchTable();
                                                    await utils.table.getRows.invalidate({ tableId });
                                                  },
                                                  onError: (err) => {
                                                    setOptimisticCols(prev => prev.filter(c => c.id !== tempColId));
                                                    alert('Failed to add column: ' + err.message);
                                                  },
                                                }
                                              );

                                              // Close the popover and reset local UI state
                                              close();
                                              requestAnimationFrame(() => {
                                                setAddFieldStep(null);
                                                setPendingFieldType(null);
                                                setPendingFieldName('');
                                              });
                                            }}


                                          />
                                        </Transition>
                                      </div>
                                    </Popover.Panel>
                                  </Transition>
                                </>
                              )}
                            </Popover>

                          </th>



                        </tr>
                      ))}
                    </thead>

                    <tbody>
                      <tr>
                        <td colSpan={tableInstance.getAllLeafColumns().length+1} style={{ height: totalHeight, position: 'relative' }}>
                          <div className="absolute top-0 left-0 w-full">
                            {virtualRows.map((virtualRow) => {
                              const isAddRow = virtualRow.index >= flatRows.length;
                              if (isAddRow) return null; 

                              const row = tableInstance.getRowModel().rows.find(
                                (r) => r.index === virtualRow.index
                              );

                              if (!row) {
                                return (
                                  <div
                                    key={`loading-${virtualRow.index}`}
                                    style={{
                                      position: 'absolute',
                                      transform: `translateY(${virtualRow.start}px)`,
                                      height: `${virtualRow.size}px`,
                                    }}
                                    className="text-center text-sm text-gray-400"
                                  >
                                    Loading...
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={row.id}
                                  ref={virtualizer.measureElement}
                                  data-index={virtualRow.index}
                                  style={{
                                    position: 'absolute',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    height: `${virtualRow.size}px`,
                                    display: 'flex',
                                    width: '100%',
                                  }}
                                  className="group relative z-0 flex transition-colors hover:bg-gray-100 border-b border-gray-200"
                                >
                              
                                {/* Row numbers */}
                                <div
                                  className="sticky left-0 z-10 bg-white group-hover:bg-gray-100 relative"
                                  style={{
                                    width: '48px',
                                    minWidth: '48px',
                                    maxWidth: '48px',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <div className="group relative w-full h-full flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      className="form-checkbox h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100 transition"
                                    />
                                    <span className="text-sm text-gray-500 absolute group-hover:opacity-0 transition">
                                      {virtualRow.index + 1}
                                    </span>
                                  </div>
                                </div>


                                  {row.getVisibleCells().map((cell, i) => (
                                    <div
                                      key={cell.id}
                                      className={`
                                        flex items-center px-3 py-2 text-sm text-gray-800 bg-transparent border-r border-gray-200
                                        ${i === 0 ? `
                                          sticky left-[48px] z-10 bg-white group-hover:bg-gray-100 relative overflow-visible
                                          after:content-[''] after:absolute after:top-0 after:left-[100%] after:ml-[-1px] after:h-full after:w-8
                                          after:bg-gradient-to-r after:from-gray-300/50 after:to-transparent
                                          after:pointer-events-none
                                        ` : ''}
                                        ${virtualRow.index === flatRows.length - 1 ? '' : 'border-b'}
                                      `}
                                      style={{ width: '150px', minWidth: '150px', maxWidth: '150px', boxSizing: 'border-box' }}
                                    >
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </div>
                                  ))}

                                </div>
                              );
                            })}
                            {/* Add Row Button Row */}
                            <div
                              key="add-row-button"
                              style={{
                                position: 'absolute',
                                transform: `translateY(${addRowY}px)`,
                                height: '47px', // match estimated row height
                                display: 'flex',
                                width: '100%',
                              }}
                              className="group hover:bg-gray-100 cursor-pointer border-b border-r border-gray-200"
                              onClick={handleAddRow}
                            >
                              {/* Row number cell with + icon */}
                              <div
                                className="sticky left-0 z-10 flex items-center justify-center text-gray-400 font-bold border-t border-gray-400 hover:text-gray-500 bg-white group-hover:bg-gray-100"
                                style={{
                                  width: '48px',
                                  minWidth: '48px',
                                  maxWidth: '48px',
                                  boxSizing: 'border-box',
                                }}
                              >
                                +
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
        </div>
      </div>

        {isViewTypeOpen && (
          <div className="absolute top-12 left-full ml-2 w-64 bg-white shadow-xl border rounded z-50 p-4">
            <h3 className="text-lg font-semibold mb-4">Choose view type</h3>
            <div className="space-y-2">
              <button
                className="w-full text-left px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded cursor-pointer"
                onClick={() => {
                  setNewViewType('grid');
                  setIsViewTypeOpen(false);
                  setIsNameDialogOpen(true);
                }}
              >
                📊 Grid
              </button>
              <button disabled className="w-full text-left px-3 py-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed">
                📅 Calendar
              </button>
              <button disabled className="w-full text-left px-3 py-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed">
                🖼️ Gallery
              </button>
              <button disabled className="w-full text-left px-3 py-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed">
                📌 Kanban
              </button>
            </div>
          </div>
        )} 


        <Dialog open={isNameDialogOpen} onClose={() => setIsNameDialogOpen(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-xl w-96">
              <h3 className="text-lg font-semibold mb-4">Name your view</h3>
              <input
                type="text"
                placeholder="Enter view name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                className="w-full border px-3 py-2 rounded mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsNameDialogOpen(false)}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  onClick={() => {
                    if (!viewName.trim()) return alert('Enter a view name');
                    const hiddenColumns = Object.entries(columnVisibility)
                      .filter(([, isVisible]) => !isVisible)
                      .map(([colId]) => colId);

                    createView.mutate({
                      tableId,
                      name: viewName.trim(),
                    });


                    setViewName('');
                    setIsNameDialogOpen(false);
                  }}
                >
                  ➕ Create view
                </button>
              </div>
            </div>
          </div>
        </Dialog>

        {/* <Dialog open={!!editingColumn} onClose={() => setEditingColumn(null)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-xl w-96">
              <h3 className="text-lg font-semibold mb-4">Edit Column</h3>
              <label className="block mb-1 text-sm font-medium text-gray-700">Column Name</label>
              <input
                type="text"
                defaultValue={editingColumn?.name}
                onChange={(e) => {
                  if (editingColumn) {
                    setEditingColumn({ ...editingColumn, name: e.target.value });
                  }
                }}
                className="w-full border px-3 py-2 rounded mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingColumn(null)}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  onClick={() => {
                    if (editingColumn?.name?.trim()) {
                      renameColumn.mutate({
                        columnId: editingColumn.id,
                        name: editingColumn.name.trim(),
                      });
                      setEditingColumn(null);
                    } else {
                      alert("Column name cannot be empty.");
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </Dialog> */}

        



      </div>

      {/* Global column editor (single instance) */}
      {editingColumn && editAnchor && createPortal(
        <>
          {/* light click-away backdrop */}
          <div
            className="fixed inset-0 z-[199] bg-transparent"
            onClick={() => { setEditingColumn(null); setEditAnchor(null); }}
          />
          {/* anchored card */}
          <div
            className="fixed z-[1000]"
            style={{
              // directly below the header, small gap
              top: Math.min(
                editAnchor.bottom + 8,
                (typeof window !== 'undefined' ? window.innerHeight - 320 : editAnchor.bottom + 8)
              ),
              // align left edges with the header th
              left: Math.max(
                8,
                Math.min(
                  editAnchor.left,
                  (typeof window !== 'undefined' ? window.innerWidth - 428 : editAnchor.left)
                )
              ),
            }}
          >
            <div className="w-[420px] rounded-xl border border-gray-200 bg-white shadow-[0_12px_32px_rgba(16,24,40,0.16)] ring-1 ring-black/5">
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="mt-0.5 h-4 w-4 text-gray-400" viewBox="0 0 24 24">
                    <use href="/icons/icon_definitions.svg#Lock" />
                  </svg>
                  <p>
                    This is the table’s <span className="font-medium">primary field</span>. The name is meant to be a short, unique representation of each record.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <button disabled className="w-full inline-flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed">
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24">
                        <use href="/icons/icon_definitions.svg#TextAa" />
                      </svg>
                      Single line text
                    </span>
                    <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24">
                      <use href="/icons/icon_definitions.svg#CaretDown" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 cursor-not-allowed"
                >
                  <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24">
                    <use href="/icons/icon_definitions.svg#Plus" />
                  </svg>
                  Add description
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingColumn(null); setEditAnchor(null); setEditName(''); }}
                    className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const trimmed = editName.trim();
                      if (!trimmed || !editingColumn) return alert('Column name cannot be empty.');

                      // 1) optimistic UI name
                      setOptimisticColNames(prev => ({ ...prev, [editingColumn.id]: trimmed }));

                      // 2) close the editor immediately
                      const id = editingColumn.id;
                      setEditingColumn(null);
                      setEditAnchor(null);

                      // 3) fire backend rename
                      renameColumn.mutate(
                        { columnId: id, name: trimmed },
                        {
                          onSuccess: async () => {
                            await refetchTable();
                            await utils.table.getRows.invalidate({ tableId });
                            // clear optimistic overlay (server now has the name)
                            setOptimisticColNames(prev => { const m = { ...prev }; delete m[id]; return m; });
                          },
                          onError: (err) => {
                            // roll back optimistic overlay
                            setOptimisticColNames(prev => { const m = { ...prev }; delete m[id]; return m; });
                            alert('Failed to rename column: ' + err.message);
                          },
                        }
                      );
                    }}
                    className="px-4 py-2 rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      
    </div>
  );
}

