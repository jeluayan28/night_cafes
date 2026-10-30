import snapshot from '../data/cafes.json';
import type { Snapshot } from '../types';
import type { CafeRecord } from './model/cafe-record';
import { osmToRecord } from './model/osm-import';

export interface CafeData {
  cafes: CafeRecord[];
  /** When the underlying data was last refreshed (ISO). */
  dataDate: string;
}

/**
 * The single seam between the UI and wherever café data lives. Today it converts the
 * OpenStreetMap snapshot in src/data into database-shaped records. With Supabase, replace
 * the body with `select * from cafes` (see supabase/migrations) and return the same shape;
 * nothing else changes.
 */
export async function loadCafes(): Promise<CafeData> {
  const snap = snapshot as Snapshot;
  const importedAt = snap.generatedAt;
  return {
    cafes: snap.cafes.map((c) => osmToRecord(c, importedAt)),
    dataDate: snap.osmTimestamp ?? snap.generatedAt,
  };
}
