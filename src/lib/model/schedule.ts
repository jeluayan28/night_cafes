import type { Category, OpenStatus } from '@/types';
import {
  WEEKDAYS,
  type DaySchedule,
  type OpenState,
  type TimeRange,
  type Weekday,
  type WeeklySchedule,
} from './schedule-types';

export const TIMEZONE = 'Asia/Manila';
const DAY = 1440;
const WEEK = 7 * DAY;
const LATE_FROM = 23 * 60; // "late" = trading at any point between 23:00 and 04:00
const LATE_TO = 28 * 60;
const pad = (n: number) => String(n).padStart(2, '0');

const UTC_DOW: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SHORT_DAY: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const LONG_DAY: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------- construction

export const UNKNOWN_DAY: DaySchedule = { status: 'unknown' };

export function unknownSchedule(sourceText: string | null = null, unmodeled: string[] = []): WeeklySchedule {
  return {
    version: 1,
    timezone: TIMEZONE,
    status: 'unknown',
    days: Object.fromEntries(WEEKDAYS.map((d) => [d, UNKNOWN_DAY])) as WeeklySchedule['days'],
    special: [],
    unmodeled_rules: unmodeled,
    source_text: sourceText,
  };
}

// ----------------------------------------------------------------- wall clock

export interface WallTime {
  /** "YYYY-MM-DD" in Asia/Manila. */
  date: string;
  weekday: Weekday;
  /** Minutes since midnight, 0–1439. */
  minutes: number;
}

/** The Asia/Manila calendar date and time at `at`, independent of the visitor's timezone. */
export function manilaWallTime(at: Date = new Date()): WallTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const date = `${get('year')}-${pad(get('month'))}-${pad(get('day'))}`;
  return { date, weekday: weekdayOf(date), minutes: (get('hour') % 24) * 60 + get('minute') };
}

// Calendar maths uses UTC so it can never be shifted by a visitor's own timezone or DST.
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const addDays = (date: string, n: number) => new Date((dayNumber(date) + n) * 86_400_000).toISOString().slice(0, 10);
export const weekdayOf = (date: string): Weekday => UTC_DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** "HH:MM" -> minutes. "24:00" -> 1440. */
export const clockToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const minutesToClock = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// ------------------------------------------------------------------ resolving

function dayFor(s: WeeklySchedule, date: string): DaySchedule {
  if (s.status === 'unknown') return UNKNOWN_DAY;
  const special = s.special.find((x) => x.date === date) ?? s.special.find((x) => x.recurring === date.slice(5));
  return special ? special.day : s.days[weekdayOf(date)];
}

/** Open periods that START on `date`: [start, end) minutes from that midnight; end > 1440 means overnight. */
function periodsStarting(s: WeeklySchedule, date: string): Array<[number, number]> {
  const day = dayFor(s, date);
  if (day.status !== 'open') return [];
  return day.ranges.map(({ open, close }) => {
    const o = clockToMinutes(open);
    const c = clockToMinutes(close);
    return [o, c > o ? c : c + DAY];
  });
}

// ------------------------------------------------------------- open / closed

function stateAt(s: WeeklySchedule, w: WallTime): OpenState {
  if (periodsStarting(s, w.date).some(([a, b]) => w.minutes >= a && w.minutes < b)) return 'open';
  // A period that began yesterday evening and is still running.
  if (periodsStarting(s, addDays(w.date, -1)).some(([, b]) => b > DAY && w.minutes < b - DAY)) return 'open';
  if (s.status === 'unknown' || dayFor(s, w.date).status === 'unknown') return 'unknown';
  return 'closed';
}

/** Current state, calculated from the schedule and Asia/Manila time. Never stored. */
export const openState = (s: WeeklySchedule, at: Date = new Date()): OpenState => stateAt(s, manilaWallTime(at));

