import type { Amenity, Cafe, Category, Feature, Filters, Schedule } from '../types';
import type { CafeRecord, PriceRange } from './model/cafe-record';
import { categorize, manilaWallTime } from './model/schedule';
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

export const PRICE_LABEL: Record<PriceRange, string> = { budget: 'Budget', moderate: 'Moderate', upscale: 'Upscale' };

/** The last check as a partial ISO date at its recorded precision, in Manila time. */
function checkedOnOf(r: CafeRecord): string | null {
  if (!r.last_verified_at || !r.last_verified_precision) return null;
  const date = manilaWallTime(new Date(r.last_verified_at)).date;
  return r.last_verified_precision === 'year' ? date.slice(0, 4) : r.last_verified_precision === 'month' ? date.slice(0, 7) : date;
}

/** Database row -> what the interface works with. Opening status is NOT derived here; it's calculated live. */
export function recordToCafe(r: CafeRecord): Cafe {
  const [type, id] = r.source_ref.split('/');
  const fromOsm = r.source === 'openstreetmap' && !!type && !!id;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    address: r.address,
    barangay: r.barangay,
    lat: r.latitude,
    lon: r.longitude,
    category: categorize(r.weekly_hours),
    schedule: r.weekly_hours,
    verificationStatus: r.verification_status,
    checkedOn: checkedOnOf(r),
    priceRange: r.price_range,
    phone: r.phone,
    website: safeHttpUrl(r.website_url),
    photos: [r.image_url, ...r.photo_urls].filter((u): u is string => !!u && safeHttpUrl(u) !== null),
    directionsUrl: r.directions_url,
    cuisine: r.cuisine,
    amenities: r.amenities,
    budget: r.price_range === 'budget',
    study: r.amenities.includes('wifi') && r.amenities.includes('power'),
    notes: r.notes,
    searchText: fold([r.name, r.address, r.barangay].filter(Boolean).join(' ')),
    sourceUrl: fromOsm ? `https://www.openstreetmap.org/${type}/${id}` : null,
    sourceEditUrl: fromOsm ? `https://www.openstreetmap.org/edit?${type}=${id}` : null,
  };
}

export const buildCafes = (records: CafeRecord[]): Cafe[] => records.map(recordToCafe);

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
