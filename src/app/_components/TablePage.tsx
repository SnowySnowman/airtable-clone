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

export default function TablePage({ tableId }: { tableId: string }) {
  const [rowCount, setRowCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sort, setSort] = useState<{ columnId: string; order: "asc" | "desc" }[]>([]);
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [debouncedFilters] = useDebounce(filters, 500);
  const [debouncedSort] = useDebounce(sort, 500);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  
  
  const { data: views } = api.table.getViews.useQuery({ tableId });
  const [selectedView, setSelectedView] = useState<TableView | null>(null);

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
  // const virtualizer = useVirtualizer({
  //   count: rowCount,
  //   getScrollElement: () => parentRef.current,
  //   estimateSize: () => 47,
  //   measureElement: (el) => el.getBoundingClientRect().height,
  //   overscan: 10,
  // });

  
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
  
  const [showSortEditor, setShowSortEditor] = useState(false);
  
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);


  const updateCell = api.table.updateCell.useMutation();
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
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
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
    }
  );



  // useEffect(() => {
  //   if (!data) return;
  //   setRowCount(data.rows.length + (data.nextCursor ? 1 : 0));
  // }, [data]);

  useEffect(() => {
  if (!data?.pages?.length) return;

  // Get all fetched rows from all pages
  const allRows = data.pages.flatMap((page) => page.rows);

  // Estimate row count (optional: make more precise if your backend returns total count separately)
  setRowCount(allRows.length + 1);

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
}, [data]);


