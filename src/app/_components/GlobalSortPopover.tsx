import React, { useState, useRef, useEffect } from "react";

type SortItem = { columnId: string; order: "asc" | "desc" };

interface Props {
  columns: { id: string; name: string }[];
  sort: SortItem[];
  setSort: React.Dispatch<React.SetStateAction<SortItem[]>>;
}

const GlobalSortPopover: React.FC<Props> = ({ columns, sort, setSort }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateSort = (columnId: string, order: "asc" | "desc" | "") => {
    setSort((prev) => {
      const others = prev.filter((s) => s.columnId !== columnId);
      return order ? [...others, { columnId, order }] : others;
    });
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="bg-orange-500 text-white px-3 py-1 rounded"
      >
        ↕️ Sort Columns
      </button>

      {open && (
        <div className="absolute z-50 mt-2 right-0 w-80 bg-white border rounded shadow-lg p-4 space-y-4 max-h-[400px] overflow-y-auto">
          <h2 className="font-bold text-sm mb-2">Sort Columns</h2>

          {columns.map((col) => {
            const current = sort.find((s) => s.columnId === col.id)?.order ?? "";

            return (
              <div key={col.id} className="flex items-center justify-between text-sm">
                <span>{col.name || col.id}</span>
                <select
                  className="border rounded px-1 py-0.5"
                  value={current}
                  onChange={(e) =>
                    updateSort(col.id, e.target.value as "asc" | "desc" | "")
                  }
                >
                  <option value="">None</option>
                  <option value="asc">↑ Ascending</option>
                  <option value="desc">↓ Descending</option>
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GlobalSortPopover;
