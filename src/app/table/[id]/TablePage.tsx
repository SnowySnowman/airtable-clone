// "use client";

// import { api } from '~/trpc/react';
// import {
//   useReactTable,
//   getCoreRowModel,
//   flexRender,
// } from '@tanstack/react-table';
// import type { ColumnDef } from '@tanstack/react-table';
// import { useMemo, useRef, useEffect, useState } from 'react';
// import { useVirtualizer } from '@tanstack/react-virtual';

// // Type for a row of table data
// type TableRow = {
//   id: string;
//   [key: string]: string | number;
// };

// type TablePageProps = {
//   tableId: string;
// };

// export default function TablePage({ tableId }: TablePageProps) {
//   const [rowCount, setRowCount] = useState(0);

//   const { data: table, isLoading, refetch } = api.table.getTableById.useQuery({ tableId });
//   const {
//     data,
//     fetchNextPage,
//     hasNextPage,
//     isFetchingNextPage,
//   } = api.table.getRows.useInfiniteQuery(
//     { tableId, limit: 1000 },
//     {
//       getNextPageParam: (lastPage) => lastPage.nextCursor,
//       keepPreviousData: true,
//       onSuccess: (data) => {
//         const total = data.pages.reduce((acc, page) => acc + page.rows.length, 0);
//         setRowCount(total);
//       },
//     }
//   );

//   const utils = api.useUtils();

//   const addColumn = api.table.addColumn.useMutation({ onSuccess: () => refetch() });
//   const renameColumn = api.table.renameColumn.useMutation({ onSuccess: () => refetch() });
//   const deleteColumn = api.table.deleteColumn.useMutation({ onSuccess: () => refetch() });

//   const addRow = api.table.addRow.useMutation({ onSuccess: () => refetch() });
//   const addFakeRows = api.table.addFakeRows.useMutation({ onSuccess: () => refetch() });

//   const updateCell = api.table.updateCell.useMutation({
//     onMutate: async ({ tableId, rowId, columnId, value }) => {
//       await utils.table.getTableById.cancel();
//       const previousData = utils.table.getTableById.getData({ tableId });
//       utils.table.getTableById.setData({ tableId }, (old) => {
//         if (!old) return old;
//         return {
//           ...old,
//           rows: old.rows.map((row) =>
//             row.id === rowId ? { ...row, values: { ...row.values, [columnId]: value } } : row
//           ),
//         };
//       });
//       return { previousData };
//     },
//     onError: (_err, _input, context) => {
//       if (context?.previousData) {
//         utils.table.getTableById.setData({ tableId: _input.tableId }, context.previousData);
//       }
//     },
//     onSettled: (_data, _error, variables) => {
//       utils.table.getTableById.invalidate({ tableId: variables.tableId });
//     },
//   });

//   const flatRows = useMemo(() => {
//     return (
//       data?.pages.flatMap((page) =>
//         page.rows.map((row) => ({
//           id: row.id,
//           ...row.values, // flatten the `values` JSON field into top-level columns
//         }))
//       ) ?? []
//     );
//   }, [data]);



//   const columns = useMemo<ColumnDef<TableRow>[]>(() => {
//     if (!table) return [];
//     return table.columns.map((col) => ({
//       accessorKey: col.id,
//       header: () => (
//         <div className="flex items-center space-x-2">
//           <span>{col.name}</span>
//           <button onClick={() => {
//             const newName = prompt("Rename column:", col.name);
//             if (newName) renameColumn.mutate({ columnId: col.id, name: newName });
//           }}>✏️</button>
//           <button onClick={() => {
//             if (confirm("Delete this column?")) deleteColumn.mutate({ columnId: col.id });
//           }}>🗑️</button>
//         </div>
//       ),
//       cell: ({ getValue, row, column }) => (
//         <input
//           className="border px-2 py-1 w-full"
//           defaultValue={getValue() as string}
//           onBlur={(e) => {
//             updateCell.mutate({
//               tableId,
//               rowId: row.original.id,
//               columnId: column.id,
//               value: e.target.value,
//             });
//           }}
//         />
//       ),
//     }));
//   }, [table, tableId, updateCell]);

//   const tableInstance = useReactTable({
//     data: flatRows,
//     columns,
//     getCoreRowModel: getCoreRowModel(),
//     getRowId: (row) => row.id,
//   });

//   const parentRef = useRef<HTMLDivElement>(null);
//   const virtualizer = useVirtualizer({
//     count: rowCount,
//     getScrollElement: () => parentRef.current,
//     estimateSize: () => 40,
//     overscan: 10,
//   });

//   const virtualRows = virtualizer.getVirtualItems();
//   const totalHeight = virtualizer.getTotalSize();

//   useEffect(() => {
//   const last = virtualRows.at(-1);
//   if (!last) return;

//   if (last.index >= flatRows.length - 1 && hasNextPage && !isFetchingNextPage) {
//     fetchNextPage();
//   }
// }, [virtualRows, flatRows.length, fetchNextPage, hasNextPage, isFetchingNextPage]);


//   if (isLoading) return <p className="p-4">Loading table...</p>;
//   if (!table) return <p className="p-4">Table not found.</p>;

