import type { Amenity, Cafe, Category, Feature, Filters, RawCafe, Schedule } from '../types';
import { classify, parseHours } from './hours';
import { safeHttpUrl } from './safe';

export const CATEGORY_LABEL: Record<Category, string> = {
  always: 'Verified 24/7',
  late: 'Late-night',
  day: 'Daytime café',
  unknown: 'Hours not listed',
};

export const AMENITY_LABEL: Record<Amenity, string> = {
  wifi: 'Wi-Fi',
  power: 'Power outlets',
  aircon: 'Air-conditioned',
  parking: 'Parking',
  outdoor: 'Outdoor seating',
  takeaway: 'Takeaway',
};

export const SCHEDULE_LABEL: Record<Schedule, string> = {
  all: 'All cafés',
  always: 'Verified 24/7',
  late: 'Open late',
};

export const SCHEDULE_HELP: Record<Schedule, string> = {
  all: 'Every café on the map',
  always: 'Schedule recorded as open every hour of all seven days, with no exceptions',
  late: 'Trades at some point between 11 PM and 4 AM (includes 24/7 cafés)',
};

export const FEATURE_LABEL: Record<Feature, string> = {
  study: 'Study-friendly',
  wifi: 'Wi-Fi',
  power: 'Power outlets',
  aircon: 'Air-conditioning',
  parking: 'Parking',
  budget: 'Budget-friendly',
};

/** What each filter requires, so the UI never implies more than the data says. */
export const FEATURE_HELP: Record<Feature, string> = {
  study: 'Both Wi-Fi and power outlets are recorded',
  wifi: 'internet_access is "wlan" or "yes"',
  power: 'power_supply=yes or a socket:* tag is recorded',
  aircon: 'air_conditioning=yes is recorded',
  parking: 'A parking tag is recorded',
  budget: 'price_range is recorded as budget or cheap',
};

const CATEGORY_RANK: Record<Category, number> = { always: 0, late: 1, day: 2, unknown: 3 };

/** Lower-case and strip accents so "cafe" finds "Café". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const isRecorded = (v: string | undefined) => !!v && !['no', '0', 'none'].includes(v.toLowerCase());
const BUDGET_VALUES = ['budget', 'cheap', 'low', 'inexpensive', '$', '1'];

function toCafe(raw: RawCafe): Cafe {
  const t = raw.tags;
  const hoursText = t.opening_hours ?? null;
  const [type, id] = raw.id.split('/');
  const keys = Object.keys(t);

  const wifi = t.internet_access === 'wlan' || t.internet_access === 'yes';
  const power = t.power_supply === 'yes' || keys.some((k) => k.startsWith('socket:') && isRecorded(t[k]));
  const parking = isRecorded(t.parking) || keys.some((k) => k.startsWith('parking:') && isRecorded(t[k]));
  const amenities: Amenity[] = [];
  if (wifi) amenities.push('wifi');
  if (power) amenities.push('power');
  if (t.air_conditioning === 'yes') amenities.push('aircon');
  if (parking) amenities.push('parking');
  if (t.outdoor_seating === 'yes') amenities.push('outdoor');
  if (t.takeaway === 'yes' || t.takeaway === 'only') amenities.push('takeaway');

  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const shortAddress = [t['addr:housename'], street, t['addr:barangay']].filter(Boolean).join(', ') || null;
  const address =
    t['addr:full'] ||
    [t['addr:housename'], street, t['addr:barangay'], t['addr:city'], t['addr:province'], t['addr:postcode']]
      .filter(Boolean)
      .join(', ') ||
    null;
  // Latest recorded check date (partial ISO dates sort correctly as strings).
  const checkedOn = [t['opening_hours:check_date'], t.check_date].filter(Boolean).sort().pop() ?? null;

  return {
    id: raw.id,
    name: raw.name,
    description: (t.description || t['description:en'] || '').trim() || null,
    address,
    shortAddress,
    barangay: t['addr:barangay'] ?? null,
    lat: raw.lat,
    lon: raw.lon,
    category: classify(parseHours(hoursText), undefined, hoursText),
    hoursText,
    checkedOn,
    priceRange: t.price_range ?? null,
    phone: t.phone ?? t['contact:phone'] ?? null,
    website: safeHttpUrl(t.website ?? t['contact:website'] ?? t.facebook ?? t['contact:facebook']),
    photos: (t.image ?? '').split(';').map(safeHttpUrl).filter((u): u is string => u !== null),
    cuisine: (t.cuisine ?? '').split(';').filter(Boolean).map((c) => c.replace(/_/g, ' ')),
    amenities,
    budget: BUDGET_VALUES.includes((t.price_range ?? '').toLowerCase()),
    study: wifi && power,
    osmNote: t.note?.trim() || null,
    searchText: fold(
      [raw.name, t.brand, address, t['addr:housename'], street, t['addr:barangay'], t['addr:city'], t['addr:postcode']]
        .filter(Boolean)
        .join(' '),
    ),
    osmUrl: `https://www.openstreetmap.org/${type}/${id}`,
    osmEditUrl: `https://www.openstreetmap.org/edit?${type}=${id}`,
  };
}

export const buildCafes = (raw: RawCafe[]): Cafe[] => raw.map(toCafe);

export function countByCategory(cafes: Cafe[]): Record<Category, number> {
  const counts: Record<Category, number> = { always: 0, late: 0, day: 0, unknown: 0 };
  for (const c of cafes) counts[c.category]++;
  return counts;
}

export function hasFeature(c: Cafe, f: Feature): boolean {
  if (f === 'study') return c.study;
  if (f === 'budget') return c.budget;
  return c.amenities.includes(f);
}

export const matchesSchedule = (c: Cafe, s: Schedule) =>
  s === 'all' || (s === 'always' ? c.category === 'always' : c.category === 'always' || c.category === 'late');

/** Every whitespace-separated word must appear somewhere in the name or address. */
export const matchesQuery = (c: Cafe, query: string) =>
  fold(query).split(/\s+/).filter(Boolean).every((w) => c.searchText.includes(w));

export const isFiltered = (f: Filters) =>
  f.query.trim() !== '' || f.schedule !== 'all' || f.openNow || f.features.length > 0;

/** How many cafés each chip would match on its own (ignores the other filters). */
export function chipCounts(cafes: Cafe[], isOpen: (c: Cafe) => boolean) {
  return {
    schedule: {
      all: cafes.length,
      always: cafes.filter((c) => matchesSchedule(c, 'always')).length,
      late: cafes.filter((c) => matchesSchedule(c, 'late')).length,
    } satisfies Record<Schedule, number>,
    open: cafes.filter(isOpen).length,
    features: Object.fromEntries(
      (Object.keys(FEATURE_LABEL) as Feature[]).map((f) => [f, cafes.filter((c) => hasFeature(c, f)).length]),
    ) as Record<Feature, number>,
  };
}

export function applyFilters(cafes: Cafe[], f: Filters, isOpen: (c: Cafe) => boolean): Cafe[] {
  return cafes.filter(
    (c) =>
      matchesSchedule(c, f.schedule) &&
      matchesQuery(c, f.query) &&
      f.features.every((x) => hasFeature(c, x)) &&
      (!f.openNow || isOpen(c)),
  );
}

export function sortCafes(cafes: Cafe[], distanceTo: ((c: Cafe) => number) | null): Cafe[] {
  return [...cafes].sort((a, b) =>
    distanceTo
      ? distanceTo(a) - distanceTo(b)
      : CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.name.localeCompare(b.name),
  );
}
