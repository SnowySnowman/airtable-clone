// import React from "react";

// interface Props {
//   columns: {
//     id: string;
//     name?: string;
//   }[];
//   visibility: Record<string, boolean>;
//   onToggle: (columnId: string, visible: boolean) => void;
// }

// const GlobalColVisibilityPopover: React.FC<Props> = ({ columns, visibility, onToggle }) => {
//   return (
//     <div className="z-50 w-72 bg-white border border-gray-200 rounded-md shadow-xl text-sm text-gray-800">
//       <div className="px-4 py-3 border-b border-gray-200 font-medium">Hide fields</div>
//       <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
//         {columns.map((col) => (
//           <label
//             key={col.id}
//             className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer"
//           >
//             <span className="truncate">{col.name || col.id}</span>
//             <input
//               type="checkbox"
//               checked={visibility[col.id] ?? true}
//               onChange={(e) => onToggle(col.id, e.target.checked)}
//               className="form-checkbox accent-gray-700"
//             />
//           </label>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default GlobalColVisibilityPopover;

import React from "react";

interface Props {
  columns: {
    id: string;
    name?: string;
  }[];
  visibility: Record<string, boolean>;
  onToggle: (columnId: string, visible: boolean) => void;
  onToggleAll?: (visible: boolean) => void;
}

const GlobalColVisibilityPopover: React.FC<Props> = ({
  columns,
  visibility,
  onToggle,
  onToggleAll,
}) => {
  return (
    <div className="z-50 w-72 bg-white border border-gray-200 rounded-md shadow-xl text-sm text-gray-800">
      {/* Non-interactive search bar */}
      <div className="px-3 pt-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Find a field"
            className="w-full px-3 py-1.5 text-sm text-gray-500 bg-gray-100 border border-gray-200 rounded"
            disabled
          />
          <div className="absolute right-2 top-1.5 text-gray-400 pointer-events-none">?</div>
        </div>
      </div>

      {/* Field checkboxes with checkbox on the left */}
      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 mt-2">
        {columns.map((col) => (
          <label
            key={col.id}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={visibility[col.id] ?? true}
              onChange={(e) => onToggle(col.id, e.target.checked)}
              className="form-checkbox accent-gray-700"
            />
            <span className="truncate">{col.name || col.id}</span>
          </label>
        ))}
      </div>

      {/* Bottom buttons */}
      <div className="flex justify-between items-center border-t border-gray-200 px-4 py-2">
        <button
          className="text-gray-600 hover:underline text-sm"
          onClick={() => onToggleAll?.(false)}
        >
          Hide all
        </button>
        <button
          className="text-gray-600 hover:underline text-sm"
          onClick={() => onToggleAll?.(true)}
        >
          Show all
        </button>
      </div>
    </div>
  );
};

export default GlobalColVisibilityPopover;
