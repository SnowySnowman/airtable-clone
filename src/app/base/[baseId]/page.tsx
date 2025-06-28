// 'use client';

// import { useParams } from 'next/navigation';
// import { useState } from 'react';
// import Link from 'next/link';
// import { api } from '~/trpc/react';

// export default function BasePage() {
//   const params = useParams();
//   const baseId = params?.baseId as string;

//   const { data: base, isLoading, refetch } = api.base.getOne.useQuery({ baseId });
//   const createTable = api.table.create.useMutation({
//     onSuccess: () => {
//       refetch(); // Refresh table list after creation
//     },
//   });

//   const [newTableName, setNewTableName] = useState('');

//   const handleCreateTable = async () => {
//     if (!newTableName.trim()) return;
//     await createTable.mutateAsync({ baseId, name: newTableName });
//     setNewTableName('');
//   };

//   const renameTable = api.table.rename.useMutation({
//      onSuccess: () => refetch(), // or invalidateQueries if you're using tRPC context
//   });

//   const deleteTable = api.table.delete.useMutation({
//     onSuccess: () => refetch(),
//   });


//   if (isLoading) return <p className="p-4">Loading...</p>;
//   if (!base) return <p className="p-4">Base not found.</p>;

//   return (
//     <div className="p-4">
//       <h1 className="text-2xl font-bold mb-4">Base: {base.name}</h1>

//       {/* Create Table Form */}
//       <div className="mb-6">
//         <input
//           type="text"
//           value={newTableName}
//           onChange={(e) => setNewTableName(e.target.value)}
//           placeholder="Enter table name"
//           className="border p-2 mr-2 rounded"
//         />
//         <button
//           onClick={handleCreateTable}
//           className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
//         >
//           Create Table
//         </button>
//       </div>

//       {/* Table List */}
//       <h2 className="text-xl font-semibold mb-2">Tables</h2>
//       <ul className="space-y-2">
//         {base.tables.map((table) => (
//             <li key={table.id} className="border p-3 rounded flex justify-between items-center">
//                 <Link href={`/table/${table.id}`} className="font-medium">{table.name}</Link>
//                 <div className="space-x-2">
//                 <button
//                     onClick={() => {
//                     const newName = prompt("Rename table:", table.name);
//                     if (newName && newName !== table.name) {
//                         renameTable.mutate({ tableId: table.id, name: newName });
//                     }
//                     }}
//                     className="text-sm text-blue-600"
//                 >
//                     Rename
//                 </button>
//                 <button
//                     onClick={() => {
//                     if (confirm("Are you sure you want to delete this table?")) {
//                         deleteTable.mutate({ tableId: table.id });
//                     }
//                     }}
//                     className="text-sm text-red-600"
//                 >
//                     Delete
//                 </button>
//                 </div>
//             </li>
//             ))}

//       </ul>
//     </div>
//   );
// }

"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import TablePage from "../../table/[id]/page";

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
  // const currentTableId = activeTableId ?? (tables?.[0]?.id ?? null);
  let currentTableId = activeTableId;
  // if (!currentTableId && tables.length > 0) {
  //   currentTableId = tables[0]!.id;
  // }
  if (!currentTableId && tables?.length > 0 && tables[0]?.id) {
    currentTableId = tables[0].id;
  }


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