useEffect(() => {
  const listener = (e: FocusEvent) => {
    console.log('🧠 blur:', e.target);
  };
  window.addEventListener('blur', listener, true);
  return () => window.removeEventListener('blur', listener, true);
}, []);



  
  

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


  // const flatRows = useMemo<TableRow[]>(() => {
  //   return (
  //     data?.rows.map((row) => ({
  //       id: row.id,
  //       ...(typeof row.values === "object" && row.values !== null
  //         ? row.values as Record<string, string | number>
  //         : {})
  //     })) ?? []
  //   );
  // }, [data, searchQuery]);

  // const flatRows = useMemo<TableRow[]>(() => {
  //   return Array.from({ length: rowCount }, (_, i) =>
  //     rowCache[i] ?? { id: `placeholder-${i}` }
  //   );
  // }, [rowCache, rowCount]);

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

  return all;
}, [data]);
  
  console.log("DEBUG flatRows:", flatRows);

  
  const lastVirtualRow = [...virtualRows].reverse().find((vr) => vr.index < flatRows.length);
  const addRowY = lastVirtualRow ? lastVirtualRow.start + lastVirtualRow.size : totalHeight;

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
  if (!table) return [];

  return table.columns.map((col, index) => ({
    accessorKey: col.id ?? `col-${index}`, // fallback ID
    size: 240,
    
    header: () => (
      <div className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100 rounded">
        <div className="flex items-center space-x-1 text-sm font-medium text-gray-700">
          <span className="truncate">{col.name}</span>
        </div>
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 text-sm cursor-pointer">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <use href="/icons/icon_definitions.svg#DotsThree" />
            </svg>
          </Menu.Button>
          <Menu.Items className="absolute right-0 mt-2 w-32 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg focus:outline-none z-50 cursor-pointer">
            <div className="py-1">
              <Menu.Item as="button">
                {({ active }) => (
                  <button
                    onClick={() => setEditingColumn(col)}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } w-full text-left px-4 py-2 text-sm text-gray-700 flex items-center space-x-2`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <use href="/icons/icon_definitions.svg#Pencil" />
                    </svg>
                    <span>Edit</span>
                  </button>
                )}
              </Menu.Item>

              {editingColumn?.id === col.id && (
                <div className="absolute right-36 top-0 mt-2 w-64 bg-white border border-gray-200 rounded shadow-lg p-4 z-50">
                  <label className="block mb-2 text-sm font-medium text-gray-700">Rename column</label>
                  <input
                    type="text"
                    value={editingColumn.name}
                    onChange={(e) =>
                      setEditingColumn({ ...editingColumn, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingColumn(null)}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        renameColumn.mutate({
                          columnId: editingColumn.id,
                          name: editingColumn.name.trim(),
                        });
                        setEditingColumn(null);
                      }}
                      className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}


              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => {
                      if (confirm("Delete this column?")) deleteColumn.mutate({ columnId: col.id });
                    }}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } w-full text-left px-4 py-2 text-sm text-red-600 flex items-center space-x-2 cursor-pointer`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <use href="/icons/icon_definitions.svg#Trash" />
                    </svg>
                    <span>Delete</span>
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Menu>
      </div>
    ),

    // cell: ({ row, column, getValue }) => {
    //   const rowId = row.original.id;
    //   const columnId = column.id;
    //   const defaultValue = getValue() as string ?? "";
      
    //   const [editingValue, setEditingValue] = useState(() =>
    //     getCellValue(rowId, columnId, defaultValue)
    //   );

    //   useEffect(() => {
    //     // Keep in sync with backend updates or cache refetch
    //     const latest = getCellValue(rowId, columnId, defaultValue);
    //     setEditingValue(latest);
    //   }, [defaultValue, rowId, columnId, localEdits]);

    //   const handleBlur = () => {
    //     let trimmed: string;
    //     trimmed = String(editingValue ?? "").trim();

    //     if (trimmed !== String(defaultValue).trim()) {
    //       // Update local cache
    //       setLocalEdits((prev) => {
    //         const newMap = new Map(prev);
    //         const rowMap = new Map(newMap.get(rowId) ?? []);
    //         rowMap.set(columnId, trimmed);
    //         newMap.set(rowId, rowMap);
    //         return newMap;
    //       });

    //       // Update backend
    //       updateCell.mutate({
    //         tableId,
    //         rowId,
    //         columnId,
    //         value: trimmed,
    //       });

    //       console.log('💡 onBlur triggered', { rowId, columnId, editingValue });
    //     }
    //   };

    //   return (
    //     <input
    //       className="w-full bg-transparent text-sm px-0 py-0 focus:outline-none focus:ring-0"
    //       value={editingValue}
    //       onChange={(e) => setEditingValue(e.target.value)}
    //       onBlur={handleBlur}
    //       onKeyDown={(e) => {
    //         if (e.key === 'Enter') {
    //           e.preventDefault(); // prevent form submit or other side effects
    //           handleBlur();
    //         }
    //       }}
    //     />
    //   );
    // }


    cell: ({ row, column, getValue }) => {
      // 1️⃣ bail out if table isn't ready
      if (!table) return null;

      const cols     = table.columns;
      const colCount = cols.length;

      const rowId     = row.original.id;
      const rowIndex  = row.index;
      const columnId  = column.id;
      const defaultValue = (getValue() as string) ?? "";
      const columnIndex  = cols.findIndex(c => c.id === columnId);

      const handleBlurAndSave = () => {
        const trimmed = String(editingValue ?? "").trim();
        if (trimmed !== String(defaultValue).trim()) {
          // update local cache
          setLocalEdits(prev => {
            const copy = new Map(prev);
            const rowMap = new Map(copy.get(rowId) ?? []);
            rowMap.set(columnId, trimmed);
            copy.set(rowId, rowMap);
            return copy;
          });
          // send to server
          updateCell.mutate({ tableId, rowId, columnId, value: trimmed });
        }
      };

      const focusCell = (nextRow: number, nextColId: string) => {
        // find the input in the DOM
        const sel = `input[data-row-index="${nextRow}"][data-col-id="${nextColId}"]`;
        const next = document.querySelector<HTMLInputElement>(sel);
        if (next) {
          next.focus();
          next.select();
          // if you're virtualized, you may need to scroll it into view:
          next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      };

      const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          handleBlurAndSave();

          if (e.key === 'Enter') {
            focusCell(rowIndex + 1, columnId);
          } else {
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
            const nextColId = cols[nextColIdx].id;
            focusCell(nextRow, nextColId);
          }
        }
      };

      // standard editing state
      const [editingValue, setEditingValue] = useState(() =>
        getCellValue(rowId, columnId, defaultValue)
      );
      useEffect(() => {
        setEditingValue(getCellValue(rowId, columnId, defaultValue));
      }, [defaultValue, rowId, columnId, localEdits]);

      return (
        <input
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
}, [table, tableId, updateCell]);




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

    if (last.index >= flatRows.length - 10 && hasNextPage && !isFetchingNextPage) {
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
        columns={table.columns}
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
                className="flex-1 overflow-auto pt-0 pl-0"
                ref={parentRef}
              >

                {/* Virtualised body */}
                <div
                  style={{ height: totalHeight, position: 'relative' }}
                  className="pt-0 pl-0"
                >
                  <table className="table-fixed border-separate border-spacing-0 border-gray-200">
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
                          {/* STEP 2: Add row number header */}
                          <th
                            className="px-2 py-2 text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200 w-12"
                            style={{ height: '40px' }}
                          >
                            #
                          </th>

                          {group.headers.map((header) => (
                            <th
                              key={header.id}
                              className="px-3 py-2 text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200"
                              style={{
                                height: '40px',
                              }}
                            >
                              <div className="flex justify-between items-center">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                            </th>
                          ))}

                          {/* Add Column Button */}
                          <th className="px-8 py-2 text-left text-xs tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                            <button
                              onClick={() => {
                                const name = prompt("Column name?");
                                if (!name) return;
                                const type = prompt("Type (text/number)?", "text");
                                if (!["TEXT", "NUMBER"].includes(type ?? "")) return alert("Invalid type");

                                addColumnAndPopulate.mutate({
                                  tableId,
                                  name,
                                  type: type as "TEXT" | "NUMBER",
                                  defaultValue: "", // optional
                                });
                              }}
                              className="text-green-500 hover:bg-green-100 rounded-full px-2 py-1 cursor-pointer"
                            >
                            <svg className="w-4 h-4 fill-current text-gray-400 hover:text-gray-600">
                              <use href="/icons/icon_definitions.svg#Plus" />
                            </svg>
                            </button>
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
                                  key={`${row.id}-${virtualRow.index}`}
                                  ref={virtualizer.measureElement}
                                  data-index={virtualRow.index}
                                  style={{
                                    position: 'absolute',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    height: `${virtualRow.size}px`,
                                    display: 'flex',
                                    width: '100%',
                                  }}
                                  className="relative z-0 flex transition-colors hover:bg-gray-100 border-b border-gray-200"
                                >
                              
                                {/* Row numbers */}
                                <div
                                  className="flex items-center justify-center bg-transparent border-r border-gray-200"
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


                                  {row.getVisibleCells().map((cell) => (
                                    <div
                                      key={cell.id}
                                      className={
                                        `flex items-center px-3 py-2 text-sm text-gray-800 bg-transparent border-r border-gray-200 
                                        ${virtualRow.index === flatRows.length - 1 ? '' : 'border-b'}`
                                      }

                                      style={{
                                        width: '150px',
                                        minWidth: '150px',
                                        maxWidth: '150px',
                                        boxSizing: 'border-box',
                                      }}
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
                              className="hover:bg-gray-100 cursor-pointer border-b border-r border-gray-200"
                              onClick={() => addRow.mutate({ tableId })}
                            >
                              {/* Row number cell with + icon */}
                              <div
                                className="flex items-center justify-center text-blue-500 font-bold border-t border-gray-200"
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

        <Dialog open={!!editingColumn} onClose={() => setEditingColumn(null)} className="relative z-50">
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
        </Dialog>


      </div>
      
    </div>
  );
}

