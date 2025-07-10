// "use client";

// import { api } from "~/trpc/react";
// import Link from "next/link";
// import { useState } from "react";

// export default function DashboardPage() {
//   const { data: bases, isLoading, refetch } = api.base.getAll.useQuery();
//   const createBase = api.base.create.useMutation({
//   onSuccess: async () => {
//     await refetch(); // make sure to use await
//   },
// });
//   const [newBaseName, setNewBaseName] = useState("");

//   const handleCreate = async () => {
//     if (!newBaseName.trim()) {
//       alert("Base name cannot be empty.");
//       return;
//     }

//     try {
//       await createBase.mutateAsync({ name: newBaseName.trim() });
//       setNewBaseName("");
//     } catch (err) {
//       console.error("❌ Create base failed:", err);
//       alert("Failed to create base. Check console.");
//     }
//   };

//   if (isLoading) return <p>Loading your bases...</p>;

//   return (
//     <div className="p-4">
//       <h1 className="text-xl font-bold mb-4">Your Bases</h1>

//       {/* New Base Form */}
//       <div className="mb-6">
//         <input
//           value={newBaseName}
//           onChange={(e) => setNewBaseName(e.target.value)}
//           placeholder="Enter base name"
//           className="border p-2 mr-2 rounded"
//         />
//         <button
//           onClick={handleCreate}
//           className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
//         >
//           Create Base
//         </button>
//       </div>

//       {/* List of bases */}
//       <ul className="space-y-2">
//         {bases?.map((base) => (
//           <li key={base.id} className="border p-3 rounded hover:bg-gray-100">
//             <Link href={`/base/${base.id}`}>
//               <div className="font-medium">{base.name}</div>
//               <div className="text-sm text-gray-600">{base.tables.length} table(s)</div>
//             </Link>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }


"use client";

import { api } from "~/trpc/react";
import Link from "next/link";
import { useState } from "react";

export default function DashboardPage() {
  const { data: bases, isLoading, refetch } = api.base.getAll.useQuery();
  const createBase = api.base.create.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const [newBaseName, setNewBaseName] = useState("");

  const handleCreate = async (newBaseName: string) => {
    if (!newBaseName.trim()) {
      alert("Base name cannot be empty.");
      return;
    }

    try {
      await createBase.mutateAsync({ name: newBaseName.trim() });
      setNewBaseName("");
    } catch (err) {
      console.error("❌ Create base failed:", err);
      alert("Failed to create base. Check console.");
    }
  };

  if (isLoading) return <p className="text-sm text-gray-600 px-6 py-4">Loading your bases...</p>;

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Workspace</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Create New Base Card */}
        <div className="border-dashed border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
             onClick={() => {
              const name = prompt("Enter a name for your new base:");
              if (name?.trim()) {
                handleCreate(name); // ✅ directly use the name
              }
            }}>
          <svg className="w-8 h-8 text-gray-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14m7-7H5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-medium text-gray-600">Add a base</span>
        </div>

        {/* Existing Bases */}
        {bases?.map((base) => (
          <Link key={base.id} href={`/base/${base.id}`}>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md hover:border-blue-400 transition cursor-pointer">
              <div className="font-medium text-gray-800 truncate">{base.name}</div>
              <div className="text-sm text-gray-500 mt-1">{base.tables.length} table(s)</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
