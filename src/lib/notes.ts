import type { Cafe } from '@/types';

/**
 * Plain-language caveats, each triggered by something actually missing or doubtful
 * in the data for this café. Nothing here is generic filler. Verification status has
 * its own section in the detail view, so it is not repeated here.
 */
export function uncertaintyNotes(cafe: Cafe): string[] {
  const notes: string[] = [];
  const { schedule } = cafe;

  if (schedule.status === 'unknown') {
    if (schedule.unmodeled_rules.length === 0) {
      notes.push('Opening hours aren’t listed on OpenStreetMap, so we can’t say whether it’s open.');
    } else {
      notes.push(`The recorded hours (“${schedule.source_text ?? schedule.unmodeled_rules.join('; ')}”) use rules we can’t interpret reliably, so they aren’t shown as a schedule.`);
    }
  } else {
    if (schedule.unmodeled_rules.length > 0) {
      notes.push(`Some rules in the recorded hours (“${schedule.unmodeled_rules.join('”, “')}”) aren’t reflected here. Holiday opening times are not confirmed.`);
    }
    if (schedule.special.length > 0) notes.push('This café has special-hours exceptions; they override the weekly table on those dates.');
    if (WEEK_DAYS.some((d) => schedule.days[d].status === 'unknown')) notes.push('Some days of the week have no recorded hours.');
    if (cafe.category === 'always') notes.push('The 24/7 label comes from the recorded schedule alone. Check ahead before a late trip.');
  }

  if (!cafe.address) notes.push('No street address is recorded. Its location is known only from the map pin.');
  if (cafe.amenities.length === 0) notes.push('No amenities are confirmed. Absent from this list means unknown, not unavailable.');
  if (cafe.phone || cafe.website) notes.push('Contact details are as listed on OpenStreetMap. We haven’t verified them.');
  if (cafe.notes) notes.push(`Mapper’s note on OpenStreetMap: “${cafe.notes}”`);
  return notes;
}

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