//   return (
//     <div className="p-4">
//       <h1 className="text-xl font-bold mb-4">{table.name}</h1>
//       <div className="mb-4 space-x-2">
//         <button onClick={() => {
//           const name = prompt("Column name?");
//           if (!name) return;
//           const type = prompt("Type (text/number)?", "text");
//           if (!["text", "number"].includes(type ?? "")) return alert("Invalid type");
//           addColumn.mutate({ tableId, name, type: type as "text" | "number" });
//         }} className="bg-green-500 text-white px-3 py-1 rounded">➕ Add Column</button>

//         <button onClick={() => { addRow.mutate({ tableId }); }} className="bg-blue-500 text-white px-3 py-1 rounded">➕ Add Row</button>

//         <button onClick={() => {
//           if (confirm("Are you sure you want to add 100,000 fake rows?")) {
//             addFakeRows.mutate({ tableId, count: 100000 });
//           }
//         }} className="bg-purple-500 text-white px-3 py-1 rounded">⚡ Add 100k Rows</button>
//       </div>

//       <div ref={parentRef} className="h-[600px] overflow-auto border">
//         <div style={{ height: totalHeight, position: "relative" }}>
//           <table className="absolute top-0 left-0 w-full table-auto border-collapse">
//             <thead>
//               {tableInstance.getHeaderGroups().map((group) => (
//                 <tr key={group.id}>
//                   {group.headers.map((header) => (
//                     <th key={header.id} className="border p-2 bg-gray-100">
//                       {flexRender(header.column.columnDef.header, header.getContext())}
//                     </th>
//                   ))}
//                 </tr>
//               ))}
//             </thead>
//             <tbody>
//               {virtualRows.map((virtualRow) => {
//                 const row = flatRows[virtualRow.index];
//                 if (!row) return null;
                
//                 return (
//                   <tr
//                     key={row.id}
//                     style={{ position: "absolute", top: 0, transform: `translateY(${virtualRow.start}px)` }}
//                   >
//                     {table.columns.map((col) => (
//                       <td key={col.id} className="border p-2">
//                         <input
//                           className="border px-2 py-1 w-full"
//                           defaultValue={String(row.values?.[col.id] ?? "")}
//                           onBlur={(e) => {
//                             updateCell.mutate({
//                               tableId,
//                               rowId: row.id,
//                               columnId: col.id,
//                               value: e.target.value,
//                             });
//                           }}
//                         />
//                       </td>
//                     ))}
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }


'use client';

import { api } from '~/trpc/react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useRef, useEffect, useState } from 'react';

type TableRow = {
  id: string;
  [key: string]: string | number;
};



export default function TablePage({ params }: { params: { id: string } }) {
  const tableId = params.id;
  const [rowCount, setRowCount] = useState(0);
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
    { tableId, limit: 1000 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  useEffect(() => {
    if (!data) return;
    const allRows = data.pages.flatMap((p) => p.rows);
    setRowCount(allRows.length + (data.pages.at(-1)?.nextCursor ? 1 : 0));
  }, [data]);


  const [localEdits, setLocalEdits] = useState<Map<string, Map<string, string>>>(new Map());
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
  const addFakeRows = api.table.addFakeRows.useMutation({ onSuccess: () => refetch() });
  const utils = api.useUtils();
  
  
  function getCellValue(rowId: string, columnId: string, defaultValue: string): string {
    const rowMap = localEdits.get(rowId);
    return rowMap?.get(columnId) ?? defaultValue;
  }


  const flatRows = useMemo<TableRow[]>(() => {
    return (
      data?.pages.flatMap((page) =>
        page.rows.map((row) => ({
          id: row.id,
          ...(row.values ?? {}),
        }))
      ) ?? []
    );
  }, [data]);
  console.log("DEBUG flatRows:", flatRows);

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
  if (!table) return [];

  return table.columns.map((col, index) => ({
    // accessorKey: col.id, // ✅ This must match the key in each row object (e.g., "cmc8oxj850004931czdjayteu")
    // size: 150,
    accessorKey: col.id ?? `col-${index}`, // fallback ID
    size: 150,
    
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
  getCoreRowModel: getCoreRowModel(),
  getRowId: (row) => row.id,
  columnResizeMode: 'onChange', // optional if you want to allow resizing
  defaultColumn: {
    size: 150, // ← default fallback size for any new column
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
  }, [virtualRows, flatRows.length, hasNextPage, isFetchingNextPage]);

  // if (isLoading) return <p className="p-4">Loading table...</p>;
  if (isLoading || !table?.columns?.length) return <p className="p-4">Loading table...</p>;
  if (!table) return <p className="p-4">Table not found.</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{table.name}</h1>

      <div className="mb-4 space-x-2">
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
          onClick={() => {
            if (confirm("Are you sure you want to add 100,000 fake rows?")) {
              addFakeRows.mutate({ tableId, count: 100000 });
            }
          }}
          className="bg-purple-500 text-white px-3 py-1 rounded"
        >
          ⚡ Add 100k Rows
        </button>
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
          <thead>
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

