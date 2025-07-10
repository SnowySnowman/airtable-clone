import React, { useState, useRef, useEffect } from 'react';
import GlobalColVisibilityPopover from './GlobalColVisibilityPopover';
import GlobalFilterPopover from './GlobalFilterPopover';


type FilterCondition = {
  field: string;
  type: 'TEXT' | 'NUMBER';
  op: string;
  value: string | number | null;
};

export default function TopBar({
  viewName,
  columns,
  visibility,
  onToggleColumn,
  filters,
  setFilters,
  saveCurrentViewConfig,
}: {
  viewName: string;
  columns: { id: string; name?: string; type: string }[]; // ✅ Ensure `type` is included
  visibility: Record<string, boolean>;
  onToggleColumn: (columnId: string, visible: boolean) => void;
  filters: FilterCondition[];
  setFilters: React.Dispatch<React.SetStateAction<FilterCondition[]>>;
  saveCurrentViewConfig: () => void;
}) {
  const [showColumnPopover, setShowColumnPopover] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterButtonRef = useRef<HTMLDivElement>(null);   

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        showColumnPopover &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowColumnPopover(false);
      }

      if (
        showFilterPopover &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target as Node)
      ) {
        setShowFilterPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnPopover]);

  return (
    <div className="w-full h-12 px-3 border-b border-gray-300 flex items-center justify-between bg-white relative">
      {/* Left side: View switcher */}
      <div className="flex items-center gap-2">
        <button className="hover:bg-gray-100 rounded p-1">
          <svg className="w-4 h-4 text-black-600" viewBox="0 0 24 24" fill="currentColor">
            <use href="/icons/icon_definitions.svg#List" />
          </svg>
        </button>
        <button className="flex items-center gap-1 text-sm font-medium text-gray-700 px-2 py-1 hover:bg-gray-100 rounded">
          <svg className="w-4 h-4 text-black-600" viewBox="0 0 24 24" fill="currentColor">
            <use href="/icons/icon_definitions.svg#GridFeature" />
          </svg>
          <span className="text-black-600 truncate">{viewName}</span>
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>
      </div>

      {/* Right side: Toolbar icons */}
      <div className="flex items-center gap-4 text-sm text-gray-700 relative">
        {/* Hide fields button */}
        <div className="relative" ref={buttonRef}>
          <button
            onClick={() => setShowColumnPopover((prev) => !prev)}
            className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <use href="/icons/icon_definitions.svg#EyeSlash" />
            </svg>
            Hide fields
          </button>

          {showColumnPopover && (
            <div className="absolute top-10 right-0 z-50">
              <GlobalColVisibilityPopover
                columns={columns}
                visibility={visibility}
                onToggle={onToggleColumn}
              />
            </div>
          )}
        </div>
        {/* Filter button */}
        <div className="relative" ref={filterButtonRef}>
        <button
            onClick={() => setShowFilterPopover((prev) => !prev)}
            className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded"
        >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#Filter" />
            </svg>
            Filter
        </button>

        {showFilterPopover && (
          <GlobalFilterPopover
            columns={columns.map(col => ({
              ...col,
              name: col.name ?? col.id, // fallback to `id` if name is missing
            }))}
            filters={filters}
            setFilters={setFilters}
            onClose={() => {
                setShowFilterPopover(false);
                saveCurrentViewConfig();
              }}
          />

        )}
        </div>

        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#Group" />
          </svg>
          Group
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#SortAscending" />
          </svg>
          Sort
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#PaintBucket" />
          </svg>
          Color
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#RowHeightMedium" />
          </svg>
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#Share" />
          </svg>
          Share and sync
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#Lookup" />
          </svg>
        </button>
      </div>
    </div>
  );
}
