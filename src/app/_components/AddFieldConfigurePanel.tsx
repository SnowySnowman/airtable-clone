// AddFieldConfigurePanel.tsx
import { Fragment, forwardRef, type JSX } from 'react';
import { ChevronDown, Hash, Type } from 'lucide-react';
import { Listbox, Transition } from '@headlessui/react';

type FieldType = 'TEXT' | 'NUMBER';

const FIELD_META: Record<FieldType, { label: string; icon: JSX.Element }> = {
  TEXT:   { label: 'Single line text', icon: <Type className="w-4 h-4" /> },
  NUMBER: { label: 'Number',           icon: <Hash className="w-4 h-4" /> },
};

type Props = {
  type: FieldType;
  name: string;
  setName: (s: string) => void;
  onChangeType: (t: FieldType) => void;
  onCancel: () => void;
  onCreate: () => void;
};

const AddFieldConfigurePanel = forwardRef<HTMLDivElement, Props>(function AddFieldConfigurePanel(
  { type, name, setName, onChangeType, onCancel, onCreate },
  ref
) {
  return (
    <div
      ref={ref}
      className="w-[420px] bg-white rounded border border-gray-200 shadow overflow-hidden"
    >
      <div className="p-3">
        {/* Field type dropdown */}
        <div className="mb-2">
          <Listbox value={type} onChange={onChangeType}>
            <div className="relative">
              <Listbox.Button className="w-full flex items-center justify-between px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  {FIELD_META[type].icon}
                  <span>{FIELD_META[type].label}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </Listbox.Button>

              <Transition
                as="div"
                enter="transition ease-out duration-100"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow focus:outline-none">
                  {(['TEXT','NUMBER'] as FieldType[]).map((v) => (
                    <Listbox.Option key={v} value={v} className="cursor-pointer">
                      {({ active }) => (
                        <div className={`flex items-center gap-2 px-3 py-2 text-sm ${active ? 'bg-gray-100' : ''}`}>
                          {FIELD_META[v].icon}
                          <span>{FIELD_META[v].label}</span>
                        </div>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>

        {/* Name */}
        <label className="block text-sm text-gray-700 mb-1">Field name (optional)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 mb-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <p className="text-sm text-gray-600 mb-2">
          Enter text, or prefill each new cell with a default value.
        </p>

        <label className="block text-sm text-gray-700 mb-1">Default</label>
        <input
          disabled
          placeholder="Enter default value (optional)"
          className="w-full px-3 py-2 border border-gray-200 rounded bg-gray-50 text-gray-500 cursor-not-allowed mb-2"
        />

        <button type="button" className="text-sm text-gray-700 hover:underline mb-3">
          + Add description
        </button>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm">
            Cancel
          </button>
          <button onClick={onCreate} className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">
            Create field
          </button>
        </div>
      </div>

      <div className="bg-gray-100 border-t border-gray-200 px-3 py-3 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-xs">⋯</span>
            Automate this field with an agent
          </span>
        </div>
        <button type="button" className="px-2 py-1 rounded border border-gray-300 bg-white text-sm hover:bg-gray-50">
          Convert
        </button>
      </div>
    </div>
  );
});

export default AddFieldConfigurePanel;
