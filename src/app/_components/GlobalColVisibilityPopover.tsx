import React, { useState, useEffect, useRef } from "react";

interface Props {
  columns: {
    id: string;
    name?: string;
  }[];
  visibility: Record<string, boolean>;
  onToggle: (columnId: string, visible: boolean) => void;
}

const GlobalColVisibilityPopover: React.FC<Props> = ({ columns, visibility, onToggle }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="bg-sky-500 text-white px-3 py-1 rounded"
      >
        Toggle Columns
      </button>

      {open && (
        <div className="absolute z-50 mt-2 left-0 w-64 bg-white border rounded shadow-lg p-4 space-y-2 max-h-96 overflow-y-auto">
          <h2 className="font-bold text-sm mb-2">Toggle Column Visibility</h2>
          {columns.map((col) => (
            <label key={col.id} className="flex items-center text-sm space-x-2">
              <input
                type="checkbox"
                checked={visibility[col.id] ?? true}
                onChange={(e) => onToggle(col.id, e.target.checked)}
              />
              <span>{col.name || col.id}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default GlobalColVisibilityPopover;
