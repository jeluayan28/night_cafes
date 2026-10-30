/**
 * OpenStreetMap -> CafeRecord. Server / script use only: it needs the heavy
 * `opening_hours` parser, which therefore never reaches the browser bundle.
 */
import OpeningHours from 'opening_hours';
import type { Amenity, RawCafe } from '@/types';
import { AMENITIES, directionsUrl, slugify, type CafeRecord, type PriceRange, type VerificationPrecision } from './cafe-record';
import { safeHttpUrl } from '../safe';
import { unknownSchedule, validateSchedule } from './schedule';
import type { DaySchedule, SpecialHours, TimeRange, WeeklySchedule } from './schedule-types';
import { WEEKDAYS } from './schedule-types';

const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = 7 * 1440;
const MAX_OVERNIGHT = 12 * 60;
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const HOLIDAY = /(?:^|[^A-Za-z])(?:PH|SH)(?:[^A-Za-z]|$)/;
const SEASONAL = /(?:^|[^A-Za-z])(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week)(?:[^A-Za-z]|$)/i;
const RECURRING_OFF = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+off$/i;

const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const wallMinutes = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) / 60000;

interface Span { start: number; end: number }

/** Exact open spans (minutes from Monday 00:00) for an ordinary week; null if any moment is uncertain. */
function weekSpans(oh: OpeningHours): Span[] | null {
  const monday = new Date(2024, 0, 1); // a Monday; only weekday rules remain, so any ordinary week gives the same answer
  const limit = new Date(2024, 0, 8);
  const origin = wallMinutes(monday);
  const it = oh.getIterator(monday);
  if (it.getUnknown()) return null;
  const spans: Span[] = [];
  let openedAt: number | null = it.getState() ? 0 : null;
  for (let guard = 0; guard < 500 && it.advance(limit); guard++) {
    const t = wallMinutes(it.getDate()) - origin;
    if (t >= WEEK) break;
    if (it.getUnknown()) return null;
    const open = it.getState();
    if (open && openedAt === null) openedAt = t;
    else if (!open && openedAt !== null) {
      spans.push({ start: openedAt, end: t });
      openedAt = null;
    }
  }
  if (openedAt !== null) spans.push({ start: openedAt, end: WEEK });
  return spans;
}

/** Spans -> per-day ranges. A range belongs to the day it starts on; overnight ones close next morning. */
function daysFromSpans(spans: Span[]): WeeklySchedule['days'] {
  const list = spans.map((s) => ({ ...s }));
  // A Sunday-night range that continues into Monday morning is one range, not two.
  if (list.length > 1 && list[0].start === 0 && list[list.length - 1].end === WEEK) {
    const first = list.shift()!;
    list[list.length - 1].end = WEEK + first.end;
  }
  const perDay: TimeRange[][] = Array.from({ length: 7 }, () => []);
  for (const { start, end } of list) {
    let cursor = start;
    while (cursor < end) {
      const index = Math.floor(cursor / 1440);
      const base = index * 1440;
      const dayEnd = base + 1440;
      const slot = perDay[index % 7];
      const overnight = end - dayEnd;
      if (end <= dayEnd) {
        slot.push({ open: hhmm(cursor - base), close: hhmm(end - base) });
        break;
      }
      // Overnight only when it closes earlier than it opened; otherwise split at midnight.
      if (overnight <= MAX_OVERNIGHT && overnight < cursor - base) {
        slot.push({ open: hhmm(cursor - base), close: hhmm(overnight) });
        break;
      }
      slot.push({ open: hhmm(cursor - base), close: '24:00' });
      cursor = dayEnd;
    }
  }
  return Object.fromEntries(
    WEEKDAYS.map((d, i): [string, DaySchedule] => [d, perDay[i].length ? { status: 'open', ranges: perDay[i] } : { status: 'closed' }]),
  ) as WeeklySchedule['days'];
}

/**
 * Converts an OSM `opening_hours` value into a WeeklySchedule, keeping only what it
 * can represent faithfully:
 *  - weekday rules, closed days and overnight ranges become the schedule;
 *  - "Dec 25 off" becomes a recurring special day;
 *  - public/school-holiday clauses are recorded in `unmodeled_rules` (never 24/7);
 *  - seasonal or unparseable rules make the whole schedule "unknown" rather than a guess.
 */
