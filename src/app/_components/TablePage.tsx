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
import type { TableView } from '@prisma/client';
import type { ViewConfig } from '~/server/api/routers/table';
import GlobalFilterPopover from '~/app/_components/GlobalFilterPopover';
import GlobalSortPopover from './GlobalSortPopover';
import GlobalColVisibilityPopover from '~/app/_components/GlobalColVisibilityPopover';
import { createPortal } from 'react-dom';
import { Dialog } from '@headlessui/react';


type TableRow = {
  id: string;
  [key: string]: string | number;
};

function isViewConfig(config: unknown): config is ViewConfig {
  return typeof config === 'object' && config !== null && 'filters' in config;
}

export default function TablePage({ tableId }: { tableId: string }) {
  const [rowCount, setRowCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const { data: views } = api.table.getViews.useQuery({ tableId });
  const [selectedView, setSelectedView] = useState<TableView | null>(null);
  const [viewName, setViewName] = useState("");
//   const [sortConfig, setSortConfig] = useState<{ columnId: string; order: "asc" | "desc" } | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<typeof sort>([]);
  const [viewSavedMessage, setViewSavedMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<
    string,
    { type: "text" | "number"; op: string; value: any }
  >>({});
  const [sort, setSort] = useState<{ columnId: string; order: "asc" | "desc" }[]>([]);
  const [addingRows, setAddingRows] = useState(false);

  // const { data: table, isLoading, refetch } = api.table.getTableById.useQuery({ tableId });
  const { data: table, isLoading, refetch: refetchTable } = api.table.getTableById.useQuery({ tableId }, {
    refetchOnWindowFocus: false, // prevents double-fetching
  });
  const [rowCache, setRowCache] = useState<Record<number, TableRow>>({});

  const [isViewTypeOpen, setIsViewTypeOpen] = useState(false);
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [newViewType, setNewViewType] = useState<'grid' | null>(null);

  
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

  // useEffect(() => {
  //   void refetchRows(); // triggers fetch for [start, start + limit)
  // }, [start, debouncedSearch, sort, filters]);

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

  

  

  // const {
  //   data,
  //   fetchNextPage,
  //   hasNextPage,
  //   isFetchingNextPage,
  // } = api.table.getRows.useInfiniteQuery(
  //   { tableId, 
  //     limit: 100, 
  //   search: isViewConfig(selectedView?.config) ? selectedView.config.search ?? debouncedSearch : debouncedSearch,
  //   sort: isViewConfig(selectedView?.config) ? selectedView.config.sort ?? sort : sort,
  //   filters: isViewConfig(selectedView?.config) ? selectedView.config.filters ?? filters : filters,
  //   },
  //   {
  //     getNextPageParam: (lastPage) => lastPage.nextCursor,
  //     refetchOnWindowFocus: false,
  //     enabled: !!tableId,
  //   }
  // );
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
  setRowCount(allRows.length);

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



  
  const [localEdits, setLocalEdits] = useState<Map<string, Map<string, string>>>(new Map());

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});


  const updateCell = api.table.updateCell.useMutation();
  // const addColumn = api.table.addColumn.useMutation({
  //   onSuccess: async () => {
  //     await refetchTable();        // refresh columns
  //     await refetchRows();         // refresh data (row values)
  //     setRowCache({});             // clear cache so rows match new columns
  //     // await utils.table.getTableById.invalidate({ tableId });
  //   },
  // });
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

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
  if (!table) return [];

  return table.columns.map((col, index) => ({
    accessorKey: col.id ?? `col-${index}`, // fallback ID
    size: 240,
    
    header: () => (
      <div className="flex items-center space-x-2">
        <span>{col.name}</span>
        <button
          onClick={() => {
            const newName = prompt("Rename column:", col.name);
            if (newName) renameColumn.mutate({ columnId: col.id, name: newName });
          }}
        >
          ✏️
        </button>
        <button
          onClick={() => {
            if (confirm("Delete this column?")) deleteColumn.mutate({ columnId: col.id });
          }}
        >
          🗑️
        </button>
      </div>
    ),
    cell: ({ row, column, getValue }) => {
      const rowId = row.original.id;
      const columnId = column.id;
      const defaultValue = getValue() as string ?? "";
      const [optimisticCols, setOptimisticCols] = useState<
        { id: string; name: string; type: 'text' | 'number' }[]
      >([]);
      const [editingValue, setEditingValue] = useState(() =>
        getCellValue(rowId, columnId, defaultValue) ?? ""
      );

      useEffect(() => {
        // keep local state in sync if backend updates
        setEditingValue(getCellValue(rowId, columnId, defaultValue));
      }, [defaultValue, rowId, columnId]);

      return (
        <input
          className="px-2 py-1 w-full focus:outline-none"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)} // ✅ fast local state only
          onBlur={() => {
            const trimmed = String(editingValue).trim();
            if (trimmed !== defaultValue) {
              // ✅ show new value immediately
              setLocalEdits((prev) => {
                const newMap = new Map(prev);
                const rowMap = new Map(newMap.get(rowId) ?? []);
                rowMap.set(columnId, trimmed);
                newMap.set(rowId, rowMap);
                return newMap;
              });

              // ✅ update server in background
              updateCell.mutate({
                tableId,
                rowId,
                columnId,
                value: trimmed,
              });
            }
          }}
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


  // useEffect(() => {
  //   const last = virtualRows.at(-1);
  //   if (!last) return;
  //   if (last.index >= flatRows.length - 1 && hasNextPage && !isFetchingNextPage) {
  //     fetchNextPage();
  //   }
  // }, [virtualRows, flatRows.length, hasNextPage, isFetchingNextPage, searchQuery]);

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
    
    <div className="flex h-screen">
      
      
        {/* Left Sidebar for Views */}
          <div className="w-64 border-r p-4 overflow-y-auto relative">
            <h2 className="font-semibold mb-2">Views</h2>

            {/* Create New View Button + View Type Popup */}
            <div className="mb-4 relative">
              <button
                onClick={() => setIsViewTypeOpen(true)}
                className="w-full bg-blue-600 text-white px-3 py-1 rounded"
              >
                ➕ Create view
              </button>

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
              <li>
                <button
                  onClick={() => {
                    setSelectedView(null);
                    setSearchQuery('');
                    setSort([]);
                    setFilters({});
                    setColumnVisibility({});
                  }}
                  className={`w-full text-left px-2 py-1 rounded ${
                    !selectedView ? 'bg-gray-200' : 'hover:bg-gray-100'
                  }`}
                >
                  Grid view
                </button>
              </li>
              {views?.map((view) => (
                <li key={view.id}>
                  <button
                    onClick={() => {
                      const config = view.config as ViewConfig;
                      setSelectedView(view);
                      setFilters(config.filters ?? {});
                      setSort(Array.isArray(config.sort) ? config.sort : []);
                      setSearchQuery(config.search ?? '');
                      const hiddenCols = config.hiddenColumns ?? [];
                      const visibility = Object.fromEntries(
                        table?.columns.map((col) => [col.id, !hiddenCols.includes(col.id)]) ?? []
                      );
                      setColumnVisibility(visibility);
                    }}
                    className={`w-full text-left px-2 py-1 rounded ${
                      selectedView?.id === view.id ? 'bg-gray-200' : 'hover:bg-gray-100'
                    }`}
                  >
                    {view.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>


        {isViewTypeOpen && (
          <div className="absolute top-12 left-full ml-2 w-64 bg-white shadow-xl border rounded z-50 p-4">
            <h3 className="text-lg font-semibold mb-4">Choose view type</h3>
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
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => {
                    if (!viewName.trim()) return alert('Enter a view name');
                    const hiddenColumns = Object.entries(columnVisibility)
                      .filter(([, isVisible]) => !isVisible)
                      .map(([colId]) => colId);

                    saveView.mutate({
                      tableId,
                      name: viewName.trim(),
                      config: {
                        search: searchQuery || undefined,
                        sort,
                        filters,
                        hiddenColumns,
                      },
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




      
      <div className="flex-1 p-4 overflow-x-auto">

        <h1 className="text-xl font-bold mb-4">{table.name}</h1>
        {viewSavedMessage && (
          <div className="mb-4 px-4 py-2 bg-green-100 border border-green-400 text-green-700 rounded shadow">
            {viewSavedMessage}
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2">

          <GlobalColVisibilityPopover
            columns={table.columns}
            visibility={columnVisibility}
            onToggle={(columnId, visible) => {
              setColumnVisibility((prev) => ({
                ...prev,
                [columnId]: visible,
              }));
            }}
          />


          <button
            onClick={() => {
              // const name = prompt("Column name?");
              // if (!name) return;
              // const type = prompt("Type (text/number)?", "text");
              // if (!["text", "number"].includes(type ?? "")) return alert("Invalid type");

              // addColumn.mutate({ tableId, name, type: type as "text" | "number" });
              const name = prompt("Column name?");
              if (!name) return;
              const type = prompt("Type (text/number)?", "text");
              if (!["text", "number"].includes(type ?? "")) return alert("Invalid type");

              addColumnAndPopulate.mutate({
                tableId,
                name,
                type: type as "text" | "number",
                defaultValue: "", // optional
              });

            }}
            className="bg-green-500 text-white px-3 py-1 rounded"
          >
            ➕ Add Column
          </button>

          <button
            onClick={() => addRow.mutate({ tableId })}
            className="bg-blue-500 text-white px-3 py-1 rounded"
          >
            ➕ Add Row
          </button>

          <button
              onClick={async () => {
                  if (confirm("Are you sure you want to add 100,000 fake rows?")) {
                  setAddingRows(true);
                  try {
                      await addFakeRows.mutateAsync({ tableId, count: 100000 });
                      await utils.table.getRows.invalidate({ tableId }); // Clear tRPC cache
                      setRowCache({}); // Clear local cache so new rows load cleanly
                      await fetchNextPage(); // Load more data immediately (optional)
                      console.log("✅ Rows added and data refreshed");
                  } catch (err) {
                      console.error("❌ Failed to add rows:", err);
                      alert("Failed to add rows: " + (err as Error).message);
                  } finally {
                      setAddingRows(false);
                  }
                  }
              }}
              disabled={addingRows}
              className="bg-purple-500 text-white px-3 py-1 rounded disabled:opacity-50"
              >
              {addingRows ? "Adding rows..." : "⚡ Add 100k Rows"}
          </button>
          <GlobalFilterPopover
            columns={table.columns}
            filters={filters}
            setFilters={setFilters}
          />
          <GlobalSortPopover
            columns={table.columns}
            sort={sort}
            setSort={setSort}
          />
          <div className="flex-shrink-0">
            <input
              type="text"
              placeholder="🔍 Search across all cells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1 border rounded w-full max-w-sm"
            />
          </div>
        </div>


        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* progress indicator */}
          {addingRows && (
              <p className="text-sm text-gray-500 mt-2">
                  ⏳ Please wait... Generating 100,000 rows. This may take a few seconds.
              </p>
          )}

          {/* <div className="mb-4">
            <label htmlFor="view-select" className="mr-2 font-medium">View:</label>
            <select
              id="view-select"
              className="px-2 py-1 border rounded"
              onChange={(e) => {
                const view = views?.find(v => v.id === e.target.value);
                // setSelectedView(view ?? null);
                if (!view) {
                  setSelectedView(null);
                  setSearchQuery("");        // ✅ clear search
                  // setSort(undefined);
                  setSort([]);
                  setFilters({})
                  setColumnVisibility({});
                  
                } else {
                  const config = view.config as ViewConfig;
                  setSelectedView(view);
                  setFilters(config.filters ?? {});
                  // setSort(config.sort ?? undefined);
                  setSort(Array.isArray(config.sort) ? config.sort : []);
                  setSearchQuery(config.search ?? "");

                  const hiddenCols = config.hiddenColumns ?? [];
                  const visibility = Object.fromEntries(
                  table?.columns.map((col) => [col.id, !hiddenCols.includes(col.id)]) ?? []
                  );
                  setColumnVisibility(visibility);
                                  
                }
              }}
            >
              <option value="">Default View</option>
              {views?.map(view => (
                <option key={view.id} value={view.id}>{view.name}</option>
              ))}
            </select>
          </div> */}

          {/* <div className="mb-4">
            <label htmlFor="view-name" className="mr-2 font-medium">Save Current View:</label>
            <input
              id="view-name"
              type="text"
              placeholder="View name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="px-2 py-1 border rounded mr-2"
            />
            <button
              className="bg-gray-800 text-white px-3 py-1 rounded"
              onClick={() => {
                if (!viewName.trim()) return alert("Enter a name");

                console.log("Saving view with sort:", sort);
                const hiddenColumns = Object.entries(columnVisibility)
                  .filter(([, isVisible]) => !isVisible)
                  .map(([colId]) => colId);

                saveView.mutate({
                  tableId,
                  name: viewName.trim(),
                  config: {
                    search: searchQuery || undefined,
                    sort: Array.isArray(sortConfig) ? sortConfig : sortConfig ? [sortConfig] : [],
                    filters: filters || undefined,        
                    hiddenColumns,
                  },
                });
                
                setViewName(""); // clear input after saving
              }}
            >
              💾 Save View
            </button>
          </div> */}


        </div>
        

        <div
          className="h-[600px] overflow-auto border relative"
          ref={parentRef}
        >
          {/* Sticky header table */}
          <table className="table-fixed border-collapse absolute top-0 left-0 z-10 bg-white">
            <colgroup>
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

            <thead>
              {tableInstance.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border px-2 py-2"
                      style={{ height: '40px' }}
                    >
                      <div className="flex justify-between items-center">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          </table>

          {/* Virtualised body */}
          <div
            style={{ height: totalHeight, position: 'relative' }}
            className="pt-[40px]"
          >
            <table className="table-fixed border-collapse absolute top-0 left-0">
              <colgroup>
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
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border px-2 py-2 text-left bg-gray-100"
                        style={{
                          height: '40px',
                        }}
                      >
                        <div className="flex justify-between items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>

              <tbody>
                <tr>
                  <td colSpan={tableInstance.getAllLeafColumns().length} style={{ height: totalHeight, position: 'relative' }}>
                    <div className="absolute top-0 left-0 w-full">
                      {virtualRows.map((virtualRow) => {
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
                            // key={row.id}
                            key={`${row.id}-${virtualRow.index}`}
                            ref={virtualizer.measureElement}
                            style={{
                              position: 'absolute',
                              transform: `translateY(${virtualRow.start}px)`,
                              height: `${virtualRow.size}px`,
                              display: 'flex',
                            }}
                            className="hover:bg-gray-100 transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <div
                                key={cell.id}
                                className="border px-2 py-2 leading-snug"
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
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>




      </div>
    </div>
  );
}

