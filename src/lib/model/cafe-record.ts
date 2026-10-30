import type { Amenity } from '@/types';
import type { WeeklySchedule } from './schedule-types';

export const AMENITIES: readonly Amenity[] = ['wifi', 'power', 'aircon', 'parking', 'outdoor', 'takeaway'];

/** "unverified" until someone records a check; "needs_review" is set by editors when details look doubtful. */
export type VerificationStatus = 'unverified' | 'verified' | 'needs_review';
export type VerificationPrecision = 'day' | 'month' | 'year';
/** Only a confirmed level is stored; null means "Not confirmed". */
export type PriceRange = 'budget' | 'moderate' | 'upscale';

/**
 * One café, shaped exactly like a row of the `public.cafes` table
 * (see supabase/migrations). snake_case on purpose: rows from Supabase map 1:1.
 *
 * Deliberately absent: any "open now" flag. Current status is calculated from
 * `weekly_hours` and Asia/Manila time (see schedule.ts / cafe_open_state()).
 */
export interface CafeRecord {
  id: string;
  name: string;
  /** URL-safe and unique, e.g. "bos-coffee-4703130695". */
  slug: string;
  /** Written by a person (e.g. the OSM description tag). Never generated. */
  description: string | null;
  address: string | null;
  barangay: string | null;
  latitude: number;
  longitude: number;
  weekly_hours: WeeklySchedule;
  price_range: PriceRange | null;
  /** Amenities a source affirmatively records. Absent means unknown, not unavailable. */
  amenities: Amenity[];
  /** Primary photo. */
  image_url: string | null;
  /** Further photos. */
  photo_urls: string[];
  phone: string | null;
  website_url: string | null;
  /** Google Maps directions; generated from the coordinates in the database. */
  directions_url: string;
  verification_status: VerificationStatus;
  /** ISO timestamp; its precision is in `last_verified_precision` (a mapper may only know the month). */
  last_verified_at: string | null;
  last_verified_precision: VerificationPrecision | null;
  cuisine: string[];
  /** A person's note about doubtful details, shown verbatim as theirs. */
  notes: string | null;
  /** Where the record came from, with the id there. Unique together. */
  source: string;
  source_ref: string;
  created_at: string;
  updated_at: string;
}

export const directionsUrl = (lat: number, lon: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

/** Lower-case ASCII slug: "Café del Mar!" -> "cafe-del-mar". */
export const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
