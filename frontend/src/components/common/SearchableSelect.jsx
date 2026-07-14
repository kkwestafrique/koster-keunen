import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// Searchable listbox — the live site uses this pattern (not a native
// <select>) for Country / State / LGA in the Add flow and for the Village
// filter on the Beekeeper List, so it can't be a plain shadcn Select.
export default function SearchableSelect({
  value, onChange, options, placeholder = 'Select...', disabled, testId, emptyText = 'No results found.',
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className="w-full justify-between font-normal bg-white border-[#cfd8e6] text-[#032b71] hover:bg-white disabled:opacity-50"
        >
          <span className={`truncate ${selected ? '' : 'text-[#7089b4]'}`}>{selected ? selected.label : placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 text-[#7089b4]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white" align="start">
        <Command>
          <CommandInput placeholder="Search..." data-testid={testId && `${testId}-search`} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
