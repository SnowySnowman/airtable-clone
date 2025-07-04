"use client";

import { api } from "~/trpc/react";
import Link from "next/link";
import { useState } from "react";

export default function DashboardPage() {
  const { data: bases, isLoading, refetch } = api.base.getAll.useQuery();
  const createBase = api.base.create.useMutation({
  onSuccess: async () => {
    await refetch(); // make sure to use await
  },
});
  const [newBaseName, setNewBaseName] = useState("");

  // const handleCreate = async () => {

  //   console.log("Clicked create")

  //   if (!newBaseName.trim()) return;
    
  //   try {
  //     await createBase.mutateAsync({ name: newBaseName });
  //     setNewBaseName("");
  //     // refetch(); // optionally refresh the list
  //   } catch (err) {
  //     console.error("❌ Create base failed:", err);
  //   }
  // };

  const handleCreate = async () => {
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

  if (isLoading) return <p>Loading your bases...</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Your Bases</h1>

      {/* New Base Form */}
      <div className="mb-6">
        <input
          value={newBaseName}
          onChange={(e) => setNewBaseName(e.target.value)}
          placeholder="Enter base name"
          className="border p-2 mr-2 rounded"
        />
        <button
          onClick={handleCreate}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Create Base
        </button>
      </div>

      {/* List of bases */}
      <ul className="space-y-2">
        {bases?.map((base) => (
          <li key={base.id} className="border p-3 rounded hover:bg-gray-100">
            <Link href={`/base/${base.id}`}>
              <div className="font-medium">{base.name}</div>
              <div className="text-sm text-gray-600">{base.tables.length} table(s)</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
