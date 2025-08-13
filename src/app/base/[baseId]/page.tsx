"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import TablePage from "~/app/_components/TablePage";
import { useEffect } from "react";

export default function BasePage() {
  const router = useRouter();
  const { baseId } = useParams<{ baseId: string }>();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  const { data: base, isLoading, refetch } = api.base.getOne.useQuery({ baseId });

  const [isCreatingTable, setIsCreatingTable] = useState(false);


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
    onError: (err) => {
      console.error("❌ Delete failed:", err);
      alert("Failed to delete table: " + err.message);
    },
  });

  // const tables = base?.tables ?? [];
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (base?.tables) {
      setTables(base.tables);
    }
  }, [base?.tables]);

  const [isBaseMenuOpen, setIsBaseMenuOpen] = useState(false);
  const [baseName, setBaseName] = useState("");
  const baseMenuRef = useRef<HTMLDivElement>(null);

  const updateBaseName = api.base.updateName.useMutation({
    onSuccess: () => refetch(),
  });

  const airtableColors = [
    "#f5d6e0", "#f7e1cf", "#f8eabc", "#d9f4d4", "#d1f3f0", "#d1ebfd", "#d7e2fc", "#f1d4f9", "#e0dafa", "#e6e9ef",
    "#c02c40", "#bc4f22", "#edbc44", "#46872b", "#7adad4", "#7cc8f9", "#496ed9", "#c22fa3", "#773fe5", "#773fe5",
    "#894a5a", "#85513c", "#946a29", "#946a29", "#457d78", "#487b9f", "#4b649b", "#7e4475", "#5f4b88", "#5f4b88",
  ];






  let currentTableId: string | null = activeTableId;
  if (!currentTableId && tables.length > 0 && tables[0]?.id) {
    currentTableId = tables[0].id;
  }

  useEffect(() => {
    if (base?.name) setBaseName(base.name);
  }, [base?.name]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (baseMenuRef.current && !baseMenuRef.current.contains(e.target as Node)) {
        setIsBaseMenuOpen(false);
        if (baseName !== base?.name) {
          updateBaseName.mutate({ baseId, name: baseName });
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [baseMenuRef, baseName, base?.name]);



  if (isLoading) return <p className="p-4">Loading base...</p>;
  if (!base) return <p className="p-4">Base not found.</p>;


  return (

    
    <div className="flex h-screen">
    {/* Leftmost vertical sidebar */}
    <div className="w-12 bg-[#F7F7F7] border-r border-gray-200 flex flex-col items-center py-4">
      

      {/* Add other icons vertically here */}
      <Link href="/dashboard">
        <button className="mb-4 cursor-pointer group relative w-5 h-5">
          {/* Airtable icon (shown normally) */}
          <svg
            className="w-5 h-5 text-gray-600 group-hover:hidden absolute top-0 left-0"
            viewBox="0 0 24 24"
          >
            <use href="/icons/icon_definitions.svg#Airtable" />
          </svg>

          {/* ArrowLeft icon (shown on hover) */}
          <svg
            className="w-5 h-5 text-gray-600 hidden group-hover:block absolute top-0 left-0"
            viewBox="0 0 24 24"
          >
            <use href="/icons/icon_definitions.svg#ArrowLeft" />
          </svg>
        </button>
      </Link>


      <button className="mb-4">
        <svg className="w-5 h-5 text-gray-600 hover:text-black" viewBox="0 0 24 24">
          <use href="/icons/icon_definitions.svg#Bell" />
        </svg>
      </button>

    {/* Add more icons */}
    </div>
      <div className="flex-1 overflow-hidden">
        <div className="overflow-hidden h-full">


          <div className="w-full px-6 py-2 border-b border-gray-200 flex items-center justify-between">

            {/* Base name & dropdown */}
            <div className="relative inline-block">
              <button
                onClick={() => setIsBaseMenuOpen(!isBaseMenuOpen)}
                className="text-xl font-bold flex items-center gap-3 hover:bg-gray-100 px-2 py-1 rounded"
              >
                <svg className="w-5 h-5 text-gray-600 hover:text-black" viewBox="0 0 24 24">
                  <use href="/icons/icon_definitions.svg#AirtableColoured" />
                </svg>
                {baseName}
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>

              {isBaseMenuOpen && (
                <div
                  ref={baseMenuRef}
                  className="absolute z-50 mt-2 w-96 rounded-lg shadow-xl border border-gray-200 bg-white p-4"
                >
                  {/* Title and actions */}
                  <div className="flex items-center justify-between mb-4">
                    <input
                      value={baseName}
                      onChange={(e) => setBaseName(e.target.value)}
                      className="text-2xl w-full px-1 py-0.5 border-transparent border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <div className="flex items-center gap-2 ml-2">
                      <button title="Star">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <use href="/icons/icon_definitions.svg#Star" />
                        </svg>
                      </button>
                      <button title="Share">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <use href="/icons/icon_definitions.svg#Share" />
                        </svg>
                      </button>
                      <button title="DotsThree">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <use href="/icons/icon_definitions.svg#DotsThree" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* soft separator */}
                  <hr className="border-t border-gray-200 my-4" />

                  {/* Appearance section */}
                  <details open>
                    <summary className="font-medium text-gray-700 cursor-pointer">Appearance</summary>

                    <div className="mt-3">
                      <div className="flex border-b mb-2">
                        <button className="border-b-2 border-blue-500 text-sm px-3 py-1 text-blue-600">Color</button>
                        <button className="text-sm px-3 py-1 text-gray-500">Icon</button>
                      </div>

                      {/* Color Grid */}
                      <div className="grid grid-cols-10 gap-2 mt-2">
                        {airtableColors.map((color, index) => (
                          <div
                            key={`color-${index}`}
                            className="w-6 h-6 rounded-md cursor-pointer border"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </details>

                  {/* soft separator */}
                  <hr className="border-t border-gray-200 my-4" />

                  {/* Base guide section (placeholder) */}
                  <details className="mt-4">
                    <summary className="font-medium text-gray-700 cursor-pointer">Base guide</summary>
                    <div className="mt-2 text-sm text-gray-500">Coming soon!</div>
                  </details>
                </div>
              )}
            </div>

            {/* Center: Navigation buttons */}
            <div className="flex gap-6 text-sm text-gray-600 font-medium">
              <button className="text-black border-b-2 border-[#A07938] pb-0.5">Data</button>
              <button className="hover:text-black">Automations</button>
              <button className="hover:text-black">Interfaces</button>
              <button className="hover:text-black">Forms</button>
            </div>


            {/* Right: Placeholder buttons */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-gray-100 text-sm rounded-full text-gray-700">Trial: 12 days left</div>
              <button className="text-sm text-blue-600 hover:underline">See what’s new</button>
              <div className="bg-[#A07938] text-white px-3 py-1 rounded text-sm font-semibold">Share</div>
            </div>
            
          </div>


        {/* Airtable-style table tab bar */}
        <div className="m-0 p-0 border-b border-gray-300 bg-[#fefbee] px-4">
          <div className="flex h-10 space-x-1">
            {tables.map((table) => {
              const isActive = table.id === currentTableId;
              return (
                <div key={table.id} className="relative flex items-center">
                  <button
                    onClick={() => setActiveTableId(table.id)}
                    className={`h-full flex items-center px-3 py-1.5 rounded-t-md rounded-b-none border text-sm font-medium cursor-pointer ${
                      isActive
                        ? "z-10 bg-white text-black border-x border-t border-gray-300 border-b-0 -mb-px"
                        : "bg-[#f5f5f5] text-gray-700 hover:bg-gray-200 border-transparent"
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{table.name}</span>
                    <svg
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdown(openDropdown === table.id ? null : table.id);
                      }}
                      className="ml-1 w-3 h-3 text-gray-500 hover:text-black cursor-pointer"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {openDropdown === table.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow z-10">
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
                          if (table.id && confirm("Delete this table?")) {
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

            {/* Add or import button */}
            {isCreatingTable ? (
              <button
                disabled
                className="ml-2 px-3 py-1.5 text-sm bg-gray-400 text-white rounded-md cursor-wait"
              >
                Creating...
              </button>
            ) : (
              <button
                onClick={() => {
                  const name = prompt("New table name?");
                  if (name) {
                    setIsCreatingTable(true);
                    createTable.mutate(
                      { baseId, name },
                      {
                        onSuccess: async (newTable) => {
                          await refetch();
                          setActiveTableId(newTable.id);
                          setIsCreatingTable(false);
                        },
                        onError: (err) => {
                          alert("Failed to create table: " + err.message);
                          setIsCreatingTable(false);
                        },
                      }
                    );
                  }
                }}
                className="ml-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                + Add or import
              </button>
            )}
          </div>
        </div>


        {/* Render selected table in full */}
        {currentTableId ? <TablePage tableId={currentTableId} /> : <p className="text-gray-500 pl-5 pt-5">No table selected :(</p>}

      </div>

      </div>
    </div>



  );
}

