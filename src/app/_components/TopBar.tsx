import React, { useState, useRef, useEffect, useMemo } from 'react';
import GlobalColVisibilityPopover from './GlobalColVisibilityPopover';
import GlobalFilterPopover from './GlobalFilterPopover';
import GlobalSortPopover from './GlobalSortPopover';
import GlobalSortEditor from './GlobalSortEditor';


type FilterCondition = {
  field: string;
  type: 'TEXT' | 'NUMBER';
  op: string;
  value: string | number | null;
};

type SortItem = { columnId: string; order: "asc" | "desc" };

interface TopBarProps {
  viewName: string;
  columns: { id: string; name?: string; type: string }[];
  visibility: Record<string, boolean>;
  onToggleColumn: (columnId: string, visible: boolean) => void;
  filters: FilterCondition[];
  setFilters: React.Dispatch<React.SetStateAction<FilterCondition[]>>;
  saveCurrentViewConfig: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  addFakeRows: (params: { tableId: string; count: number }) => void;
  tableId: string;
  sort: SortItem[];
  setSort: React.Dispatch<React.SetStateAction<SortItem[]>>;
  onOpenSort: () => void;
}

export default function TopBar({
  viewName,
  columns,
  visibility,
  onToggleColumn,
  filters,
  setFilters,
  saveCurrentViewConfig,
  searchQuery,
  setSearchQuery,
  addFakeRows,
  tableId,
  onOpenSort,
  
}: TopBarProps) {
  const [showColumnPopover, setShowColumnPopover] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterButtonRef = useRef<HTMLDivElement>(null);   
  const [showSortPopover, setShowSortPopover] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<SortItem[]>([]);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const closeSearch = () => setShowSearchInput(false);

  // When user clicks "Sort" button:
  const handleOpenSort = () => {
    setShowSortPopover(true);
  };

  const sortableColumns = useMemo(() => {
    return columns
      .filter(
        (col): col is { id: string; name: string; type: "TEXT" | "NUMBER" } =>
          typeof col.name === "string" &&
          (col.type === "TEXT" || col.type === "NUMBER")
      )
      .map((col) => ({
        id: col.id,
        name: col.name,
        type: col.type,
      }));
  }, [columns]);


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

      if (
        showSortPopover &&
        sortButtonRef.current &&
        !sortButtonRef.current.contains(e.target as Node)
      ) {
        setShowSortPopover(false);
      }

      if (
        showSearchInput &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowSearchInput(false);
      }

    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnPopover, showFilterPopover, showSortPopover]);

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
        {/* Add 100k Rows button */}
        <div className="relative" ref={buttonRef}>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to add 100,000 fake rows?")) {
                addFakeRows({ tableId, count: 100000 }); // Now this works
              }
            }}
            className="text-gray-800 px-3 py-1 rounded disabled:opacity-50 flex items-center gap-2 hover:bg-gray-100 cursor-pointer"
          >
            <svg className="w-4 h-4 text-gray" viewBox="0 0 24 24">
              <use href="/icons/icon_definitions.svg#Plus" />
            </svg>
            <span className="text-gray">Add 100k Rows</span>
          </button>
        </div>

        {/* Hide fields button */}
        <div className="relative" ref={buttonRef}>
          <button
            onClick={() => setShowColumnPopover((prev) => !prev)}
            className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <use href="/icons/icon_definitions.svg#EyeSlash" />
            </svg>
            Hide fields
          </button>

          {showColumnPopover && (
            <div className="absolute top-10 right-0 z-50">
              <GlobalColVisibilityPopover
                tableId={tableId}
                viewName={viewName}
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
              className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
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

        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#Group" />
          </svg>
          Group
        </button>
        
        {/* Sort button with popover */}
        <div className="relative" ref={sortButtonRef}>
          <button
            // onClick={() => setShowSortPopover((prev) => !prev)}
            onClick={onOpenSort} 
            className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <use href="/icons/icon_definitions.svg#SortAscending" />
            </svg>
            Sort
          </button>

          {showSortPopover && (
            <div className="absolute top-full mt-2 right-0 z-50">
              {sort.length > 0 ? (
                <GlobalSortEditor
                  tableId={tableId}
                  viewName={viewName}
                  columns={sortableColumns}
                  sort={sort}
                  setSort={setSort}
                  onClose={() => {
                    setShowSortPopover(false);
                    saveCurrentViewConfig();
                  }}
                />
              ) : (
                <GlobalSortPopover
                  tableId={tableId}
                  viewName={viewName}
                  columns={sortableColumns}
                  sort={sort}
                  setSort={setSort}
                  onClose={() => {
                    setShowSortPopover(false);
                    saveCurrentViewConfig();
                  }}
                />
              )}
            </div>
          )}

        </div>


        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#PaintBucket" />
          </svg>
          Color
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#RowHeightMedium" />
          </svg>
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#Share" />
          </svg>
          Share and sync
        </button>
        <div className="relative" ref={searchRef}>
        <button
          onClick={() => setShowSearchInput((prev) => !prev)}
          className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <use href="/icons/icon_definitions.svg#Lookup" />
          </svg>
        </button>

        {showSearchInput && (
          <div className="absolute top-10 right-0 w-64 z-50">
            <div className="bg-white border border-gray-300 rounded shadow overflow-hidden">
              {/* header / input */}
              <div className="relative p-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find in view"
                  className="w-full px-2 py-1 pr-8 bg-white outline-none focus:ring-0 border-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSearchInput(false)}
                  aria-label="Close"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                >
                  {/* X icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* shaded footer */}
              <div className="bg-gray-100 border-t border-gray-200 px-3 py-3 text-sm">
                <p className="text-gray-700 leading-snug">
                  Use advanced search options in the
                </p>
                <a href="#" className="text-blue-600 hover:underline">
                  search extension
                </a>
              </div>
            </div>
          </div>
        )}

      </div>

      </div>
    </div>
  );
}
