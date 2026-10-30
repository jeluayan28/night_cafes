// Runs the real migration + seed in an embedded Postgres (PGlite, with PostGIS) and checks
// constraints, indexes, generated columns, and that the SQL open-status function agrees
// with the TypeScript evaluator. Nothing here touches any real database.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { postgis } from '@electric-sql/pglite-postgis';
import { scheduleFromOsm } from '../src/lib/model/osm-import';
import { categorize, openState, validateSchedule } from '../src/lib/model/schedule';
import type { WeeklySchedule } from '../src/lib/model/schedule-types';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let bad = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(66), ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

const db = new PGlite({ extensions: { postgis, pg_trgm, unaccent } });
await db.exec(read('supabase/migrations/20261029000000_create_cafes.sql'));
await db.exec(read('supabase/seed.sql'));
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const rejects = async (sql: string, params: unknown[] = []) => {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
};

console.log('— migration and seed');
check('9 cafés seeded', (await q<{ n: number }>('select count(*)::int n from public.cafes'))[0].n, 9);
await db.exec(read('supabase/seed.sql')); // upsert again: must not duplicate
check('seed is re-runnable (still 9)', (await q<{ n: number }>('select count(*)::int n from public.cafes'))[0].n, 9);
check('geography + directions generated', (await q<{ ok: boolean; d: string }>("select geog is not null ok, directions_url d from public.cafes where source_ref = 'node/4703130695'"))[0], {
  ok: true, d: 'https://www.google.com/maps/dir/?api=1&destination=8.9426567,125.5203439',
});
check('directions_url matches what the app builds', (await q<{ d: string }>("select directions_url d from public.cafes where source_ref = 'node/3665313816'"))[0].d, 'https://www.google.com/maps/dir/?api=1&destination=8.9468719,125.5357568');
check('there is no open-now column', (await q('select 1 from information_schema.columns where table_name = $1 and column_name ~ $2', ['cafes', 'open_now|is_open'])).length, 0);

console.log('— constraints reject bad rows');
const base = `insert into public.cafes (name, slug, latitude, longitude, source_ref) values `;
check('valid minimal row accepted', await rejects(`${base}('Ok', 'ok-1', 8.9, 125.5, 'x/1')`), false);
check('latitude 91 rejected', await rejects(`${base}('A', 'a-1', 91, 125.5, 'x/2')`), true);
check('longitude 181 rejected', await rejects(`${base}('A', 'a-2', 8.9, 181, 'x/3')`), true);
check('blank name rejected', await rejects(`${base}('   ', 'a-3', 8.9, 125.5, 'x/4')`), true);
check('slug with spaces/caps rejected', await rejects(`${base}('A', 'Bad Slug', 8.9, 125.5, 'x/5')`), true);
check('duplicate slug rejected', await rejects(`${base}('A', 'ok-1', 8.9, 125.5, 'x/6')`), true);
check('duplicate (source, source_ref) rejected', await rejects(`${base}('A', 'a-9', 8.9, 125.5, 'x/1')`), true);
const withHours = (w: unknown, slug: string, ref: string) =>
  rejects(`insert into public.cafes (name, slug, latitude, longitude, source_ref, weekly_hours) values ('H', $1, 8.9, 125.5, $2, $3::jsonb)`, [slug, ref, JSON.stringify(w)]);
