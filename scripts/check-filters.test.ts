// Test-only fixtures. These fake cafés exist ONLY here to exercise the filter logic;
// they are never part of the shipped data.
import { applyFilters, buildCafes, chipCounts, isFiltered } from '../src/lib/cafes';
import { osmToRecord } from '../src/lib/model/osm-import';
import { openStatus } from '../src/lib/model/schedule';
import type { Filters, RawCafe } from '../src/types';

const raw = (id: number, name: string, tags: Record<string, string>): RawCafe => ({ id: `node/${id}`, name, lat: 8.94, lon: 125.53, tags });
const cafes = buildCafes([
  raw(1, 'Moonlight Brew', { opening_hours: '24/7', internet_access: 'wlan', power_supply: 'yes', 'addr:street': 'J. Rosales Avenue', 'addr:barangay': 'Libertad', parking: 'surface', price_range: 'budget' }),
  raw(2, 'Café Nocturne', { opening_hours: 'Mo-Su 18:00-02:00', internet_access: 'yes', air_conditioning: 'yes', 'addr:street': 'Montilla Boulevard', 'addr:barangay': 'Holy Redeemer' }),
  raw(3, 'Almost Always', { opening_hours: 'Mo-Su 00:00-23:59', internet_access: 'wlan', power_supply: 'yes' }),
  raw(4, 'Day Roast', { opening_hours: 'Mo-Fr 08:00-17:00', 'socket:type2': '4', 'addr:barangay': 'Libertad' }),
  raw(5, 'No Hours Cup', { internet_access: 'no' }),
].map((r) => osmToRecord(r, '2026-10-29T00:00:00Z')));
const by = (name: string) => cafes.find((c) => c.name === name)!;

// Instants given as Asia/Manila wall clock (UTC+8): Wed 28 Oct 2026 23:00, Thu 29th 03:00, ...
const wall = (day: number, h: number) => new Date(Date.UTC(2026, 9, day, h - 8, 0));
const openAt = (when: Date) => (c: (typeof cafes)[number]) => openStatus(c.schedule, when).isOpen;

const base: Filters = { query: '', schedule: 'all', openNow: false, features: [] };
const names = (f: Partial<Filters>, when = wall(28, 23)) =>
  applyFilters(cafes, { ...base, ...f }, openAt(when)).map((c) => c.name).sort();

let bad = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(56), ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

console.log('— classification');
check('24/7 verified only for the real 24/7', cafes.filter((c) => c.category === 'always').map((c) => c.name), ['Moonlight Brew']);
check('00:00-23:59 is NOT verified 24/7', by('Almost Always').category, 'late');

console.log('— search');
check('name, case-insensitive', names({ query: 'moonlight' }), ['Moonlight Brew']);
check('accent-insensitive (cafe -> Café)', names({ query: 'cafe nocturne' }), ['Café Nocturne']);
check('street', names({ query: 'rosales' }), ['Moonlight Brew']);
check('barangay', names({ query: 'libertad' }), ['Day Roast', 'Moonlight Brew']);
check('multi-word, all words must match', names({ query: 'libertad rosales' }), ['Moonlight Brew']);
check('no match', names({ query: 'zzz' }), []);

console.log('— schedule');
check('Verified 24/7 only', names({ schedule: 'always' }), ['Moonlight Brew']);
check('Open late includes 24/7 and after-midnight', names({ schedule: 'late' }), ['Almost Always', 'Café Nocturne', 'Moonlight Brew']);
check('All cafés', names({}).length, 5);

console.log('— open now (not the same as 24/7)');
check('Wed 23:00 open now', names({ openNow: true }), ['Almost Always', 'Café Nocturne', 'Moonlight Brew']);
check('Thu 03:00 open now (only 24/7 + after-midnight ended 02:00)', names({ openNow: true }, wall(29, 3)), ['Almost Always', 'Moonlight Brew']);
check('Thu 01:00 open now includes after-midnight café', names({ openNow: true }, wall(29, 1)), ['Almost Always', 'Café Nocturne', 'Moonlight Brew']);
check('Wed 12:00 open now includes daytime café', names({ openNow: true }, wall(28, 12)), ['Almost Always', 'Day Roast', 'Moonlight Brew']);
check('Open now + Verified 24/7 combine', names({ openNow: true, schedule: 'always' }), ['Moonlight Brew']);

console.log('— features (all selected must match)');
check('Wi-Fi', names({ features: ['wifi'] }), ['Almost Always', 'Café Nocturne', 'Moonlight Brew']);
check('Power outlets (power_supply or socket:*)', names({ features: ['power'] }), ['Almost Always', 'Day Roast', 'Moonlight Brew']);
check('Study-friendly = Wi-Fi + power', names({ features: ['study'] }), ['Almost Always', 'Moonlight Brew']);
check('Air-conditioning', names({ features: ['aircon'] }), ['Café Nocturne']);
check('Parking', names({ features: ['parking'] }), ['Moonlight Brew']);
check('Budget-friendly', names({ features: ['budget'] }), ['Moonlight Brew']);
check('internet_access=no is not Wi-Fi', by('No Hours Cup').amenities.includes('wifi'), false);
check('Wi-Fi + Air-conditioning combine', names({ features: ['wifi', 'aircon'] }), ['Café Nocturne']);
check('Everything combined narrows correctly', names({ query: 'rosales', schedule: 'always', openNow: true, features: ['wifi', 'power', 'parking', 'budget'] }), ['Moonlight Brew']);
check('Incompatible combination yields nothing', names({ schedule: 'always', features: ['aircon'] }), []);

console.log('— counts and clear');
const counts = chipCounts(cafes, openAt(wall(28, 23)));
check('chip counts', [counts.schedule.always, counts.schedule.late, counts.open, counts.features.study], [1, 3, 3, 2]);
check('isFiltered', [isFiltered(base), isFiltered({ ...base, query: ' ' }), isFiltered({ ...base, openNow: true })], [false, false, true]);

process.exit(bad ? 1 : 0);
