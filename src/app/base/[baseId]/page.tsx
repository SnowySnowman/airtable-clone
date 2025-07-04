"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import TablePage from "~/app/_components/TablePage";

export default function BasePage() {
  const router = useRouter();
  const { baseId } = useParams<{ baseId: string }>();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  const { data: base, isLoading, refetch } = api.base.getOne.useQuery({ baseId });
  const createTable = api.table.create.useMutation({
    onSuccess: async (newTable) => {
      await refetch();
      setActiveTableId(newTable.id); // Auto-switch to new table
    },
  });

  const renameTable = api.table.rename.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteTable = api.table.delete.useMutation({
    onSuccess: () => {
      refetch();
      setActiveTableId(null); // fallback if active one is deleted
    },
  });

  if (isLoading) return <p className="p-4">Loading base...</p>;
  if (!base) return <p className="p-4">Base not found.</p>;

  const tables = base?.tables ?? [];
  let currentTableId: string | null = activeTableId;
  if (!currentTableId && tables.length > 0 && tables[0]?.id) {
    currentTableId = tables[0].id;
  }

  // const currentTableId = activeTableId || (tables.length > 0 ? tables[0].id : null);
  

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{base.name}</h1>

      {/* Tabs for tables */}
      <div className="flex items-center mb-4 space-x-2">
        {tables.map((table) => {

          return (
            <div key={table.id} className="relative">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setActiveTableId(table.id)}
                  className={`px-4 py-2 rounded-t ${
                    table.id === currentTableId
                      ? "bg-white border-t border-l border-r"
                      : "bg-gray-200"
                  }`}
                >
                  {table.name}
                </button>

                {/* ▼ Arrow for dropdown */}
                <button
                  onClick={() =>
                    setOpenDropdown(openDropdown === table.id ? null : table.id)
                  }
                  className="px-2 py-2 rounded-t bg-gray-300 hover:bg-gray-400"
                >
                  ▼
                </button>
              </div>

              {/* Dropdown menu */}
              {openDropdown === table.id && (
                <div className="absolute right-0 mt-1 bg-white border rounded shadow z-10">
                  <button
                    onClick={() => {
                      const newName = prompt("Rename table", table.name);
                      if (newName) {
                        renameTable.mutate({ tableId: table.id, name: newName });
                      }
                      setOpenDropdown(null);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    📝 Rename
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this table?")) {
                        deleteTable.mutate({ tableId: table.id });
                      }
                      setOpenDropdown(null);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-red-100 text-red-600"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* New Table button */}
        <button
          onClick={() => {
            const name = prompt("New table name?");
            if (name) createTable.mutate({ baseId, name });
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          + New Table
        </button>
      </div>

      {/* Render selected table in full */}
      {currentTableId ? <TablePage tableId={currentTableId} /> : <p className="text-gray-500">No table selected</p>}
    </div>
  );
}

