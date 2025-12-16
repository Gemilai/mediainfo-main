import { Menu } from '@base-ui/react/menu';
import { Check, ChevronDown, FileText, Code, FileCode } from 'lucide-react';
import clsx from 'clsx';

interface FormatMenuProps {
  value: string;
  onChange: (value: string) => void;
}

const formats = [
  { value: 'text', label: 'Text Report', icon: FileText },
  { value: 'JSON', label: 'JSON Data', icon: Code },
  { value: 'XML', label: 'XML Document', icon: FileCode },
  { value: 'HTML', label: 'HTML View', icon: FileCode },
  { value: 'EBUCore_1.8_ps', label: 'EBUCore (XML)', icon: FileCode },
];

export function FormatMenu({ value, onChange }: FormatMenuProps) {
  const selectedFormat = formats.find((f) => f.value === value) || formats[0];

  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-full w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-400 hover:text-gray-200 focus:outline-none sm:w-auto sm:justify-start">
        <span className="truncate">{selectedFormat.label}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Menu.Trigger>
      
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8}>
          <Menu.Popup className="z-50 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#141414] p-1.5 shadow-xl shadow-black/50 backdrop-blur-xl ring-1 ring-white/5">
            <Menu.RadioGroup value={value} onValueChange={onChange}>
              {formats.map((format) => (
                <Menu.RadioItem
                  key={format.value}
                  value={format.value}
                  className="group flex cursor-default select-none items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-400 outline-none transition-colors hover:bg-white/5 hover:text-white data-checked:text-white"
                  closeOnClick
                >
                  <div className="flex items-center gap-3">
                    <format.icon className="h-4 w-4 text-gray-600 group-hover:text-gray-400 group-data-checked:text-blue-500" />
                    <span>{format.label}</span>
                  </div>
                  <Menu.RadioItemIndicator>
                    <Check className="h-3.5 w-3.5 text-blue-500" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