export function scheduleFromOsm(text: string | null | undefined): WeeklySchedule {
  const source = text?.trim() || null;
  if (!source) return unknownSchedule(null);

  const kept: string[] = [];
  const special: SpecialHours[] = [];
  const unmodeled: string[] = [];
  let seasonal = false;
  for (const clause of source.split(';').map((c) => c.trim()).filter(Boolean)) {
    const off = RECURRING_OFF.exec(clause);
    if (off) {
      const month = MONTH_NAMES.indexOf(off[1].toLowerCase()) + 1;
      const day = Number(off[2]);
      if (day >= 1 && day <= 31 && new Date(Date.UTC(2000, month - 1, day)).getUTCMonth() === month - 1) {
        special.push({ recurring: `${pad(month)}-${pad(day)}`, day: { status: 'closed' } });
        continue;
      }
    }
    if (HOLIDAY.test(clause)) unmodeled.push(clause);
    else if (SEASONAL.test(clause)) {
      unmodeled.push(clause);
      seasonal = true;
    } else kept.push(clause);
  }
  if (seasonal || kept.length === 0) return unknownSchedule(source, unmodeled.length ? unmodeled : [source]);

  let spans: Span[] | null = null;
  try {
    spans = weekSpans(new OpeningHours(kept.join('; ')));
  } catch {
    spans = null;
  }
  if (!spans) return unknownSchedule(source, [source]);

  const schedule: WeeklySchedule = {
    version: 1,
    timezone: 'Asia/Manila',
    status: 'known',
    days: daysFromSpans(spans),
    special,
    unmodeled_rules: unmodeled,
    source_text: source,
  };
  // Never emit a schedule the database would reject.
  return validateSchedule(schedule).length === 0 ? schedule : unknownSchedule(source, [source]);
}

// ----------------------------------------------------------------- the record

const isRecorded = (v: string | undefined) => !!v && !['no', '0', 'none'].includes(v.toLowerCase());

const PRICE_MAP: Record<string, PriceRange> = {
  budget: 'budget', cheap: 'budget', low: 'budget', inexpensive: 'budget', $: 'budget', '1': 'budget',
  moderate: 'moderate', medium: 'moderate', mid: 'moderate', $$: 'moderate', '2': 'moderate',
  upscale: 'upscale', expensive: 'upscale', high: 'upscale', premium: 'upscale', $$$: 'upscale', '3': 'upscale',
};

function amenitiesFrom(t: Record<string, string>): Amenity[] {
  const keys = Object.keys(t);
  const has: Record<Amenity, boolean> = {
    wifi: t.internet_access === 'wlan' || t.internet_access === 'yes',
    power: t.power_supply === 'yes' || keys.some((k) => k.startsWith('socket:') && isRecorded(t[k])),
    aircon: t.air_conditioning === 'yes',
    parking: isRecorded(t.parking) || keys.some((k) => k.startsWith('parking:') && isRecorded(t[k])),
    outdoor: t.outdoor_seating === 'yes',
    takeaway: t.takeaway === 'yes' || t.takeaway === 'only',
  };
  return AMENITIES.filter((a) => has[a]);
}

/** Latest valid check date, as an ISO timestamp (midnight Manila) plus how precise it was. */
function verificationFrom(t: Record<string, string>, now: Date) {
  const candidates = [t['opening_hours:check_date'], t.check_date].filter(Boolean).sort().reverse();
  for (const value of candidates) {
    const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
    if (!m) continue;
    const [y, mo, d] = [Number(m[1]), m[2] ? Number(m[2]) : 1, m[3] ? Number(m[3]) : 1];
    const real = new Date(Date.UTC(y, mo - 1, d));
    if (real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d) continue;
    const iso = `${y}-${pad(mo)}-${pad(d)}T00:00:00+08:00`;
    if (Date.parse(iso) > now.getTime()) continue; // a date in the future can't be a check
    const precision: VerificationPrecision = m[3] ? 'day' : m[2] ? 'month' : 'year';
    return { verification_status: 'verified' as const, last_verified_at: iso, last_verified_precision: precision };
  }
  return { verification_status: 'unverified' as const, last_verified_at: null, last_verified_precision: null };
}

export function osmToRecord(raw: RawCafe, importedAt: string): CafeRecord {
  const t = raw.tags;
  const [type, id] = raw.id.split('/');
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const address =
    t['addr:full'] ||
    [t['addr:housename'], street, t['addr:barangay'], t['addr:city'], t['addr:province'], t['addr:postcode']].filter(Boolean).join(', ') ||
    null;
  const photos = (t.image ?? '').split(';').map(safeHttpUrl).filter((u): u is string => u !== null);

  return {
    id: `osm-${type}-${id}`,
    name: raw.name,
    slug: `${slugify(raw.name) || 'cafe'}-${id}`,
    description: (t.description || t['description:en'] || '').trim() || null,
    address,
    barangay: t['addr:barangay'] ?? null,
    latitude: raw.lat,
    longitude: raw.lon,
    weekly_hours: scheduleFromOsm(t.opening_hours),
    price_range: PRICE_MAP[(t.price_range ?? '').trim().toLowerCase()] ?? null,
    amenities: amenitiesFrom(t),
    image_url: photos[0] ?? null,
    photo_urls: photos.slice(1),
    phone: t.phone ?? t['contact:phone'] ?? null,
    website_url: safeHttpUrl(t.website ?? t['contact:website'] ?? t.facebook ?? t['contact:facebook']),
    directions_url: directionsUrl(raw.lat, raw.lon),
    ...verificationFrom(t, new Date(importedAt)),
    cuisine: (t.cuisine ?? '').split(';').filter(Boolean).map((c) => c.replace(/_/g, ' ')),
    notes: t.note?.trim() || null,
    source: 'openstreetmap',
    source_ref: raw.id,
    created_at: importedAt,
    updated_at: importedAt,
  };
}
