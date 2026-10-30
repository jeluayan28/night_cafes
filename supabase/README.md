# Café database

Target Supabase project: **night_cafe**.

Not connected yet: the app currently reads `src/data/cafes.json` through `src/lib/repository.ts`.
When Supabase is introduced, only `loadCafes()` there needs to change (select from `public.cafes`).

## Apply

1. Run `migrations/20261029000000_create_cafes.sql` (Supabase SQL editor, or `supabase db push`).
2. Optionally load the current OpenStreetMap snapshot: `npm run db:seed` regenerates `seed.sql`; run it after the migration. It upserts on `(source, source_ref)`, so it is safe to re-run.

## Opening hours

`weekly_hours` is JSON, validated by a CHECK constraint. Its contract (and TypeScript types) live in `src/lib/model/schedule-types.ts`.

- Times are `HH:MM` in Asia/Manila. A range belongs to the day it **starts** on.
- `close` earlier than `open` means **overnight** (`18:00`–`02:00` closes next morning).
- `24:00` is allowed only as a close time; a whole day is `00:00`–`24:00`.
- A day is `open` (with ranges), `closed` (confirmed), or `unknown` (never treated as closed).
- `special` holds date-specific (`date`) or yearly (`recurring`) overrides.
- `unmodeled_rules` records source rules we couldn't represent (e.g. holiday clauses); any entry bars the verified-24/7 label.

**There is no "open now" column.** Use `cafe_open_state(weekly_hours)` (`'open' | 'closed' | 'unknown'`),
`cafe_is_open(...)` (boolean, null when unknown), or the `cafes_with_status` view. They use Asia/Manila time
and mirror `src/lib/model/schedule.ts` exactly; `npm run check:sql` cross-checks the two over thousands of instants.

## Searches

| Need | Use |
|---|---|
| Name / street / barangay text | `search_cafes('libertad cafe')` (trigram index on the generated `search_text`) |
| Near a point | `cafes_near(lat, lon, radius_m)` (GiST index on the generated `geog`) |
| Wi-Fi, outlets, parking… | `amenities @> array['wifi']` (GIN index) |
| Verified 24/7 | `cafe_is_always_open(weekly_hours)` (expression index) |

## Security and public access

The public site is read-only, has no user authentication, and needs no user-account tables.

- **Two layers deny writes to visitors.** The migration revokes all table privileges from `anon`/`authenticated` and grants `select` only; RLS is on with a single `select` policy and no insert/update/delete policy. `npm run check:sql` proves each layer blocks writes on its own.
- **Keys.** The browser may only ever get `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is server-only: never `NEXT_PUBLIC_`-prefixed, never imported by a client component, never committed (`.env*` is git-ignored; `.env.example` is the template). `npm run check:security` fails if a service-role reference or secret-looking value lands in `src/`.
- **Public data.** The `select` policy exposes every column of `cafes` (including `source`/`source_ref`). Put anything private in a separate table, not here.
- **Maintenance.** If a private maintenance interface is ever needed, build it as a separate app/deployment with its own auth. Do not add it to this site's routes or navigation.

## Writes

Row-level security allows public **reads** only. Write with the service role (never from the browser).
Keep a day's ranges merged (no touching or overlapping ranges); the app's `validateSchedule()` checks this before saving.

## Tests

`npm run check:sql` applies the migration and seed to an embedded Postgres with PostGIS (PGlite). It touches no real database.
