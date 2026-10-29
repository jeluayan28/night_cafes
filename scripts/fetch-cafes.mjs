// Fetches cafés in Butuan City from OpenStreetMap (Overpass API) and writes a
// normalized snapshot to src/data/cafes.json. Nothing is added by hand.
//
//   npm run data                         # fetch live data
//   npm run data -- --input raw.json     # re-normalize a saved Overpass response
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/data/cafes.json', import.meta.url));
const QUERY = await readFile(fileURLToPath(new URL('./query.txt', import.meta.url)), 'utf8');
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'NightCafeButuan/1.0 (data snapshot script)';

async function fetchOverpass() {
  for (let round = 0; round < 4; round++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: QUERY }),
          signal: AbortSignal.timeout(90_000),
        });
        const text = await res.text();
        if (res.ok && text.trimStart().startsWith('{')) return JSON.parse(text);
        console.warn(`${url} -> ${res.status}, trying next`);
      } catch (err) {
        console.warn(`${url} -> ${err.message}, trying next`);
      }
    }
    await new Promise((r) => setTimeout(r, 5000 * (round + 1)));
  }
  throw new Error('All Overpass mirrors failed');
}

const KEEP = [
  'brand', 'cuisine', 'image', 'opening_hours', 'check_date', 'opening_hours:check_date',
  'phone', 'contact:phone', 'website', 'contact:website', 'facebook', 'contact:facebook',
  'internet_access', 'outdoor_seating', 'air_conditioning', 'takeaway', 'delivery',
  'power_supply', 'parking', 'price_range',
  'description', 'description:en', 'note', 'addr:full', 'addr:province',
  'addr:housename', 'addr:housenumber', 'addr:street', 'addr:barangay', 'addr:city', 'addr:postcode',
];

function normalize(el) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = el.tags?.name?.trim();
  if (lat == null || lon == null || !name) return null; // skip unnamed / unlocatable
  const wanted = (k) => KEEP.includes(k) || k.startsWith('socket:') || k.startsWith('parking:');
  const tags = Object.fromEntries(Object.entries(el.tags).filter(([k, v]) => v && wanted(k)));
  return { id: `${el.type}/${el.id}`, name, lat, lon, tags };
}

const argIdx = process.argv.indexOf('--input');
const raw = argIdx > -1
  ? JSON.parse(await readFile(process.argv[argIdx + 1], 'utf8'))
  : await fetchOverpass();

const cafes = raw.elements.map(normalize).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
const snapshot = {
  source: 'OpenStreetMap contributors (ODbL) via Overpass API',
  osmTimestamp: raw.osm3s?.timestamp_osm_base ?? null,
  generatedAt: new Date().toISOString(),
  cafes,
};
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Wrote ${cafes.length} cafés to ${OUT}`);
