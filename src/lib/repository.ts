import snapshot from '../data/cafes.json';
import type { Snapshot } from '../types';

/**
 * Single seam between the UI and wherever café data lives. Today it reads the
 * OpenStreetMap snapshot in src/data. When Supabase is introduced, replace the
 * body with a query against the `cafes` table (see supabase/schema.sql) and
 * return the same Snapshot shape — nothing else needs to change.
 */
export async function loadSnapshot(): Promise<Snapshot> {
  return snapshot as Snapshot;
}
