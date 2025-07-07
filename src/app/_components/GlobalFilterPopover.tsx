import React, { useState, useRef, useEffect } from "react";

interface FilterConfig {
  [key: string]: {
    type: "text" | "number";
    op: string;
    value: any;
  };
}

interface Props {
  columns: { id: string; name: string; type: string }[];
  filters: FilterConfig;
  setFilters: React.Dispatch<React.SetStateAction<FilterConfig>>;
}

const GlobalFilterPopover: React.FC<Props> = ({ columns, filters, setFilters }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateFilter = (colId: string, type: "text" | "number", op: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [colId]: { type, op, value },
    }));
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-yellow-500 text-white px-3 py-1 rounded"
      >
        🔍 Filter Columns
      </button>

      {open && (
        <div className="absolute z-50 mt-2 right-0 w-96 bg-white border rounded shadow-lg p-4 space-y-4 max-h-[500px] overflow-y-auto">
          <h2 className="font-bold text-sm mb-2">Filter Columns</h2>

          {columns.map((col) => {
            const colType = col.type.toLowerCase() as "text" | "number";
            const filter = filters[col.id] || { op: "", value: "" };

            return (
              <div key={col.id} className="border-b pb-2">
                <div className="text-sm font-medium mb-1">{col.name || col.id}</div>
                <select
                  className="w-full text-sm mb-1"
                  value={filter.op}
                  onChange={(e) =>
                    updateFilter(
                      col.id,
                      colType,
                      e.target.value,
                      e.target.value.includes("empty") ? null : filter.value
                    )
                  }
                >
                  <option value="">--</option>
                  {colType === "number" ? (
                    <>
                      <option value=">">greater than</option>
                      <option value="<">less than</option>
                    </>
                  ) : (
                    <>
                      <option value="equals">equals</option>
                      <option value="contains">contains</option>
                      <option value="not_contains">not contains</option>
                      <option value="is_empty">is empty</option>
                      <option value="is_not_empty">is not empty</option>
                    </>
                  )}
                </select>

                {typeof filter.op === "string" && !filter.op.includes("empty") && (
                  <input
                    type={colType === "number" ? "number" : "text"}
                    value={filter.value ?? ""}
                    onChange={(e) =>
                      updateFilter(col.id, colType, filter.op, colType === "number" ? Number(e.target.value) : e.target.value)
                    }
                    className="w-full text-sm px-2 py-1 border rounded"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GlobalFilterPopover;
