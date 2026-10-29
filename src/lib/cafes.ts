import type { Amenity, Cafe, Category, Filters, RawCafe } from '../types';
import { classify, parseHours } from './hours';

export const CATEGORY_LABEL: Record<Category, string> = {
  always: 'Open 24/7',
  late: 'Late-night',
  day: 'Daytime café',
  unknown: 'Hours not listed',
};

export const AMENITY_LABEL: Record<Amenity, string> = {
  wifi: 'Wi-Fi',
  outdoor: 'Outdoor seating',
  aircon: 'Air-conditioned',
  takeaway: 'Takeaway',
};

const CATEGORY_RANK: Record<Category, number> = { always: 0, late: 1, day: 2, unknown: 3 };

function toCafe(raw: RawCafe): Cafe {
  const t = raw.tags;
  const hoursText = t.opening_hours ?? null;
  const [type, id] = raw.id.split('/');
  const amenities: Amenity[] = [];
  if (t.internet_access === 'wlan' || t.internet_access === 'yes') amenities.push('wifi');
  if (t.outdoor_seating === 'yes') amenities.push('outdoor');
  if (t.air_conditioning === 'yes') amenities.push('aircon');
  if (t.takeaway === 'yes' || t.takeaway === 'only') amenities.push('takeaway');

  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const address = [t['addr:housename'], street, t['addr:barangay'], t['addr:city']]
    .filter(Boolean).join(', ') || null;

  return {
    id: raw.id,
    name: raw.name,
    lat: raw.lat,
    lon: raw.lon,
    category: classify(parseHours(hoursText)),
    hoursText,
    address,
    phone: t.phone ?? t['contact:phone'] ?? null,
    website: t.website ?? t['contact:website'] ?? t.facebook ?? t['contact:facebook'] ?? null,
    image: t.image && /^https?:\/\//.test(t.image) ? t.image : null,
    cuisine: (t.cuisine ?? '').split(';').filter(Boolean).map((c) => c.replace(/_/g, ' ')),
    amenities,
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

export function applyFilters(
  cafes: Cafe[],
  f: Filters,
  isOpen: (c: Cafe) => boolean | null,
): Cafe[] {
  const q = f.query.trim().toLowerCase();
  return cafes.filter((c) => {
    if (f.category !== 'all' && c.category !== f.category) return false;
    if (q && !`${c.name} ${c.address ?? ''} ${c.cuisine.join(' ')}`.toLowerCase().includes(q)) return false;
    if (f.amenities.some((a) => !c.amenities.includes(a))) return false;
    if (f.openNow && isOpen(c) !== true) return false;
    return true;
  });
}

export function sortCafes(
  cafes: Cafe[],
  distanceTo: ((c: Cafe) => number) | null,
): Cafe[] {
  return [...cafes].sort((a, b) =>
    distanceTo
      ? distanceTo(a) - distanceTo(b)
      : CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.name.localeCompare(b.name),
  );
}
