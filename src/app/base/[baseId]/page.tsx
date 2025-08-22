"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import TablePage from "~/app/_components/TablePage";
import { useEffect } from "react";
import { createPortal } from "react-dom";

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

  // Add/import UI state
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<DOMRect | null>(null);

  // “Start from scratch” panel
  const [isStartPanelOpen, setIsStartPanelOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  // Compute "Table {N}" that doesn't clash with existing names
  function nextTableName() {
    const taken = new Set((tables ?? []).map(t => (t.name || '').trim()));
    let n = 1;
    while (taken.has(`Table ${n}`)) n++;
    return `Table ${n}`;
  }

  // Tab menu (per-table)
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
  const [tabMenuAnchor, setTabMenuAnchor] = useState<DOMRect | null>(null);
  const [tabMenuTableId, setTabMenuTableId] = useState<string | null>(null);

  // Rename popover
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameAnchor, setRenameAnchor] = useState<DOMRect | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Optional optimistic overlay for table names
  const [optimisticTableNames, setOptimisticTableNames] = useState<Record<string, string>>({});






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
        <div className="px-4 pt-2 border-b border-gray-200 flex items-center gap-2 overflow-x-auto bg-[#fbf5e1]">
          {tables.map((t) => {
            const label = optimisticTableNames[t.id] ?? t.name;
            const isActive = currentTableId === t.id;

            return (
              <div key={t.id} className="flex items-center">
                <button
                  onClick={() => setActiveTableId(t.id)}
                  className={
                    isActive
                      ? "flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-t-md text-sm bg-white border border-gray-200 border-b-white text-black"
                      : "px-3 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100"
                  }
                >
                  <span className="truncate">{label}</span>

                  {/* caret lives INSIDE the active tab */}
                  {isActive && (
                    <span
                      role="button"
                      aria-label="Table menu"
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setTabMenuAnchor(rect);
                        setTabMenuTableId(t.id);
                        setIsTabMenuOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          (e.currentTarget as HTMLElement).click();
                        }
                      }}
                      className="ml-1 inline-flex items-center justify-center rounded hover:bg-gray-100 px-1 py-0.5 text-gray-500 hover:text-gray-800"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      </svg>
                    </span>
                  )}
                </button>
                {/* optional: a slim separator between tabs */}
                {!isActive && <span className="mx-1 text-gray-300">|</span>}
              </div>
            );
          })}



          {/* Add or import (anchor button only; the panels are portaled below) */}
          <button
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setAddMenuAnchor(rect);
              setIsAddMenuOpen(true);
              setIsStartPanelOpen(false);
            }}
            className="ml-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer"
          >
            + Add or import
          </button>
        </div>

        {/* Click-away backdrop for either panel */}
        {(isAddMenuOpen || isStartPanelOpen) && addMenuAnchor &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-[49] bg-transparent"
              onClick={() => { setIsStartPanelOpen(false); setIsAddMenuOpen(false); }}
            />,
            document.body
          )
        }

        {isTabMenuOpen && tabMenuAnchor && tabMenuTableId &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[70] w-[340px] rounded-xl border border-gray-200 bg-white shadow-[0_12px_32px_rgba(16,24,40,0.12)]"
              style={{ top: tabMenuAnchor.bottom + 6, left: tabMenuAnchor.left }}
            >
              <div className="py-1">
                <button
                  onClick={(e) => {
                    // open rename popover anchored to the same tab
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setIsTabMenuOpen(false);
                    setIsRenameOpen(true);
                    setRenameAnchor(tabMenuAnchor); // anchor to the tab, not the item
                    const t = tables.find(tt => tt.id === tabMenuTableId);
                    setRenameValue(t?.name ?? "");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24"><use href="/icons/icon_definitions.svg#Pencil"/></svg>
                  Rename table
                </button>

                {/* the rest mirror Airtable but are disabled */}
                {[
                  'Hide table','Manage fields','Duplicate table',
                  'Configure date dependencies','Edit table description',
                  'Edit table permissions','Clear data'
                ].map(label => (
                  <button
                    key={label}
                    disabled
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                    title="Disabled in this build"
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 opacity-60"><use href="/icons/icon_definitions.svg#DotsThree"/></svg>
                      {label}
                    </span>
                  </button>
                ))}

                {/* ENABLED: Delete table (optimistic) */}
                <button
                  onClick={() => {
                    if (!tabMenuTableId) return;
                    const id = tabMenuTableId;

                    // snapshot for rollback
                    const prevTables = tables;
                    const prevActive = currentTableId;

                    // compute next active (first table that isn't the one we’re deleting)
                    const nextActive = prevTables.find(t => t.id !== id)?.id ?? null;

                    // close the menu
                    setIsTabMenuOpen(false);
                    setIsRenameOpen(false);

                    // optimistic UI: remove tab immediately
                    setTables(prev => prev.filter(t => t.id !== id));
                    if (prevActive === id) setActiveTableId(nextActive);

                    // fire backend delete
                    deleteTable.mutate(
                      { tableId: id },
                      {
                        onSuccess: async () => {
                          await refetch();
                        },
                        onError: (err) => {
                          // rollback on error
                          setTables(prevTables);
                          setActiveTableId(prevActive);
                          alert('Failed to delete table: ' + err.message);
                        },
                      }
                    );
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <svg className="w-4 h-4"><use href="/icons/icon_definitions.svg#Trash"/></svg>
                  Delete table
                </button>

              </div>
            </div>,
            document.body
          )
        }

        {isRenameOpen && renameAnchor && tabMenuTableId &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[80] w-[360px] rounded-xl border border-gray-200 bg-white shadow-[0_12px_32px_rgba(16,24,40,0.12)] p-4"
              style={{ top: renameAnchor.bottom + 8, left: renameAnchor.left }}
            >
              <div className="mb-3">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div className="mb-2 text-sm text-gray-700">What should each record be called?</div>
              <button
                disabled
                className="w-full inline-flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
              >
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 opacity-70"><use href="/icons/icon_definitions.svg#TextAa"/></svg>
                  Record
                </span>
                <svg className="h-4 w-4 opacity-70"><use href="/icons/icon_definitions.svg#CaretDown"/></svg>
              </button>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => { setIsRenameOpen(false); }}
                  className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const id = tabMenuTableId;
                    const name = (renameValue || "").trim();
                    if (!id || !name) return;

                    // Optimistic UI: update tab label immediately
                    setOptimisticTableNames(prev => ({ ...prev, [id]: name }));
                    setTables(prev => prev.map(t => t.id === id ? { ...t, name } : t));

                    setIsRenameOpen(false);

                    // Backend rename
                    renameTable.mutate(
                      { tableId: id, name },
                      {
                        onSuccess: async () => {
                          await refetch();
                          setOptimisticTableNames(prev => { const m = { ...prev }; delete m[id]; return m; });
                        },
                        onError: async (err) => {
                          // Roll back optimistic label
                          setOptimisticTableNames(prev => { const m = { ...prev }; delete m[id]; return m; });
                          await refetch();
                          alert('Failed to rename table: ' + err.message);
                        }
                      }
                    );
                  }}
                  className="px-4 py-2 rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>,
            document.body
          )
        }



        {/* /* Main Add/import dropdown (portaled & fixed) */}
        {isAddMenuOpen && addMenuAnchor &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[50] w-72 rounded-xl border border-gray-200 bg-white shadow-[0_12px_32px_rgba(16,24,40,0.12)]"
              style={{ top: addMenuAnchor.bottom + 6, left: addMenuAnchor.left }}
            >
              <div className="py-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500">Add a blank table</div>

                <button
                  disabled
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                  title="Disabled in this build"
                >
                  <svg className="w-4 h-4"><use href="/icons/icon_definitions.svg#Sparkles" /></svg>
                  Create with AI
                </button>

                <button
                  // AFTER
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setIsStartPanelOpen(true);
                    setNewTableName(nextTableName());
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4"><use href="/icons/icon_definitions.svg#DocumentAdd" /></svg>
                  Start from scratch
                </button>

                <div className="my-2 border-t border-gray-200" />
                <div className="px-3 py-2 text-xs font-semibold text-gray-500">Add from other sources</div>

                {[
                  { label: 'Airtable base' }, { label: 'CSV file' },
                  { label: 'Google Calendar' }, { label: 'Google Sheets' },
                  { label: 'Microsoft Excel' }, { label: 'Salesforce' },
                  { label: 'Smartsheet' }, { label: '25 more sources…' },
                ].map((item) => (
                  <button
                    key={item.label}
                    disabled
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                    title="Disabled in this build"
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-4 h-4 opacity-60"><use href="/icons/icon_definitions.svg#LinkExternal" /></svg>
                      {item.label}
                    </span>
                    <span className="text-[10px] rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">Disabled</span>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )
        }

        {/* /* Naming popover (portaled & fixed), aligned to the same button */}
        {isStartPanelOpen && addMenuAnchor &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed z-[60] w-[360px] rounded-xl border border-gray-200 bg-white shadow-[0_12px_32px_rgba(16,24,40,0.12)] p-4"
              style={{ top: addMenuAnchor.bottom + 10, left: addMenuAnchor.left }}
            >
              <div className="mb-3">
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="mb-2 text-sm text-gray-700">What should each record be called?</div>
              <button
                disabled
                className="w-full inline-flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                title="Non-functional in this mock"
              >
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 opacity-70"><use href="/icons/icon_definitions.svg#TextAa" /></svg>
                  Record
                </span>
                <svg className="h-4 w-4 opacity-70"><use href="/icons/icon_definitions.svg#CaretDown" /></svg>
              </button>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => { setIsStartPanelOpen(false); setIsAddMenuOpen(false); }}
                  className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const name = newTableName.trim() || nextTableName();
                    setIsCreatingTable(true);
                    createTable.mutate(
                      { baseId, name },
                      {
                        onSuccess: async (newTable) => {
                          await refetch();
                          setActiveTableId(newTable.id);
                          setIsCreatingTable(false);
                          setIsStartPanelOpen(false);
                          setIsAddMenuOpen(false);
                        },
                        onError: (err) => {
                          alert('Failed to create table: ' + err.message);
                          setIsCreatingTable(false);
                        },
                      }
                    );
                  }}
                  className="px-4 py-2 rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>,
            document.body
          )
        }



        {/* Render selected table in full */}
        {currentTableId ? <TablePage tableId={currentTableId} /> : <p className="text-gray-500 pl-5 pt-5">No table selected :(</p>}

      </div>

      </div>
    </div>



  );
}

