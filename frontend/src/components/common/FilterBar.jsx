import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Standard filter bar: search box on the left, dropdown filters to the right
export default function FilterBar({ search, onSearchChange, searchPlaceholder = 'Search...', filters = [], testId = 'filter-bar' }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4" data-testid={testId}>
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7089b4]" />
        <Input
          data-testid={`${testId}-search-input`}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 bg-white border-[#cfd8e6] text-[#032b71] focus-visible:ring-[#0f48aa]"
        />
      </div>
      {filters.map((f) => (
        <Select
          key={f.key}
          value={f.value || 'all'}
          onValueChange={(v) => f.onChange(v === 'all' ? '' : v)}
        >
          <SelectTrigger
            data-testid={`${testId}-filter-${f.key}`}
            className="w-[160px] bg-white border-[#cfd8e6] text-[#032b71]"
          >
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {f.label}</SelectItem>
            {f.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
