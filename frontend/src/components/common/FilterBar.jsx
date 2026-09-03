import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SearchableSelect from '@/components/common/SearchableSelect';

// Standard filter bar: search box on the left, dropdown filters to the right.
// Real feedback confirmed via independent audit (M3): search only ever
// committed on Enter or losing focus, with zero visible affordance that
// Enter was required -- reads as broken to anyone typing and expecting
// live results. Now debounces automatically (350ms after typing stops),
// while Enter/blur still commit immediately for anyone who wants instant
// results without waiting.
// Individual filters can opt into `searchable: true` (e.g. the Village
// filter on the Beekeeper List) to render as a searchable listbox instead
// of a plain dropdown — matches the live site's Country/State/LGA/Village
// pattern for long option lists.
export default function FilterBar({ search, onSearchChange, searchPlaceholder = 'Search...', filters = [], testId = 'filter-bar' }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(search || '');
  const debounceRef = useRef(null);

  // Keep the draft in sync if the applied search is cleared/changed elsewhere
  useEffect(() => { setDraft(search || ''); }, [search]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const commit = (value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value !== search) onSearchChange(value);
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(value), 350);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4" data-testid={testId}>
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a6f9a]" />
        <Input
          data-testid={`${testId}-search-input`}
          aria-label={searchPlaceholder}
          value={draft}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(draft); } }}
          onBlur={() => commit(draft)}
          placeholder={searchPlaceholder}
          className="pl-9 bg-white border-[#cfd8e6] text-[#032b71] focus-visible:ring-[#0f48aa]"
        />
      </div>
      {filters.map((f) => (
        f.searchable ? (
          <div key={f.key} className="w-[180px]">
            <SearchableSelect
              testId={`${testId}-filter-${f.key}`}
              value={f.value || 'all'}
              onChange={(v) => f.onChange(v === 'all' ? '' : v)}
              placeholder={f.label}
              options={[{ value: 'all', label: f.label }, ...f.options]}
            />
          </div>
        ) : (
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
              <SelectItem value="all">{f.label}</SelectItem>
              {f.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      ))}
    </div>
  );
}
