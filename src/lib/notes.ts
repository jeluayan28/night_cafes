import type { Cafe } from '@/types';
import { parseHours, usesHolidays } from './hours';

const SEASONAL = /(?:^|[^A-Za-z])(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week)(?:[^A-Za-z]|$)/i;

/**
 * Plain-language caveats, each triggered by something actually missing or doubtful
 * in the data for this café. Nothing here is generic filler.
 */
// Verification status has its own section in the detail view, so it is not repeated here.
export function uncertaintyNotes(cafe: Cafe, _now: Date): string[] {
  const notes: string[] = [];
  const { hoursText } = cafe;

  if (!hoursText) {
    notes.push('Opening hours aren’t listed on OpenStreetMap, so we can’t say whether it’s open.');
  } else {
    if (!parseHours(hoursText)) notes.push(`The recorded hours (“${hoursText}”) couldn’t be interpreted, so they aren’t used.`);
    if (usesHolidays(hoursText)) notes.push('These hours include public-holiday rules we can’t evaluate. Holiday opening times are not confirmed.');
    if (SEASONAL.test(hoursText)) notes.push('These hours include seasonal or date-specific rules. The table shows this week only.');
    if (cafe.category === 'always') notes.push('The 24/7 label comes from the recorded schedule alone. Check ahead before a late trip.');
  }

  if (!cafe.address) notes.push('No street address is recorded. Its location is known only from the map pin.');
  if (cafe.amenities.length === 0) notes.push('No amenities are confirmed. Absent from this list means unknown, not unavailable.');
  if (cafe.phone || cafe.website) notes.push('Contact details are as listed on OpenStreetMap. We haven’t verified them.');
  if (cafe.osmNote) notes.push(`Mapper’s note on OpenStreetMap: “${cafe.osmNote}”`);
  return notes;
}
