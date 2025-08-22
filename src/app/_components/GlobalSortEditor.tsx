import React, { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

type SortItem = { columnId: string; order: "asc" | "desc" };

interface Props {
  tableId: string;
  viewName: string;
  columns: { id: string; name: string; type: "TEXT" | "NUMBER" }[];
  sort: SortItem[];
  setSort: React.Dispatch<React.SetStateAction<SortItem[]>>;
  onApply?: (next: SortItem[]) => void;  // used to send final result
  onClose?: () => void;
}

const GlobalSortEditor: React.FC<Props> = ({ 
  tableId,
  viewName,
  columns, 
  sort, 
  setSort,
  onApply,
  onClose 
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Local draft that mirrors the incoming sort until Apply
  const [draft, setDraft] = React.useState<SortItem[]>(sort);
  React.useEffect(() => setDraft(sort), [sort]);

  // auto-apply draft → parent sort (debounced)
  React.useEffect(() => {
    const h = setTimeout(() => {
      // only apply valid items (have columnId + order)
      const valid = draft.filter(d => d.columnId && d.order);
      // let “no rules” mean “no sorting”
      setSort(valid);
    }, 150); // 150–250ms feels snappy; tune if you like
    return () => clearTimeout(h);
  }, [draft, setSort]);

  const updateItem = (i: number, u: Partial<SortItem>) =>
    setDraft(prev => prev.map((it, idx) => (idx === i ? { ...it, ...u } : it)));

  const removeItem = (i: number) =>
    setDraft(prev => prev.filter((_, idx) => idx !== i));

  const addSort = () =>
    setDraft(prev => [...prev, { columnId: columns[0]!.id, order: 'asc' }]);

  // Call this when user confirms (Apply/Done) or when you want to finish editing
  const applyAndClose = () => {
    onApply?.(draft);
    onClose?.();
  };


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

  const getColumnType = (columnId: string) => {
    return columns.find((col) => col.id === columnId)?.type ?? "TEXT";
  };

  console.log("Rendering sort editor with sort items:", sort);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        applyAndClose(); // or onClose?.() if you prefer Cancel-on-click-away
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [applyAndClose]);


  return (
    <div
      className="w-[460px] bg-white border border-gray-200 rounded shadow-lg p-4 space-y-4" 
      ref={ref}
    >
      
      {/* Header */}
      <div className="text-xs text-gray-500 font-medium">Sort by</div>
      <div className="border-t border-gray-200 -mt-2" />

      {/* Sort rows */}
      {draft.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            value={item.columnId}
            onChange={(e) => updateItem(index, { columnId: e.target.value })}
            className="text-sm border rounded px-2 py-1 w-40"
          >
            {columns.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
          </select>

          <select
            value={item.order}
            onChange={(e) => updateItem(index, { order: e.target.value as "asc" | "desc" })}
            className="text-sm border rounded px-2 py-1 w-36"
          >
            {getColumnType(item.columnId) === "TEXT" ? (
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

          <button onClick={() => removeItem(index)} className="text-gray-500 hover:text-red-500">
            <Trash2 size={16} />
          </button>
        </div>
      ))}


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
