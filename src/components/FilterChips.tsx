'use client';

import type { Amenity, Category, Filters } from '@/types';
import { AMENITY_LABEL, CATEGORY_LABEL } from '@/lib/cafes';

interface Props {
  filters: Filters;
  counts: Record<Category, number>;
  total: number;
  onChange: (next: Filters) => void;
  /** One horizontally scrolling row (mobile) instead of wrapping groups (desktop). */
  scroll?: boolean;
}

const CATEGORIES: Array<Category | 'all'> = ['all', 'always', 'late', 'day', 'unknown'];

const chip =
  'inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-ink px-3.5 text-[13px] ' +
  'hover:border-muted aria-pressed:border-sand aria-pressed:bg-sand aria-pressed:text-ink md:min-h-9 md:px-3';

export function FilterChips({ filters, counts, total, onChange, scroll = false }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleAmenity = (a: Amenity) =>
    set({
      amenities: filters.amenities.includes(a)
        ? filters.amenities.filter((x) => x !== a)
        : [...filters.amenities, a],
    });

  const typeChips = CATEGORIES.map((c) => (
    <button key={c} type="button" className={chip} aria-pressed={filters.category === c} onClick={() => set({ category: c })}>
      {c === 'all' ? 'All' : CATEGORY_LABEL[c]}
      <span className="font-mono text-xs opacity-70">{c === 'all' ? total : counts[c]}</span>
    </button>
  ));
  const moreChips = [
    <button key="open" type="button" className={chip} aria-pressed={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>
      Open now
    </button>,
    ...(Object.keys(AMENITY_LABEL) as Amenity[]).map((a) => (
      <button key={a} type="button" className={chip} aria-pressed={filters.amenities.includes(a)} onClick={() => toggleAmenity(a)}>
        {AMENITY_LABEL[a]}
      </button>
    )),
  ];

  if (scroll) {
    return (
      <div role="group" aria-label="Filters" className="flex flex-nowrap gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {typeChips}
        {moreChips}
      </div>
    );
  }
  return (
    <div className="grid gap-2.5">
      <div role="group" aria-label="Café type" className="flex flex-wrap gap-2">{typeChips}</div>
      <div role="group" aria-label="More filters" className="flex flex-wrap gap-2">{moreChips}</div>
    </div>
  );
}
