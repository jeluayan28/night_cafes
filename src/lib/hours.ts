import OpeningHours from 'opening_hours';
import type { Category, OpenStatus } from '../types';

const TZ = 'Asia/Manila';
const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = 7 * 24 * 60; // minutes
const LATE_FROM = 23 * 60; // "late" = trading at any point between 23:00 and 04:00
const LATE_TO = 28 * 60;

/**
 * The opening_hours library reads local date fields. Butuan hours are Philippine
 * time, so build a Date whose local fields equal the Manila wall clock at `base`.
 * Everything below works on these wall-clock Dates and never adds milliseconds,
 * so a visitor's own timezone or DST cannot shift the result.
 */
export function manilaWallClock(base = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(base);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

/** Public/school-holiday selectors need holiday data we don't have. */
const HOLIDAY = /(?:^|[^A-Za-z])(?:PH|SH)(?:[^A-Za-z]|$)/;

export const usesHolidays = (value: string | null | undefined) => HOLIDAY.test(value ?? '');

/**
 * Parses an OSM schedule. If it contains holiday rules the library cannot evaluate, the
 * ordinary weekly rules are used instead (and classify() refuses to verify 24/7 for it).
 */
export function parseHours(value: string | null | undefined): OpeningHours | null {
  if (!value) return null;
  const weekly = value.split(';').filter((r) => !HOLIDAY.test(r)).join(';');
  for (const candidate of [value, weekly]) {
    try {
      return new OpeningHours(candidate);
    } catch {
      // try the next candidate; malformed tags end up unknown rather than guessed
    }
  }
  return null;
}

const wallMinutes = (d: Date) =>
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) / 60000;

/** Monday 00:00 of the week containing `ref` (wall clock). */
function weekStart(ref: Date): Date {
  const mondayOffset = (ref.getDay() + 6) % 7;
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - mondayOffset);
}

interface Interval { start: number; end: number }

/** Exact open intervals for the week, in minutes from Monday 00:00. Overnight hours run past midnight. */
function weekIntervals(oh: OpeningHours, monday: Date): { intervals: Interval[]; uncertain: boolean } {
  const origin = wallMinutes(monday);
  const limit = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  const it = oh.getIterator(monday);
  const intervals: Interval[] = [];
  let uncertain = it.getUnknown();
  let openedAt: number | null = it.getState() ? 0 : null;

  for (let guard = 0; guard < 500 && it.advance(limit); guard++) {
    const t = wallMinutes(it.getDate()) - origin;
    if (t >= WEEK) break;
    uncertain ||= it.getUnknown();
    const open = it.getState();
    if (open && openedAt === null) openedAt = t;
    else if (!open && openedAt !== null) {
      intervals.push({ start: openedAt, end: t });
      openedAt = null;
    }
  }
  if (openedAt !== null) intervals.push({ start: openedAt, end: WEEK });
  return { intervals, uncertain };
}

const overlaps = (list: Interval[], from: number, to: number) =>
  list.some((i) => i.start < to && i.end > from);

/**
 * - always:  verified 24/7 — open every minute of the week AND never scheduled to
 *            close (no seasonal or holiday exceptions), with no unknown states.
 * - late:    trades at some point between 23:00 and 04:00 on at least one night.
 * - day:     hours known, but not late.
 * - unknown: no usable hours.
 */
export function classify(oh: OpeningHours | null, ref = manilaWallClock(), raw?: string | null): Category {
  if (!oh) return 'unknown';
  const monday = weekStart(ref);
  const { intervals, uncertain } = weekIntervals(oh, monday);

  const coversWeek = intervals.length === 1 && intervals[0].start === 0 && intervals[0].end === WEEK;
  if (
    coversWeek && !uncertain && !usesHolidays(raw) &&
    oh.getWarnings().length === 0 &&
    oh.getNextChange(monday) === undefined // never closes, in any week of the year
  ) {
    return 'always';
  }

  if (uncertain && intervals.length === 0) return 'unknown';
  for (let d = 0; d < 7; d++) {
    const a = d * 1440 + LATE_FROM;
    const b = d * 1440 + LATE_TO;
    // Sunday night continues into Monday morning, so test the wrapped window too.
    if (overlaps(intervals, a, b) || overlaps(intervals, a - WEEK, b - WEEK)) return 'late';
  }
  return 'day';
}

export function openStatus(oh: OpeningHours | null, now = manilaWallClock()): OpenStatus | null {
  if (!oh) return null;
  const unknown = oh.getUnknown(now);
  const next = oh.getNextChange(now);
  let changeAt: string | null = null;
  if (next) {
    const time = `${pad(next.getHours())}:${pad(next.getMinutes())}`;
    const sameDay = next.toDateString() === now.toDateString();
    changeAt = sameDay ? time : `${DAYS[next.getDay()]} ${time}`;
  }
  return { isOpen: !unknown && oh.getState(now), unknown, changeAt };
}