const good = scheduleFromOsm('Mo-Su 18:00-02:00');
check('valid overnight schedule accepted', await withHours(good, 'h-1', 'h/1'), false);
check('hours: missing weekday rejected', await withHours({ ...good, days: { ...good.days, sun: undefined } }, 'h-2', 'h/2'), true);
check('hours: 25:00 rejected', await withHours({ ...good, days: { ...good.days, mon: { status: 'open', ranges: [{ open: '10:00', close: '25:00' }] } } }, 'h-3', 'h/3'), true);
check('hours: 24:00 as open rejected', await withHours({ ...good, days: { ...good.days, mon: { status: 'open', ranges: [{ open: '24:00', close: '02:00' }] } } }, 'h-4', 'h/4'), true);
check('hours: open == close rejected', await withHours({ ...good, days: { ...good.days, mon: { status: 'open', ranges: [{ open: '10:00', close: '10:00' }] } } }, 'h-5', 'h/5'), true);
check('hours: wrong timezone rejected', await withHours({ ...good, timezone: 'UTC' }, 'h-6', 'h/6'), true);
check('hours: open day without ranges rejected', await withHours({ ...good, days: { ...good.days, mon: { status: 'open', ranges: [] } } }, 'h-7', 'h/7'), true);
check('hours: unknown schedule with a known day rejected', await withHours({ ...good, status: 'unknown' }, 'h-8', 'h/8'), true);
check('hours: special with an impossible date rejected', await withHours({ ...good, special: [{ date: '2026-02-30', day: { status: 'closed' } }] }, 'h-9', 'h/9'), true);
check('hours: special with both date and recurring rejected', await withHours({ ...good, special: [{ date: '2026-12-25', recurring: '12-25', day: { status: 'closed' } }] }, 'h-10', 'h/10'), true);
check('hours: valid special accepted', await withHours({ ...good, special: [{ recurring: '12-25', day: { status: 'closed' } }, { date: '2026-12-31', day: { status: 'open', ranges: [{ open: '10:00', close: '14:00' }] } }] }, 'h-11', 'h/11'), false);
check('hours: duplicate special rejected', await withHours({ ...good, special: [{ recurring: '12-25', day: { status: 'closed' } }, { recurring: '12-25', day: { status: 'closed' } }] }, 'h-12', 'h/12'), true);
const col = (set: string, slug: string, ref: string) => rejects(`insert into public.cafes (name, slug, latitude, longitude, source_ref, ${set.split('=')[0].trim()}) values ('C', '${slug}', 8.9, 125.5, '${ref}', ${set.split('=').slice(1).join('=')})`);
check('amenity outside the allowed list rejected', await col("amenities = array['wifi','jacuzzi']", 'c-1', 'c/1'), true);
check('allowed amenities accepted', await col("amenities = array['wifi','power']", 'c-2', 'c/2'), false);
check('javascript: website rejected', await col("website_url = 'javascript:alert(1)'", 'c-3', 'c/3'), true);
check('https website accepted', await col("website_url = 'https://example.com'", 'c-4', 'c/4'), false);
check('non-http photo rejected', await col("photo_urls = array['https://a.example/x.jpg','ftp://b/y.jpg']", 'c-5', 'c/5'), true);
check('letters in phone rejected', await col("phone = 'call me'", 'c-6', 'c/6'), true);
check('formatted phone accepted', await col("phone = '+63 (85) 342-1234'", 'c-7', 'c/7'), false);
check('verified without a date rejected', await col("verification_status = 'verified'", 'c-8', 'c/8'), true);
check('date without precision rejected', await col("last_verified_at = now()", 'c-9', 'c/9'), true);
check('invalid price_range rejected', await col("price_range = 'free'", 'c-10', 'c/10'), true);
check('unknown enum for verification rejected', await col("verification_status = 'maybe'", 'c-11', 'c/11'), true);

