import { Popover } from '@headlessui/react';
import { Search, FileText, Clipboard, ImageIcon, CheckSquare, List, Hash } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

interface AddFieldPopoverProps {
  onAddField: (type: 'TEXT'|'NUMBER') => void;
}

export default function AddFieldPopover({ onAddField }: AddFieldPopoverProps) {
  const groups = [
    {
      title: 'Standard fields',
      items: [
        { label: 'Single line text',      icon: FileText,         type: 'TEXT' },
        { label: 'Number',               icon: Hash,              type: 'NUMBER' },
      ] as const,
    },
    // you can add “Field agents” or other groups here if you want
  ] as const;

  return (
    <div className="w-full max-h-80 overflow-auto">
      {/* Search bar */}
      <div className="p-2">
        <div className="relative text-gray-500">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"/>
          <input
            type="text"
            placeholder="Find a field type"
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Field groups */}
      {groups.map(group => (
        <div key={group.title} className="pt-2">
          <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
            {group.title}
          </div>
          <ul>
            {group.items.map(item => (
              <li key={item.type}>
                <button
                  onClick={() => onAddField(item.type)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <item.icon className="w-4 h-4 text-gray-500"/>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
