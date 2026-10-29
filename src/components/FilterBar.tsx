'use client';

import { Search } from 'lucide-react';
import type { Amenity, Category, Filters } from '@/types';
import { AMENITY_LABEL, CATEGORY_LABEL } from '@/lib/cafes';

interface Props {
  filters: Filters;
  counts: Record<Category, number>;
  total: number;
  onChange: (next: Filters) => void;
}

const CATEGORIES: Array<Category | 'all'> = ['all', 'always', 'late', 'day', 'unknown'];

const chip =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] ' +
  'hover:border-muted aria-pressed:border-sand aria-pressed:bg-sand aria-pressed:text-ink';

export function FilterBar({ filters, counts, total, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleAmenity = (a: Amenity) =>
    set({
      amenities: filters.amenities.includes(a)
        ? filters.amenities.filter((x) => x !== a)
        : [...filters.amenities, a],
    });

  return (
    <div className="grid gap-3">
      <label className="relative block">
        <span className="sr-only">Search cafés by name, street or cuisine</span>
        <Search aria-hidden className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search cafés, streets, cuisine…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          className="min-h-11 w-full rounded-xl border border-line bg-ink py-2.5 pl-10 pr-3 text-text placeholder:text-muted"
        />
      </label>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Café type">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={chip} aria-pressed={filters.category === c} onClick={() => set({ category: c })}>
            {c === 'all' ? 'All' : CATEGORY_LABEL[c]}
            <span className="font-mono text-xs opacity-70">{c === 'all' ? total : counts[c]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="More filters">
        <button type="button" className={`${chip} !min-h-8 !py-1 !text-[12.5px]`} aria-pressed={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>
          Open now
        </button>
        {(Object.keys(AMENITY_LABEL) as Amenity[]).map((a) => (
          <button key={a} type="button" className={`${chip} !min-h-8 !py-1 !text-[12.5px]`} aria-pressed={filters.amenities.includes(a)} onClick={() => toggleAmenity(a)}>
            {AMENITY_LABEL[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
