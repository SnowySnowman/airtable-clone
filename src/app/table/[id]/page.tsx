'use client';

import { useParams } from 'next/navigation';
import { api } from '~/trpc/react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

// Type for a row of table data
type TableRow = {
  id: string;
  [key: string]: string | number;
};

export default function TablePage() {
  const params = useParams();
  const tableId = params?.id as string;

  const { data: table, isLoading } = api.table.getTableById.useQuery({ tableId });

  const updateCell = api.table.updateCell.useMutation();

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
    if (!table) return [];

    return table.columns.map((col) => ({
      accessorKey: col.id,
      header: col.name,
      cell: ({ getValue, row, column }) => (
        <input
          className="border px-2 py-1 w-full"
          defaultValue={getValue() as string}
          onBlur={(e) => {
            updateCell.mutate({
              tableId,
              rowId: row.original.id,
              columnId: column.id,
              value: e.target.value,
            });
          }}
        />
      ),
    }));
  }, [table, tableId, updateCell]);

  const data = useMemo<TableRow[]>(() => {
    if (!table) return [];

    return table.rows.map((row) => {
      const values = row.values as Record<string, string | number>;
      return {
        id: row.id,
        ...values,
      };
    });
  }, [table]);

  const tableInstance = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <p className="p-4">Loading table...</p>;
  if (!table) return <p className="p-4">Table not found.</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{table.name}</h1>
      <table className="w-full table-auto border-collapse">
        <thead>
          {tableInstance.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="border p-2 bg-gray-100">
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
                <td key={cell.id} className="border p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
