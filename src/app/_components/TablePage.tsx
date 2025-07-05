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
//   const [sort, setSort] = useState<{ columnId: string; order: "asc" | "desc" } | undefined>();
//   const [sort, setSort] = useState<Array<{ columnId: string; order: "asc" | "desc" }>>([]);
  const [sort, setSort] = useState<{ columnId: string; order: "asc" | "desc" }[]>([]);

  const [addingRows, setAddingRows] = useState(false);

  // const { data: table, isLoading, refetch } = api.table.getTableById.useQuery({ tableId });
  const { data: table, isLoading, refetch } = api.table.getTableById.useQuery({ tableId }, {
    refetchOnWindowFocus: false, // prevents double-fetching
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.table.getRows.useInfiniteQuery(
    { tableId, 
      limit: 1000, 
    //   search: (selectedView?.config as ViewConfig | undefined)?.search ?? debouncedSearch,
    //   sort: sort,
    //   filters: selectedView?.config?.filters ?? filters
    search: isViewConfig(selectedView?.config) ? selectedView.config.search ?? debouncedSearch : debouncedSearch,
    sort: isViewConfig(selectedView?.config) ? selectedView.config.sort ?? sort : sort,
    filters: isViewConfig(selectedView?.config) ? selectedView.config.filters ?? filters : filters,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
      enabled: !!tableId,
    }
  );

  useEffect(() => {
    if (!data) return;
    const allRows = data.pages.flatMap((p) => p.rows);
    setRowCount(allRows.length + (data.pages.at(-1)?.nextCursor ? 1 : 0));
  }, [data]);

  
  const [localEdits, setLocalEdits] = useState<Map<string, Map<string, string>>>(new Map());

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});


  const updateCell = api.table.updateCell.useMutation();
  // const addColumn = api.table.addColumn.useMutation({ onSuccess: () => refetch() });
  const addColumn = api.table.addColumn.useMutation({
    onSuccess: async () => {
      await utils.table.getTableById.invalidate({ tableId });
    },
  });
  const renameColumn = api.table.renameColumn.useMutation({ onSuccess: () => refetch() });
  const deleteColumn = api.table.deleteColumn.useMutation({ onSuccess: () => refetch() });
  const addRow = api.table.addRow.useMutation({ onSuccess: () => refetch() });
  const addFakeRows = api.table.addFakeRows.useMutation({
    onSuccess: async () => {
        console.log("✅ 100k rows added successfully");
        await utils.table.getTableById.invalidate({ tableId });
        await refetch(); // <-- ensure visible update
    },
    onError: (err) => {
        console.error("❌ Failed to add 100k rows:", err);
        alert("Error adding 100k rows: " + err.message);
    },
    });

  const utils = api.useUtils();
  // const saveView = api.table.saveView.useMutation({
  //   onSuccess: () => {
  //     utils.table.getViews.invalidate({ tableId }); // refresh views after save
  //   },
  // });

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


  const flatRows = useMemo<TableRow[]>(() => {
    return (
      data?.pages.flatMap((page) =>
        page.rows.map((row) => ({
          id: row.id,
          ...(typeof row.values === "object" && row.values !== null
          ? row.values as Record<string, string | number>
          : {})
      }))
      ) ?? []
    );
  }, [data, searchQuery]);
  console.log("DEBUG flatRows:", flatRows);

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
  if (!table) return [];

  return table.columns.map((col, index) => ({
    // accessorKey: col.id, // ✅ This must match the key in each row object (e.g., "cmc8oxj850004931czdjayteu")
    // size: 150,
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
            const trimmed = editingValue.trim();
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

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 47,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  useEffect(() => {
    const last = virtualRows.at(-1);
    if (!last) return;
    if (last.index >= flatRows.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualRows, flatRows.length, hasNextPage, isFetchingNextPage, searchQuery]);

  // if (isLoading) return <p className="p-4">Loading table...</p>;
  if (isLoading || !table?.columns?.length) return <p className="p-4">Loading table...</p>;
  if (!table) return <p className="p-4">Table not found.</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{table.name}</h1>
      {viewSavedMessage && (
        <div className="mb-4 px-4 py-2 bg-green-100 border border-green-400 text-green-700 rounded shadow">
          {viewSavedMessage}
        </div>
      )}
      <div className="mb-4 space-x-2">
        {/* 🔧 Column Visibility Toggles */}
        <div className="mb-4 space-x-3 flex flex-wrap items-center">
        <span className="font-medium mr-2">Toggle columns:</span>
        {tableInstance.getAllLeafColumns().map((col) => (
            <label key={col.id} className="text-sm mr-3">
            <input
                type="checkbox"
                checked={col.getIsVisible()}
                onChange={col.getToggleVisibilityHandler()}
                className="mr-1"
            />
            {table.columns.find(c => c.id === col.id)?.name || col.id}
            </label>
        ))}
        </div>

        <button
          onClick={() => {
            const name = prompt("Column name?");
            if (!name) return;
            const type = prompt("Type (text/number)?", "text");
            if (!["text", "number"].includes(type ?? "")) return alert("Invalid type");

            addColumn.mutate({ tableId, name, type: type as "text" | "number" });
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
                    await utils.table.getRows.invalidate(); // Clear cache
                    await refetch(); // Re-fetch first page to see new rows
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

        {/* progress indicator */}
        {addingRows && (
            <p className="text-sm text-gray-500 mt-2">
                ⏳ Please wait... Generating 100,000 rows. This may take a few seconds.
            </p>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Search across all cells..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border rounded w-full max-w-sm"
          />
        </div>
        <div className="mb-4">
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
        </div>

        <div className="mb-4">
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
        </div>


      </div>

      <div className="h-[600px] overflow-auto border" ref={parentRef}>
        {/* Static Header */}
        <table className="table-fixed border-collapse">
          <colgroup>
            {tableInstance.getFlatHeaders().map((header) => (
              <col
                key={header.id}
                style={{
                  width: `${header.getSize?.() ?? 150}px`,
                  minWidth: `${header.getSize?.() ?? 150}px`,
                  maxWidth: `${header.getSize?.() ?? 150}px`,
                }}
              />
            ))}
          </colgroup>
          {/* <thead>
            {tableInstance.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border px-2 py-2 bg-gray-100"
                    style={{ boxSizing: "border-box" }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead> */}
          <thead>
            {tableInstance.getHeaderGroups().map((group) => (
                <React.Fragment key={group.id}>
                <tr>
                    {group.headers.map((header) => (
                    <th
                        key={header.id}
                        className="border px-2 py-2 bg-gray-100"
                        style={{ boxSizing: "border-box" }}
                    >
                          <div className="flex flex-col">
                            <div className="flex justify-between items-center">
                              <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>

                              {/* Sorting dropdown */}
                              {/* <select
                                className="text-xs ml-2"
                                value={
                                  sort?.columnId === header.id ? sort.order : ""
                                }
                                
                                onChange={(e) => {
                                  const order = e.target.value;
                                  const newSort = order
                                    ? { columnId: header.id, order: order as "asc" | "desc" }
                                    : undefined;
                                  console.log("sort selected:", newSort); // <-- optional debug
                                  setSort(newSort);
                                  setSortConfig(newSort);
                                }}

                              > */}
                              <select
                                value={sort.find(s => s.columnId === header.id)?.order || ""}
                                onChange={(e) => {
                                    const order = e.target.value as "asc" | "desc" | "";
                                    setSort((prev) => {
                                    const other = prev.filter((s) => s.columnId !== header.id);
                                    return order ? [...other, { columnId: header.id, order }] : other;
                                    });
                                }}
                                >

                                <option value="">⇅</option>
                                <option value="asc">↑ A–Z / 1–9</option>
                                <option value="desc">↓ Z–A / 9–1</option>
                              </select>
                            </div>
                          </div>

                    </th>
                    ))}
                </tr>

                {/* ✅ Filter row below headers */}
                <tr>
                    {group.headers.map((header) => {
                      const col = table.columns.find(c => c.id === header.id);
                      if (!col) return <th key={header.id}></th>;
                      // if (!col) return <th key={header.id} className="border px-2 py-1" />;

                      // Ensure type is lowercase 'number' or 'text'
                      const colType = col.type.toLowerCase() as "number" | "text";

                      return (
                        <th key={header.id} className="border px-2 py-1">
                          <div className="space-y-1">
                            {/* Operator select */}
                            <select
                              className="w-full text-sm"
                              value={filters[header.id]?.op || ""}
                              onChange={(e) => {
                                const op = e.target.value;
                                setFilters((prev) => ({
                                  ...prev,
                                  [header.id]: {
                                    type: colType,
                                    op,
                                    value: op.includes("empty") ? null : prev[header.id]?.value ?? "",
                                  },
                                }));
                              }}
                            >
                              <option value="">--</option>

                              {colType === "number" ? (
                                <>
                                  <option value=">">greater than</option>
                                  <option value="<">less than</option>
                                </>
                              ) : (
                                <>
                                  <option value="equals">equals</option>
                                  <option value="contains">contains</option>
                                  <option value="not_contains">not contains</option>
                                  <option value="is_empty">is empty</option>
                                  <option value="is_not_empty">is not empty</option>
                                </>
                              )}
                            </select>

                            {/* Value input, only show if not empty check */}
                            {typeof filters[header.id]?.op === "string" &&
                            !filters[header.id]!.op!.includes("empty") && (
                              <input
                                className="w-full text-sm"
                                type={colType === "number" ? "number" : "text"}
                                value={filters[header.id]?.value ?? ""}
                                onChange={(e) => {
                                  const value = colType === "number" ? Number(e.target.value) : e.target.value;
                                  setFilters((prev) => ({
                                    ...prev,
                                    [header.id]: {
                                      type: colType,
                                      op: prev[header.id]?.op ?? "",
                                      value,
                                    },
                                  }));
                                }}
                              />
                            )}
                          </div>
                        </th>
                      );
                    })}
                </tr>
                </React.Fragment>
            ))}
            </thead>

        </table>

        {/* Virtualised Body */}
        <div
          style={{ height: totalHeight, position: "relative" }}
          className="relative w-full"
        >
          <table className="table-fixed border-collapse absolute top-0 left-0">
            <colgroup>
              {tableInstance.getFlatHeaders().map((header) => (
                <col
                  key={header.id}
                  style={{
                    width: `${header.getSize?.() ?? 150}px`,
                    minWidth: `${header.getSize?.() ?? 150}px`,
                    maxWidth: `${header.getSize?.() ?? 150}px`,
                  }}
                />
              ))}
            </colgroup>
            <tbody>
              {virtualRows.map((virtualRow) => {
                const row = tableInstance
                  .getRowModel()
                  .rows.find((r) => r.index === virtualRow.index);
                if (!row) return null;

                return (
                  <tr
                    key={row.id}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border px-2 py-2 leading-snug align-top"
                        style={{ boxSizing: "content-box" }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}

