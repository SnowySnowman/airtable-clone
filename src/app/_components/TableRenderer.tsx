// "use client";

// import { api } from "~/trpc/react";
// import {
//   useReactTable,
//   getCoreRowModel,
//   flexRender,
// } from "@tanstack/react-table";
// import type { ColumnDef } from "@tanstack/react-table";
// import { useMemo } from "react";
// import { faker } from '@faker-js/faker';

// // Type for a row of table data
// type TableRow = {
//   id: string;
//   [key: string]: string | number;
// };

// interface TableRendererProps {
//   tableId: string;
// }

// export default function TableRenderer({ tableId }: TableRendererProps) {
//   const { data: table, isLoading, refetch } = api.table.getTableById.useQuery({ tableId });

//   const utils = api.useUtils(); // for trpc context cache

//   const updateCell = api.table.updateCell.useMutation({
//     // Optimistically update the cache
//     onMutate: async ({ tableId, rowId, columnId, value }) => {
//       await utils.table.getTableById.cancel(); // Cancel any outgoing queries
//       const previousData = utils.table.getTableById.getData({ tableId });

//       // Optimistically update local cache
//       utils.table.getTableById.setData({ tableId }, (old) => {
//         if (!old) return old;

//         return {
//           ...old,
//           rows: old.rows.map((row) =>
//             row.id === rowId
//               ? {
//                   ...row,
//                   values: {
//                     ...row.values,
//                     [columnId]: value,
//                   },
//                 }
//               : row
//           ),
//         };
//       });

//       return { previousData };
//     },

//     onError: (err, _input, context) => {
//       // Rollback on failure
//       if (context?.previousData) {
//         utils.table.getTableById.setData(
//           { tableId: _input.tableId },
//           context.previousData
//         );
//       }
//     },

//     onSettled: (_data, _error, variables) => {
//       // Optionally refetch to re-sync
//       utils.table.getTableById.invalidate({ tableId: variables.tableId });
//     },
//   });

//   const addColumn = api.table.addColumn.useMutation({ onSuccess: () => refetch() });
//   const renameColumn = api.table.renameColumn.useMutation({ onSuccess: () => refetch() });
//   const deleteColumn = api.table.deleteColumn.useMutation({ onSuccess: () => refetch() });
//   const addRow = api.table.addRow.useMutation({ onSuccess: () => refetch() });
//   const addFakeRows = api.table.addFakeRows.useMutation({
//     onSuccess: () => refetch(),
//   });


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
//             if (confirm("Delete this column?"))
//               deleteColumn.mutate({ columnId: col.id });
//           }}>🗑️</button>
//         </div>
//       ),
//       cell: ({ getValue, row, column }) => (
//         <input
//           className="border px-2 py-1 w-full"
//           value={getValue() as string}
//           onChange={(e) => {
//             tableInstance.options.meta?.updateData?.(
//               row.index,
//               column.id,
//               e.target.value
//             );
//           }}
//           onBlur={(e) => {
//             const newValue = e.target.value;
//             if (newValue !== getValue()) {
//               updateCell.mutate({
//                 tableId,
//                 rowId: row.original.id,
//                 columnId: column.id,
//                 value: newValue,
//               }, {
//                 onSuccess: () => {
//                   refetch(); // pull updated values from DB
//                 }
//               });
//             }
//           }}

//         />
//       ),
//     }));
//   }, [table, tableId]);

//   // const data = useMemo<TableRow[]>(() => {
//   //   if (!table) return [];
//   //   return table.rows.map((row) => {
//   //     const values = row.values as Record<string, string | number>;
//   //     return {
//   //       id: row.id,
//   //       ...values,
//   //     };
//   //   });
//   // }, [table?.rows]);

//   const tableInstance = useReactTable({
//     data,
//     columns,
//     getCoreRowModel: getCoreRowModel(),
//   });

//   if (isLoading) return <p className="p-4">Loading table...</p>;
//   if (!table) return <p className="p-4">Table not found.</p>;

//   return (
//     <div className="p-4">
//       <div className="mb-4">
//         <button
//           onClick={() => {
//             const name = prompt("Column name?");
//             if (!name) return;
//             const type = prompt("Type (text/number)?", "text");
//             if (!["text", "number"].includes(type ?? "")) return alert("Invalid type");

//             addColumn.mutate({ tableId, name, type: type as "text" | "number" });
//           }}
//           className="bg-green-500 text-white px-3 py-1 rounded"
//         >
//           ➕ Add Column
//         </button>
//         <div className="mb-4 space-x-2">
//         <button
//           onClick={() => {
//             addColumn.mutate({ tableId, name: "New Column", type: "text" });
//           }}
//           className="bg-green-500 text-white px-3 py-1 rounded"
//         >
//           ➕ Add Column
//         </button>

//         <button
//           onClick={() => addRow.mutate({ tableId })}
//           className="bg-blue-500 text-white px-3 py-1 rounded"
//         >
//           ➕ Add Row
//         </button>

//         <button
//           onClick={() => {
//             const confirm = window.confirm("This will add 100,000 rows. Continue?");
//             if (confirm) addFakeRows.mutate({ tableId, count: 100000 });
//           }}
//           className="bg-red-500 text-white px-3 py-1 rounded"
//         >
//           ⚠️ Add 100k Fake Rows
//         </button>
//       </div>

//       </div>

