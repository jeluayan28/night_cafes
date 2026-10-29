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

export interface Cafe {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: Category;
  hoursText: string | null;
  /** When the hours were last confirmed on OSM (check_date), if anyone recorded it. */
  hoursChecked: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  /** Only set when OpenStreetMap has an `image` URL for the café; never generated. */
  image: string | null;
  cuisine: string[];
  amenities: Amenity[];
  /** price_range tag says budget/cheap. */
  budget: boolean;
  /** Derived: Wi-Fi and power outlets are both recorded. */
  study: boolean;
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
