export type Category = 'always' | 'late' | 'day' | 'unknown';

export interface RawCafe {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface Snapshot {
  source: string;
  osmTimestamp: string | null;
  generatedAt: string;
  cafes: RawCafe[];
}

/** Facts shown as icons; each is true only when an OSM tag says so. */
export type Amenity = 'wifi' | 'power' | 'aircon' | 'parking' | 'outdoor' | 'takeaway';

/**
 * Every optional field is null when OpenStreetMap doesn't record it. The UI shows
 * null as "Not confirmed" (or omits it) and never fills the gap with a guess.
 */
export interface Cafe {
  /** OSM element, e.g. "node/3665313816". Stable and unique. */
  id: string;
  name: string;
  /** Mapper-written description (OSM `description`); null when there is none. */
  description: string | null;
  /** Full address assembled from addr:* tags (or addr:full); null when none recorded. */
  address: string | null;
  /** Street / building / barangay only, for compact list cards. */
  shortAddress: string | null;
  /** addr:barangay, when recorded. */
  barangay: string | null;
  lat: number;
  lon: number;
  category: Category;
  /** Raw OSM opening_hours; the weekly table is derived from it in the browser. */
  hoursText: string | null;
  /** Latest check_date / opening_hours:check_date, as recorded (YYYY, YYYY-MM or YYYY-MM-DD). */
  checkedOn: string | null;
  /** price_range exactly as recorded; null when not confirmed. */
  priceRange: string | null;
  phone: string | null;
  /** http(s) URL only (validated), from website / contact:website / facebook. */
  website: string | null;
  /** Validated http(s) photo URLs from the OSM image tag; never generated. */
  photos: string[];
  cuisine: string[];
  /** Amenities an OSM tag affirmatively records. Absence means unknown, not unavailable. */
  amenities: Amenity[];
  /** price_range tag says budget/cheap. */
  budget: boolean;
  /** Derived: Wi-Fi and power outlets are both recorded. */
  study: boolean;
  /** A mapper's free-text OSM `note`, shown verbatim as theirs. */
  osmNote: string | null;
  /** Lower-cased, accent-free text the search box matches against. */
  searchText: string;
  osmUrl: string;
  osmEditUrl: string;
}

export interface OpenStatus {
  isOpen: boolean;
  /** The schedule is uncertain right now (e.g. "by appointment"), so we claim neither open nor closed. */
  unknown: boolean;
  /** Wall-clock label for the next opening/closing change, e.g. "22:00" or "Thu 02:00". */
  changeAt: string | null;
}

/** Mutually exclusive: everything, verified 24/7 only, or anything open late (includes 24/7). */
export type Schedule = 'all' | 'always' | 'late';
export type Feature = 'study' | 'wifi' | 'power' | 'aircon' | 'parking' | 'budget';

export interface Filters {
  query: string;
  schedule: Schedule;
  openNow: boolean;
  /** All selected features must match. */
  features: Feature[];
}