/** Minute (relative to today's midnight) of the next open/close flip within ~8 days, or null. */
function nextChangeMinute(s: WeeklySchedule, w: WallTime): number | null {
  const spans: Array<[number, number]> = [];
  for (let off = -1; off <= 8; off++) {
    for (const [a, b] of periodsStarting(s, addDays(w.date, off))) spans.push([off * DAY + a, off * DAY + b]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  const now = w.minutes;
  const current = merged.find(([a, b]) => a <= now && now < b);
  if (current) return current[1] >= 9 * DAY ? null : current[1]; // open to the end of the window: effectively never closes
  return merged.find(([a]) => a > now)?.[0] ?? null;
}

function labelFor(date: string, minute: number): string {
  const offset = Math.floor(minute / DAY);
  const clock = minutesToClock(minute - offset * DAY);
  return offset === 0 ? clock : `${SHORT_DAY[weekdayOf(addDays(date, offset))]} ${clock}`;
}

/** What the UI shows: open / closed / unknown plus when it next changes, e.g. "22:00" or "Thu 02:00". */
export function openStatus(s: WeeklySchedule, at: Date = new Date()): OpenStatus {
  const w = manilaWallTime(at);
  const state = stateAt(s, w);
  const next = state === 'unknown' ? null : nextChangeMinute(s, w);
  return { isOpen: state === 'open', unknown: state === 'unknown', changeAt: next === null ? null : labelFor(w.date, next) };
}

// ------------------------------------------------------------ classification

type Span = [number, number];

function merge(spans: Span[]): Span[] {
  const sorted = spans.map((s) => [...s] as Span).sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else out.push(s);
  }
  return out;
}

/** Regular weekly spans in minutes from Monday 00:00; Sunday-night overflow wraps into Monday. */
function weekSpans(s: WeeklySchedule): Span[] {
  const spans: Span[] = [];
  WEEKDAYS.forEach((wd, i) => {
    const day = s.days[wd];
    if (day.status !== 'open') return;
    for (const { open, close } of day.ranges) {
      const o = clockToMinutes(open);
      const c = clockToMinutes(close);
      const start = i * DAY + o;
      const end = i * DAY + (c > o ? c : c + DAY);
      spans.push([start, end]);
      if (end > WEEK) spans.push([0, end - WEEK]);
    }
  });
  return merge(spans);
}

const coversFullDay = (day: DaySchedule) =>
  day.status === 'open' &&
  merge(day.ranges.map((r): Span => [clockToMinutes(r.open), clockToMinutes(r.close)])).some(([a, b]) => a <= 0 && b >= DAY);

/**
 * - always:  verified 24/7. All seven days open, every minute of the week covered,
 *            no special hours that close or shorten a day, and no rules we couldn't model.
 * - late:    trades at some point between 23:00 and 04:00 on at least one night.
 * - day:     known hours, but not late.
 * - unknown: no usable hours.
 */
export function categorize(s: WeeklySchedule): Category {
  if (s.status === 'unknown') return 'unknown';
  const spans = weekSpans(s);
  const allDaysOpen = WEEKDAYS.every((d) => s.days[d].status === 'open');
  const coversWeek = spans.length === 1 && spans[0][0] <= 0 && spans[0][1] >= WEEK;
  if (
    allDaysOpen && coversWeek &&
    s.unmodeled_rules.length === 0 &&
    s.special.every((x) => coversFullDay(x.day))
  ) {
    return 'always';
  }
  if (spans.length === 0) return 'unknown';
  const overlaps = (a: number, b: number) => spans.some(([x, y]) => x < b && y > a);
  for (let d = 0; d < 7; d++) {
    const a = d * DAY + LATE_FROM;
    const b = d * DAY + LATE_TO;
    if (overlaps(a, b) || overlaps(a - WEEK, b - WEEK)) return 'late';
  }
  return 'day';
}

// ------------------------------------------------------------------- display

export interface DayRow {
  weekday: Weekday;
  day: string;
  kind: 'open' | 'closed' | 'unknown';
  /** One line per range. Overnight ranges end with "(+1)". */
  lines: string[];
}

const formatRange = ({ open, close }: TimeRange) => {
  if (open === '00:00' && close === '24:00') return 'Open 24 hours';
  return `${open}–${close}${clockToMinutes(close) < clockToMinutes(open) ? ' (+1)' : ''}`;
};

function describeDay(day: DaySchedule): { kind: DayRow['kind']; lines: string[] } {
  if (day.status === 'open') return { kind: 'open', lines: day.ranges.map(formatRange) };
  if (day.status === 'closed') return { kind: 'closed', lines: ['Closed'] };
  return { kind: 'unknown', lines: ['Not confirmed'] };
}

export const weeklyRows = (s: WeeklySchedule): DayRow[] =>
  WEEKDAYS.map((weekday) => ({ weekday, day: LONG_DAY[weekday], ...describeDay(s.days[weekday]) }));

export interface SpecialRow {
  when: string;
  label: string | null;
  lines: string[];
}

const formatMonthDay = (md: string) => `${Number(md.slice(3))} ${MONTHS[Number(md.slice(0, 2)) - 1]}`;

export const specialRows = (s: WeeklySchedule): SpecialRow[] =>
  s.special.map((x) => ({
    when: x.recurring ? `Every ${formatMonthDay(x.recurring)}` : `${Number(x.date!.slice(8))} ${MONTHS[Number(x.date!.slice(5, 7)) - 1]} ${x.date!.slice(0, 4)}`,
    label: x.label ?? null,
    lines: describeDay(x.day).lines,
  }));

/** Compact one-liner for cards, e.g. "Mon–Fri 08:00–17:00 · Sat 09:00–12:00". Null when unknown. */
export function summarizeHours(s: WeeklySchedule): string | null {
  if (s.status === 'unknown') return null;
  const rows = weeklyRows(s);
  if (rows.every((r) => r.kind === 'open' && r.lines.join() === 'Open 24 hours')) return 'Open 24 hours, daily';
  const groups: Array<{ from: number; to: number; text: string }> = [];
  rows.forEach((r, i) => {
    if (r.kind !== 'open') return;
    const text = r.lines.join(', ');
    const last = groups[groups.length - 1];
    if (last && last.to === i - 1 && last.text === text) last.to = i;
    else groups.push({ from: i, to: i, text });
  });
  if (groups.length === 0) return rows.some((r) => r.kind === 'unknown') ? null : 'Closed all week';
  if (groups.length === 1 && groups[0].from === 0 && groups[0].to === 6) return `Daily ${groups[0].text}`;
  const name = (i: number) => SHORT_DAY[WEEKDAYS[i]];
  return groups.map((g) => `${g.from === g.to ? name(g.from) : `${name(g.from)}–${name(g.to)}`} ${g.text}`).join(' · ');
}

// ---------------------------------------------------------------- validation

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function validDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validateDay(day: unknown, where: string, errors: string[]) {
  if (!isRecord(day)) return errors.push(`${where}: must be an object`);
  if (day.status === 'closed' || day.status === 'unknown') {
    if ('ranges' in day) errors.push(`${where}: ${day.status} days must not have ranges`);
    return;
  }
  if (day.status !== 'open') return errors.push(`${where}: status must be open, closed or unknown`);
  const ranges = day.ranges;
  if (!Array.isArray(ranges) || ranges.length === 0) return errors.push(`${where}: open days need at least one range`);
  const parsed: Array<[number, number]> = [];
  for (const [i, r] of ranges.entries()) {
    const at = `${where}.ranges[${i}]`;
    if (!isRecord(r) || typeof r.open !== 'string' || typeof r.close !== 'string') {
      errors.push(`${at}: needs open and close`);
      continue;
    }
    if (!CLOCK.test(r.open)) errors.push(`${at}: open must be HH:MM (00:00–23:59)`);
    if (!CLOCK.test(r.close) && r.close !== '24:00') errors.push(`${at}: close must be HH:MM or 24:00`);
    if (r.open === r.close) errors.push(`${at}: open and close are equal (use 00:00–24:00 for a full day)`);
    if (CLOCK.test(r.open) && (CLOCK.test(r.close) || r.close === '24:00') && r.open !== r.close) {
      const o = clockToMinutes(r.open);
      const c = clockToMinutes(r.close);
      parsed.push([o, c > o ? c : c + DAY]);
    }
  }
  parsed.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i][0] < parsed[i - 1][1]) errors.push(`${where}: ranges overlap`);
    else if (parsed[i][0] === parsed[i - 1][1] && parsed[i - 1][1] <= DAY) errors.push(`${where}: ranges touch; merge them`);
  }
}

