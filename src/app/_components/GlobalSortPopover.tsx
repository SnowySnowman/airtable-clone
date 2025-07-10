import React, { useState, useEffect } from "react";
import GlobalSortEditor from "./GlobalSortEditor";

type SortItem = { columnId: string; order: "asc" | "desc" };

interface Props {
  columns: { id: string; name: string; type: "TEXT" | "NUMBER" }[];
  sort: SortItem[];
  setSort: React.Dispatch<React.SetStateAction<SortItem[]>>;
  onClose?: () => void;
}

const GlobalSortPopover: React.FC<Props> = ({ columns, sort, setSort, onClose }) => {
  const [mode, setMode] = useState<"list" | "editor">(sort.length > 0 ? "editor" : "list");
  const [pendingColumn, setPendingColumn] = useState<string | null>(null);

  // When user selects a column from the list, set that as the first sort item
  useEffect(() => {
    if (pendingColumn) {
      setSort([{ columnId: pendingColumn, order: "asc" }]);
      setMode("editor");
      setPendingColumn(null);
    }
  }, [pendingColumn]);

  if (mode === "editor") {
    return (
      <GlobalSortEditor
        columns={columns}
        sort={sort}
        setSort={setSort}
        onClose={onClose}
      />
    );
  }

  // Column list (only shown when no sort exists)
  return (
    <div className="w-80 bg-white border border-gray-200 rounded shadow-xl">
      {/* Top Row */}
      <div className="flex justify-between items-center text-xs text-gray-500 px-4 py-2">
        <span className="font-semibold">Sort by</span>
        <span className="text-[11px]">Copy from a view</span>
      </div>

      <div className="border-t border-gray-200" />

      {/* Search field */}
      <div className="p-4 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Find a field"
            disabled
            className="w-full px-3 py-1.5 pl-8 text-sm text-gray-600 border border-gray-200 rounded bg-gray-50"
          />
          <svg
            className="absolute left-2 top-2.5 w-4 h-4 text-gray-400"
            viewBox="0 0 24 24"
          >
            <use href="/icons/icon_definitions.svg#Lookup" />
          </svg>
        </div>
      </div>

      {/* Column buttons */}
      <div className="px-4 py-2 space-y-1 max-h-60 overflow-y-auto">
        {columns.map((col) => (
          <button
            key={col.id}
            onClick={() => {
              setPendingColumn(col.id);
            }}
            className="w-full text-left text-sm text-gray-800 hover:bg-gray-100 px-2 py-1 rounded"
          >
            {col.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GlobalSortPopover;