console.log('— generated columns, triggers, search, geography');
check('search_text folds accents and case', (await q<{ s: string }>("select search_text s from public.cafes where slug = 'ok-1'"))[0].s, 'ok  ');
await db.query(`update public.cafes set name = 'Café Ñandú', address = '12 Montilla Boulevard', barangay = 'Holy Redeemer' where slug = 'ok-1'`);
check('accent-insensitive search finds it', (await q<{ slug: string }>("select slug from public.search_cafes('CAFE nandu')")).map((r) => r.slug), ['ok-1']);
check('multi-word search needs every word', (await q<{ slug: string }>("select slug from public.search_cafes('montilla redeemer')")).map((r) => r.slug), ['ok-1']);
check('barangay search', (await q<{ slug: string }>("select slug from public.search_cafes('bayanihan')")).map((r) => r.slug), ['bo-s-coffee-3668045322']);
check('wildcard characters are literal', (await q('select 1 from public.search_cafes($1)', ['%'])).length, 0);
check('updated_at advances on update', (await q<{ ok: boolean }>("select updated_at > created_at ok from public.cafes where slug = 'ok-1'"))[0].ok, true);
const near = await q<{ slug: string; distance_m: number }>('select slug, distance_m from public.cafes_near(8.9475, 125.5406, 1500)');
check('cafes_near returns nearest first within the radius', near.length > 0 && near.every((r, i) => i === 0 || near[i - 1].distance_m <= r.distance_m) && near.every((r) => r.distance_m <= 1500), true);
check('cafes_near excludes far cafés', (await q('select 1 from public.cafes_near(8.9475, 125.5406, 10)')).length, 0);
const idx = (await q<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'cafes'")).map((r) => r.indexdef);
check('GiST index on geography', idx.some((d) => /USING gist \(geog\)/.test(d)), true);
check('trigram GIN index on search_text', idx.some((d) => /USING gin \(search_text .*gin_trgm_ops\)/.test(d)), true);
check('GIN index on amenities', idx.some((d) => /USING gin \(amenities\)/.test(d)), true);
check('expression index for verified 24/7', idx.some((d) => /cafe_is_always_open/.test(d)), true);
check('RLS enabled, public read policy present', (await q<{ r: boolean; p: number }>("select relrowsecurity r, (select count(*)::int from pg_policies where tablename = 'cafes') p from pg_class where relname = 'cafes'"))[0], { r: true, p: 1 });

console.log('— SQL open-status == TypeScript evaluator');
const special: WeeklySchedule = {
  ...scheduleFromOsm('Mo-Su 10:00-22:00'),
  special: [
    { recurring: '12-25', label: 'Christmas', day: { status: 'closed' } },
    { date: '2026-10-30', day: { status: 'open', ranges: [{ open: '10:00', close: '14:00' }] } },
    { recurring: '10-31', day: { status: 'open', ranges: [{ open: '18:00', close: '03:00' }] } },
  ],
};
const mixedUnknown: WeeklySchedule = { ...scheduleFromOsm('Mo-We 08:00-17:00'), days: { ...scheduleFromOsm('Mo-We 08:00-17:00').days, tue: { status: 'unknown' }, sat: { status: 'unknown' } } };
const overnightThenClosedSpecial: WeeklySchedule = { ...scheduleFromOsm('Th 18:00-02:00'), special: [{ date: '2026-10-30', day: { status: 'closed' } }] };
const fixtures: Array<[string, WeeklySchedule]> = [
  ['24/7', scheduleFromOsm('24/7')],
  ['overnight daily', scheduleFromOsm('Mo-Su 18:00-02:00')],
  ['weekday office', scheduleFromOsm('Mo-Fr 08:00-17:00')],
  ['split shift', scheduleFromOsm('Mo-Sa 08:00-12:00,14:00-23:00')],
  ['Sunday night wraps into Monday', scheduleFromOsm('Su 20:00-03:00')],
  ['24/7 except Sunday', scheduleFromOsm('24/7; Su off')],
  ['00:00-23:59 gap', scheduleFromOsm('Mo-Su 00:00-23:59')],
  ['holiday clause (unmodeled)', scheduleFromOsm('Mo-Su 00:00-24:00; PH off')],
  ['Dec 25 off', scheduleFromOsm('Mo-Su 00:00-24:00; Dec 25 off')],
  ['seasonal (unknown)', scheduleFromOsm('Jan-Mar 24/7')],
  ['no hours', scheduleFromOsm(null)],
  ['special days', special],
  ['unknown days mixed in', mixedUnknown],
  ['overnight into a closed special day', overnightThenClosedSpecial],
];
for (const [name, s] of fixtures) check(`fixture is valid: ${name}`, validateSchedule(s), []);

// Every 30 minutes from 23 Oct to 3 Nov and around Christmas, in UTC instants.
const instants: Date[] = [];
for (let t = Date.UTC(2026, 9, 22, 12); t < Date.UTC(2026, 10, 3); t += 30 * 60_000) instants.push(new Date(t));
for (let t = Date.UTC(2026, 11, 23, 12); t < Date.UTC(2026, 11, 27); t += 30 * 60_000) instants.push(new Date(t));
// ...plus the exact minute boundaries around midnight and closing times.
for (const h of [-1, 0, 1]) for (const m of [-1, 0, 1]) instants.push(new Date(Date.UTC(2026, 9, 29, 16 + h, m + 60) ));

let compared = 0;
const seenStates = new Set<string>();
let mismatches: string[] = [];
for (const [name, s] of fixtures) {
  const rows = await q<{ ts: string; st: string }>(
    `select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ts, public.cafe_open_state($1::jsonb, ts) st from unnest($2::timestamptz[]) ts`,
    [JSON.stringify(s), instants.map((d) => d.toISOString())],
  );
  const byTs = new Map(rows.map((r) => [r.ts, r.st]));
  for (const d of instants) {
    const key = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const sql = byTs.get(key);
    const ts = openState(s, d);
    compared++;
    seenStates.add(ts);
    if (sql !== ts && mismatches.length < 5) mismatches.push(`${name} @ ${key}: sql=${sql} ts=${ts}`);
  }
}
check('comparison exercises open, closed and unknown', [...seenStates].sort(), ['closed', 'open', 'unknown']);
check(`${compared} instants agree across ${fixtures.length} schedules`, mismatches, []);

console.log('— SQL 24/7 flag == TypeScript categorize');
const flags = await q<{ i: number; f: boolean }>('select i, public.cafe_is_always_open(w::jsonb) f from unnest($1::text[]) with ordinality as t(w, i)', [fixtures.map(([, s]) => JSON.stringify(s))]);
check('verified-24/7 agrees for every fixture', flags.map((r) => r.f), fixtures.map(([, s]) => categorize(s) === 'always'));

console.log('— the status view is calculated live');
const live = await q<{ open_state: string }>("select open_state from public.cafes_with_status where source_ref = 'node/4703130695'");
check('view exposes open_state computed now', ['open', 'closed'].includes(live[0].open_state), true);

await db.close();
process.exit(bad ? 1 : 0);
