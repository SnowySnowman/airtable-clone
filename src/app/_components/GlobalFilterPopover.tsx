import React, { useRef, useEffect, useState } from "react";
import { Trash2, MoreHorizontal } from "lucide-react";

interface FilterCondition {
  field: string;
  type: "TEXT" | "NUMBER";
  op: string;
  value: any;
}

interface Props {
  columns: { id: string; name: string; type: string }[];
  filters: FilterCondition[];
  setFilters: React.Dispatch<React.SetStateAction<FilterCondition[]>>;
  onClose: () => void;
}

const GlobalFilterPopover: React.FC<Props> = ({ columns, filters, setFilters, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Ensure at least one filter condition on mount
  useEffect(() => {
    if (filters.length === 0 && columns.length > 0) {
      const col = columns[0]!;
      setFilters([
        {
          field: col.id,
          type: col.type as "TEXT" | "NUMBER",
          op: "",
          value: "",
        },
      ]);
    }
  }, [filters.length, columns, setFilters]);

  const addCondition = () => {
    if (columns.length === 0) return;
    const col = columns[0]!;
    setFilters((prev) => [
      ...prev,
      { field: col.id, type: col.type as "TEXT" | "NUMBER", op: "", value: "" },
    ]);
  };

  const updateCondition = (index: number, update: Partial<FilterCondition>) => {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...update } : f))
    );
  };

  const removeCondition = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      className="absolute z-50 mt-2 right-0 w-[460px] bg-white border border-gray-200 rounded shadow-lg p-4 space-y-4 max-h-[500px] overflow-y-auto"
      ref={ref}
    >
      <div className="text-xs text-gray-500 font-medium">In this view, show records</div>

      {filters.map((filter, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Where</span>

          {/* Field dropdown */}
          <select
            value={filter.field}
            onChange={(e) => {
              const selected = columns.find((col) => col.id === e.target.value);
              updateCondition(index, {
                field: e.target.value,
                type: selected?.type as "TEXT" | "NUMBER",
                op: "",
                value: "",
              });
            }}
            className="text-sm border rounded px-2 py-1 w-32"
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>

          {/* Operator */}
          <select
            value={filter.op}
            onChange={(e) =>
              updateCondition(index, {
                op: e.target.value,
                value: e.target.value.includes("empty") ? null : "",
              })
            }
            className="text-sm border rounded px-2 py-1 w-36"
          >
            <option value="">--</option>
            {filter.type === "NUMBER" ? (
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

          {/* Value input */}
          {!filter.op.includes("empty") && (
            <input
              type={filter.type === "NUMBER" ? "NUMBER" : "TEXT"}
              value={filter.value ?? ""}
              onChange={(e) =>
                updateCondition(index, {
                  value:
                    filter.type === "NUMBER"
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
              className="text-sm border rounded px-2 py-1 w-32"
            />
          )}

          {/* Trash icon */}
          <button onClick={() => removeCondition(index)} className="text-gray-500 hover:text-red-500">
            <Trash2 size={16} />
          </button>

          {/* Placeholder icon */}
          <button className="text-gray-400">
            <MoreHorizontal size={16} />
          </button>
        </div>
      ))}

      {/* Footer buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-200 pt-4">
        <button
          onClick={addCondition}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add condition
        </button>
        <button className="text-sm text-gray-600 hover:underline" disabled>
          + Add condition group
        </button>
        <button className="text-sm text-gray-600 hover:underline" disabled>
          Copy from another view
        </button>
      </div>
    </div>
  );
};

export default GlobalFilterPopover;