//       <table className="w-full table-auto border-collapse">
//         <thead>
//           {tableInstance.getHeaderGroups().map((group) => (
//             <tr key={group.id}>
//               {group.headers.map((header) => (
//                 <th key={header.id} className="border p-2 bg-gray-100">
//                   {flexRender(header.column.columnDef.header, header.getContext())}
//                 </th>
//               ))}
//             </tr>
//           ))}
//         </thead>
//         <tbody>
//           {tableInstance.getRowModel().rows.map((row) => (
//             <tr key={row.id}>
//               {row.getVisibleCells().map((cell) => (
//                 <td key={cell.id} className="border p-2">
//                   {flexRender(cell.column.columnDef.cell, cell.getContext())}
//                 </td>
//               ))}
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

"use client";

import { api } from "~/trpc/react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

// Type for a row of table data
type TableRow = {
  id: string;
  [key: string]: string | number;
};

interface TableRendererProps {
  tableId: string;
}

type TableMetaType = {
  updateData: (rowIndex: number, columnId: string, value: string) => void;
};

export default function TableRenderer({ tableId }: TableRendererProps) {
  const { data: table, isLoading, refetch } = api.table.getTableById.useQuery({ tableId });
  const utils = api.useUtils();

  const updateCell = api.table.updateCell.useMutation({
    onMutate: async ({ tableId, rowId, columnId, value }) => {
      await utils.table.getTableById.cancel();
      const previousData = utils.table.getTableById.getData({ tableId });

      utils.table.getTableById.setData({ tableId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          rows: old.rows.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  values: {
                    ...((row.values ?? {}) as Record<string, any>),
                    [columnId]: value,
                  },
                }
              : row
          ),
        };
      });

      return { previousData };
    },

    onError: (_err, input, context) => {
      if (context?.previousData) {
        utils.table.getTableById.setData({ tableId: input.tableId }, context.previousData);
      }
    },

    onSettled: (_data, _error, variables) => {
      utils.table.getTableById.invalidate({ tableId: variables.tableId });
    },
  });

  const addColumn = api.table.addColumn.useMutation({ onSuccess: () => refetch() });
  const renameColumn = api.table.renameColumn.useMutation({ onSuccess: () => refetch() });
  const deleteColumn = api.table.deleteColumn.useMutation({ onSuccess: () => refetch() });
  const addRow = api.table.addRow.useMutation({ onSuccess: () => refetch() });
  const addFakeRows = api.table.addFakeRows.useMutation({ onSuccess: () => refetch() });

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
    if (!table) return [];

    return table.columns.map((col) => ({
      accessorKey: col.id,
      size: 150,
      header: () => (
        <div className="flex items-center space-x-2">
          <span>{col.name}</span>
          <button onClick={() => {
            const newName = prompt("Rename column:", col.name);
            if (newName) renameColumn.mutate({ columnId: col.id, name: newName });
          }}>✏️</button>
          <button onClick={() => {
            if (confirm("Delete this column?")) {
              deleteColumn.mutate({ columnId: col.id });
            }
          }}>🗑️</button>
        </div>
      ),
      cell: ({ getValue, row, column }) => (
        <input
          className="w-full px-2 py-1 border box-border"
          value={getValue() as string}
          onChange={(e) => {
            (tableInstance.options.meta as TableMetaType)?.updateData?.(
              row.index,
              column.id,
              e.target.value
            );
          }}
          onBlur={(e) => {
            const newValue = e.target.value;
            if (newValue !== getValue()) {
              updateCell.mutate({
                tableId,
                rowId: row.original.id,
                columnId: column.id,
                value: newValue,
              }, {
                onSuccess: () => refetch(),
              });
            }
          }}
        />
      ),
    }));
  }, [table, tableId]);

  const data = useMemo<TableRow[]>(() => {
    if (!table) return [];
    return table.rows.map((row) => ({
      id: row.id,
      ...(row.values as Record<string, string | number>),
    }));
  }, [table]);

  // const tableInstance = useReactTable({
  //   data,
  //   columns,
  //   getCoreRowModel: getCoreRowModel(),
  //   columnResizeMode: "onChange",
  // });

  const tableInstance = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    meta: {
      updateData: (rowIndex: number, columnId: string, value: string) => {
        const rowId = data[rowIndex].id;
        updateCell.mutate({
          tableId,
          rowId,
          columnId,
          value,
        });
      },
    },
  } as any); // 👈 prevent type conflict



  if (isLoading) return <p className="p-4">Loading table...</p>;
  if (!table) return <p className="p-4">Table not found.</p>;

  return (
    <div className="p-4">
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
            const confirm = window.confirm("This will add 100,000 rows. Continue?");
            if (confirm) addFakeRows.mutate({ tableId, count: 100000 });
          }}
          className="bg-red-500 text-white px-3 py-1 rounded"
        >
          ⚠️ Add 100k Fake Rows
        </button>
      </div>

      <div className="overflow-auto border">
        <table className="table-fixed border-collapse w-full">
          <thead>
            {tableInstance.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border px-2 py-2 bg-gray-100"
                    style={{
                      width: `${header.getSize()}px`,
                      minWidth: `${header.getSize()}px`,
                      maxWidth: `${header.getSize()}px`,
                      boxSizing: "border-box",
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {tableInstance.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="border px-2 py-2"
                    style={{
                      width: `${cell.column.getSize()}px`,
                      minWidth: `${cell.column.getSize()}px`,
                      maxWidth: `${cell.column.getSize()}px`,
                      boxSizing: "border-box",
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
