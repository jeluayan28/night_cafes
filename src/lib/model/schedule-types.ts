/**
 * Weekly schedule: the single source of truth for opening hours.
 *
 * Stored as JSON (the `weekly_hours` jsonb column). "Open now" is never stored; it
 * is calculated from this document and the current Asia/Manila time (see schedule.ts).
 *
 * Conventions
 * - Times are 24-hour "HH:MM" in Asia/Manila.
 * - A range belongs to the day it STARTS on. If `close` is earlier than `open`, the
 *   range runs overnight and closes the next morning ("18:00"–"02:00").
 * - "24:00" is allowed only as a close time. A whole day is "00:00"–"24:00".
 * - `open` must differ from `close`, and ranges on one day must not touch or overlap
 *   (merge them), so each schedule has exactly one canonical form.
 */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface TimeRange {
  open: string;
  close: string;
}

/**
 * - open:    trades during `ranges` (at least one).
 * - closed:  confirmed closed all day.
 * - unknown: nobody has recorded what happens this day. Never treated as closed.
 */
export type DaySchedule =
  | { status: 'open'; ranges: TimeRange[] }
  | { status: 'closed' }
  | { status: 'unknown' };

/**
 * Special hours replace the regular schedule for ranges STARTING on that date, e.g.
 * closed on Christmas Day or short hours on a one-off date. An overnight range that
 * began the previous evening still finishes normally. Exactly one of `date` /
 * `recurring` is set; a one-off `date` beats a `recurring` rule.
 */
export interface SpecialHours {
  /** One-off date, "YYYY-MM-DD". */
  date?: string;
  /** Repeats every year, "MM-DD". */
  recurring?: string;
  label?: string;
  day: DaySchedule;
}

export interface WeeklySchedule {
  version: 1;
  timezone: 'Asia/Manila';
  /** "unknown" = no usable schedule at all; every day is then "unknown". */
  status: 'known' | 'unknown';
  days: Record<Weekday, DaySchedule>;
  special: SpecialHours[];
  /**
   * Rules in the source we could not represent (e.g. public-holiday or seasonal
   * clauses). Any entry means we cannot promise the schedule is complete, so such
   * a café is never marked verified 24/7.
   */
  unmodeled_rules: string[];
  /** The text the schedule was derived from (e.g. the OSM opening_hours tag). */
  source_text: string | null;
}

export type OpenState = 'open' | 'closed' | 'unknown';
