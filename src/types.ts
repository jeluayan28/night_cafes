import type { PriceRange, VerificationStatus } from '@/lib/model/cafe-record';
import type { WeeklySchedule } from '@/lib/model/schedule-types';

export type Category = 'always' | 'late' | 'day' | 'unknown';

/** An element as fetched from OpenStreetMap; input to the importer only. */
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

/** Facts shown as icons; each is true only when a source affirmatively records it. */
export type Amenity = 'wifi' | 'power' | 'aircon' | 'parking' | 'outdoor' | 'takeaway';

/**
 * What the interface works with: a CafeRecord (database row) plus values derived
 * from it. Every optional field is null when unrecorded; the UI shows null as
 * "Not confirmed" (or omits it) and never fills the gap with a guess.
 */
export interface Cafe {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  barangay: string | null;
  lat: number;
  lon: number;
  /** Derived from the schedule: verified 24/7, late-night, daytime or unknown. */
  category: Category;
  /** Source of truth for hours. "Open now" is calculated from it, never stored. */
  schedule: WeeklySchedule;
  verificationStatus: VerificationStatus;
  /** Last check as a partial ISO date matching its recorded precision (YYYY, YYYY-MM or YYYY-MM-DD), Manila time. */
  checkedOn: string | null;
  priceRange: PriceRange | null;
  phone: string | null;
  /** Validated http(s) URL only. */
  website: string | null;
  /** Validated http(s) photo URLs; never generated. */
  photos: string[];
  directionsUrl: string;
  cuisine: string[];
  amenities: Amenity[];
  /** price_range is "budget". */
  budget: boolean;
  /** Derived: Wi-Fi and power outlets are both recorded. */
  study: boolean;
  /** A person's note about doubtful details, shown verbatim as theirs. */
  notes: string | null;
  /** Lower-cased, accent-free text the search box matches against. */
  searchText: string;
  /** Link to the source record (OpenStreetMap), when the source is OSM. */
  sourceUrl: string | null;
  sourceEditUrl: string | null;
}

export interface OpenStatus {
  isOpen: boolean;
  /** The schedule is uncertain right now (unknown day), so we claim neither open nor closed. */
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
