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

export interface Cafe {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: Category;
  hoursText: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  /** Only set when OpenStreetMap has an `image` URL for the café; never generated. */
  image: string | null;
  cuisine: string[];
  amenities: Amenity[];
  osmUrl: string;
  osmEditUrl: string;
}

export type Amenity = 'wifi' | 'outdoor' | 'aircon' | 'takeaway';

export interface OpenStatus {
  isOpen: boolean;
  /** Wall-clock label for the next opening/closing change, e.g. "22:00". */
  changeAt: string | null;
}

export interface Filters {
  query: string;
  category: Category | 'all';
  openNow: boolean;
  amenities: Amenity[];
}
