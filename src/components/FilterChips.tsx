'use client';

import type { Feature, Filters, Schedule } from '@/types';
import { FEATURE_HELP, FEATURE_LABEL, SCHEDULE_HELP, SCHEDULE_LABEL, type chipCounts } from '@/lib/cafes';

type Counts = ReturnType<typeof chipCounts>;

interface Props {
  filters: Filters;
  counts: Counts;
  /** False until the Manila clock is available, so "Open now" doesn't flash a wrong count. */
  clockReady: boolean;
  onChange: (next: Filters) => void;
  /** One horizontally scrolling row (phone) instead of two labelled, wrapping groups. */
  scroll?: boolean;
}

const SCHEDULES: Schedule[] = ['all', 'always', 'late'];
const FEATURES: Feature[] = ['study', 'wifi', 'power', 'aircon', 'parking', 'budget'];

const chipClass =
  'inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-ink px-3.5 text-[13px] ' +
  'hover:border-muted aria-pressed:border-sand aria-pressed:bg-sand aria-pressed:text-ink md:min-h-9 md:px-3';

interface ChipProps {
  label: string;
  count?: number;
  pressed: boolean;
  title: string;
  onClick: () => void;
}

/** A count of 0 stays selectable: choosing it explains that nothing is recorded yet. */
function Chip({ label, count, pressed, title, onClick }: ChipProps) {
  return (
    <button
      type="button"
      className={`${chipClass} ${count === 0 && !pressed ? 'opacity-60' : ''}`}
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
    >
      {label}
      {count !== undefined && <span className="font-mono text-xs opacity-70">{count}</span>}
    </button>
  );
}

export function FilterChips({ filters, counts, clockReady, onChange, scroll = false }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleFeature = (f: Feature) =>
    set({ features: filters.features.includes(f) ? filters.features.filter((x) => x !== f) : [...filters.features, f] });

  const scheduleChips = SCHEDULES.map((s) => (
    <Chip key={s} label={SCHEDULE_LABEL[s]} count={counts.schedule[s]} pressed={filters.schedule === s} title={SCHEDULE_HELP[s]} onClick={() => set({ schedule: s })} />
  ));
  const openNowChip = (
    <Chip
      key="open"
      label="Open now"
      count={clockReady ? counts.open : undefined}
      pressed={filters.openNow}
      title="Open at this moment, Philippine time. Not the same as open 24/7."
      onClick={() => set({ openNow: !filters.openNow })}
    />
  );
  const featureChips = FEATURES.map((f) => (
    <Chip key={f} label={FEATURE_LABEL[f]} count={counts.features[f]} pressed={filters.features.includes(f)} title={FEATURE_HELP[f]} onClick={() => toggleFeature(f)} />
  ));

  if (scroll) {
    return (
      <div role="group" aria-label="Filters" className="flex flex-nowrap gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {scheduleChips}
        {openNowChip}
        {featureChips}
      </div>
    );
  }
  const label = 'mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted';
  return (
    <div className="grid gap-3">
      <div role="group" aria-label="Schedule">
        <p className={label} aria-hidden>Schedule</p>
        <div className="flex flex-wrap gap-2">{scheduleChips}{openNowChip}</div>
      </div>
      <div role="group" aria-label="Features">
        <p className={label} aria-hidden>Features</p>
        <div className="flex flex-wrap gap-2">{featureChips}</div>
      </div>
    </div>
  );
}