/** Returns a list of problems; empty means the schedule is valid. */
export function validateSchedule(input: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(input)) return ['schedule must be an object'];
  if (input.version !== 1) errors.push('version must be 1');
  if (input.timezone !== TIMEZONE) errors.push(`timezone must be ${TIMEZONE}`);
  if (input.status !== 'known' && input.status !== 'unknown') errors.push('status must be known or unknown');
  if (!Array.isArray(input.unmodeled_rules) || input.unmodeled_rules.some((r) => typeof r !== 'string')) errors.push('unmodeled_rules must be an array of strings');
  if (input.source_text !== null && typeof input.source_text !== 'string') errors.push('source_text must be a string or null');

  if (!isRecord(input.days)) {
    errors.push('days must be an object');
  } else {
    const extra = Object.keys(input.days).filter((k) => !(WEEKDAYS as readonly string[]).includes(k));
    if (extra.length) errors.push(`days has unknown keys: ${extra.join(', ')}`);
    for (const d of WEEKDAYS) {
      validateDay(input.days[d], `days.${d}`, errors);
      if (input.status === 'unknown' && isRecord(input.days[d]) && (input.days[d] as { status?: unknown }).status !== 'unknown') {
        errors.push(`days.${d}: an unknown schedule must have only unknown days`);
      }
    }
    // Overnight spill must not run into the next day's own first range.
    WEEKDAYS.forEach((d, i) => {
      const today = input.days as Record<string, DaySchedule>;
      const day = today[d];
      const next = today[WEEKDAYS[(i + 1) % 7]];
      if (day?.status !== 'open' || next?.status !== 'open') return;
      const spill = Math.max(0, ...day.ranges.map((r) => clockToMinutes(r.close) < clockToMinutes(r.open) ? clockToMinutes(r.close) : 0));
      const firstNext = Math.min(...next.ranges.map((r) => clockToMinutes(r.open)));
      if (spill > firstNext) errors.push(`days.${d}: overnight range overlaps the start of ${WEEKDAYS[(i + 1) % 7]}`);
    });
  }

  if (!Array.isArray(input.special)) {
    errors.push('special must be an array');
  } else {
    const seen = new Set<string>();
    for (const [i, x] of input.special.entries()) {
      const at = `special[${i}]`;
      if (!isRecord(x)) { errors.push(`${at}: must be an object`); continue; }
      const hasDate = typeof x.date === 'string';
      const hasRec = typeof x.recurring === 'string';
      if (hasDate === hasRec) errors.push(`${at}: set exactly one of date or recurring`);
      if (hasDate) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x.date as string);
        if (!m || !validDate(+m[1], +m[2], +m[3])) errors.push(`${at}: date must be a real YYYY-MM-DD`);
      }
      if (hasRec) {
        const m = /^(\d{2})-(\d{2})$/.exec(x.recurring as string);
        if (!m || !validDate(2000, +m[1], +m[2])) errors.push(`${at}: recurring must be a real MM-DD`);
      }
      if (x.label !== undefined && typeof x.label !== 'string') errors.push(`${at}: label must be a string`);
      const key = `${x.date ?? ''}|${x.recurring ?? ''}`;
      if (seen.has(key)) errors.push(`${at}: duplicate special date`);
      seen.add(key);
      validateDay(x.day, `${at}.day`, errors);
    }
  }
  return errors;
}
