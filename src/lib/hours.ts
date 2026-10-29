import OpeningHours from 'opening_hours';
import type { Category, OpenStatus } from '../types';

const TZ = 'Asia/Manila';
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The opening_hours library reads local date fields. Butuan hours are Philippine
 * time, so build a Date whose local fields equal the current Manila wall clock.
 */
export function manilaWallClock(base = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(base);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

export function parseHours(value: string | null | undefined): OpeningHours | null {
  if (!value) return null;
  try {
    return new OpeningHours(value);
  } catch {
    return null; // malformed tag: treat as unknown rather than guessing
  }
}

/** Sample the whole week every 30 min to classify the schedule. */
export function classify(oh: OpeningHours | null): Category {
  if (!oh) return 'unknown';
  const monday = manilaWallClock();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  let allOpen = true;
  let late = false;
  for (let d = 0; d < 7; d++) {
    for (let slot = 0; slot < 48; slot++) {
      const t = new Date(monday);
      t.setDate(monday.getDate() + d);
      t.setHours(Math.floor(slot / 2), (slot % 2) * 30);
      const open = oh.getState(t);
      if (!open) allOpen = false;
      const hour = t.getHours();
      if (open && (hour >= 23 || hour < 4)) late = true; // trading between 11 PM and 4 AM
    }
  }
  return allOpen ? 'always' : late ? 'late' : 'day';
}

export function openStatus(oh: OpeningHours | null, now = manilaWallClock()): OpenStatus | null {
  if (!oh) return null;
  const next = oh.getNextChange(now);
  return {
    isOpen: oh.getState(now),
    changeAt: next ? `${pad(next.getHours())}:${pad(next.getMinutes())}` : null,
  };
}
