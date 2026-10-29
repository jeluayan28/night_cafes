'use client';

import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchInput({ value, onChange, className = '' }: Props) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">Search cafés by name, street, address or barangay</span>
      <Search aria-hidden className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
      <input
        type="search"
        enterKeyHint="search"
        placeholder="Search café, street or barangay…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-line bg-ink py-2 pl-10 pr-3 text-base text-text placeholder:text-muted md:min-h-10 md:text-sm"
      />
    </label>
  );
}
