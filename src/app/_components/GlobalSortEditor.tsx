import React, { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

type SortItem = { columnId: string; order: "asc" | "desc" };

interface Props {
  tableId: string;
  viewName: string;
  columns: { id: string; name: string; type: "TEXT" | "NUMBER" }[];
  sort: SortItem[];
  setSort: React.Dispatch<React.SetStateAction<SortItem[]>>;
  onClose?: () => void;
}

const GlobalSortEditor: React.FC<Props> = ({ 
  tableId,
  viewName,
  columns, 
  sort, 
  setSort, 
  onClose 
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // 2) click‐outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  
  // 3) initialise at least one row
  useEffect(() => {
    if (sort.length === 0 && columns.length > 0) {
      setSort([{ columnId: columns[0]!.id, order: "asc" }]);
    }
  }, [columns, setSort, sort.length]);


  const updateItem = (index: number, update: Partial<SortItem>) => {
    setSort((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...update } : item))
    );
  };

  const removeItem = (index: number) => {
    setSort((prev) => prev.filter((_, i) => i !== index));
  };

  const addSort = () => {
    console.log("columns:", columns);
    if (columns.length === 0) return;
    setSort((prev) => [
      ...prev,
      { columnId: columns[0]!.id, order: "asc" },
    ]);
  };

  const getColumnType = (columnId: string) => {
    return columns.find((col) => col.id === columnId)?.type ?? "TEXT";
  };

  console.log("Rendering sort editor with sort items:", sort);

  return (
    <div
      className="w-[460px] bg-white border border-gray-200 rounded shadow-lg p-4 space-y-4 fixed z-[9999]"
      ref={ref}
    >
      {/* Header */}
      <div className="text-xs text-gray-500 font-medium">Sort by</div>
      <div className="border-t border-gray-200 -mt-2" />

      {/* Sort rows */}
      {sort.map((item, index) => {
        const col = columns.find((c) => c.id === item.columnId);
        const type = getColumnType(item.columnId);

        return (
          <div key={index} className="flex items-center gap-2">
            {/* Field dropdown */}
            <select
              value={item.columnId}
              onChange={(e) => updateItem(index, { columnId: e.target.value })}
              className="text-sm border rounded px-2 py-1 w-40"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>

            {/* Sort order */}
            <select
              value={item.order}
              onChange={(e) =>
                updateItem(index, { order: e.target.value as "asc" | "desc" })
              }
              className="text-sm border rounded px-2 py-1 w-36"
            >
              {type === "TEXT" ? (
                <>
                  <option value="asc">A → Z</option>
                  <option value="desc">Z → A</option>
                </>
              ) : (
                <>
                  <option value="asc">1 → 9</option>
                  <option value="desc">9 → 1</option>
                </>
              )}
            </select>

            {/* Remove button */}
            <button
              onClick={() => removeItem(index)}
              className="text-gray-500 hover:text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}

      {/* Add sort */}
      <div className="pt-2">
        <button
          onClick={addSort}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add another sort
        </button>
      </div>

      {/* Footer row */}
      <div className="flex items-center gap-2 bg-gray-100 mt-4 px-3 py-2 rounded">
        <input type="checkbox" disabled />
        <span className="text-xs text-gray-700">Automatically sort records</span>
      </div>
    </div>
    
  );
  
};

export default GlobalSortEditor;
