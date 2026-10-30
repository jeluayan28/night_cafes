-- Night Café Butuan: cafés.
--
-- Design notes
--  * weekly_hours (jsonb) is the single source of truth for opening hours. It supports
--    per-day ranges, overnight ranges, confirmed-closed days, unknown days and special
--    (date-specific or yearly) hours. See src/lib/model/schedule-types.ts for the contract.
--  * There is deliberately NO "open now" column. Current status is calculated from
--    weekly_hours and Asia/Manila time by cafe_open_state() (mirrors schedule.ts).
--  * Coordinates are plain double precision columns (easy to edit and export) plus a
--    generated PostGIS geography column that carries the spatial index.
--  * Writes go through the service role only; the public may read.

create schema if not exists extensions;
create extension if not exists postgis  with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.verification_status    as enum ('unverified', 'verified', 'needs_review');
create type public.verification_precision as enum ('day', 'month', 'year');
create type public.price_range            as enum ('budget', 'moderate', 'upscale');

-- ---------------------------------------------------------------------------
-- Helpers used by constraints and generated columns (must be immutable)
-- ---------------------------------------------------------------------------
create or replace function public.immutable_unaccent(text)
returns text language sql immutable parallel safe strict
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create or replace function public.all_http_urls(urls text[])
returns boolean language sql immutable parallel safe
as $$ select coalesce(bool_and(u ~* '^https?://\S+$'), true) from unnest(urls) as u $$;

-- "HH:MM" 00:00-23:59; "24:00" only when allowed (close times).
create or replace function public.is_valid_clock(t text, allow_24 boolean default false)
returns boolean language sql immutable parallel safe
as $$ select coalesce(t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (allow_24 and t = '24:00'), false) $$;

create or replace function public.clock_minutes(t text)
returns integer language sql immutable parallel safe strict
as $$ select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int $$;

create or replace function public.is_valid_day_schedule(d jsonb)
returns boolean language plpgsql immutable parallel safe
as $$
declare
  r jsonb;
begin
  if d is null or jsonb_typeof(d) <> 'object' then return false; end if;
  case d->>'status'
    when 'closed', 'unknown' then
      return not (d ? 'ranges');
    when 'open' then
      if jsonb_typeof(d->'ranges') <> 'array' or jsonb_array_length(d->'ranges') = 0 then return false; end if;
      for r in select value from jsonb_array_elements(d->'ranges') loop
        if jsonb_typeof(r) <> 'object'
           or not public.is_valid_clock(r->>'open')
           or not public.is_valid_clock(r->>'close', true)
           or r->>'open' = r->>'close' then
          return false;
        end if;
      end loop;
      return true;
    else
      return false;
  end case;
end
$$;

-- Structural validation of the weekly_hours document. (Overlap/touching checks between
-- ranges are enforced by the application's validateSchedule(); see schedule.ts.)
create or replace function public.is_valid_weekly_hours(w jsonb)
returns boolean language plpgsql immutable parallel safe
as $$
declare
  k text;
  e jsonb;
  seen text[] := '{}';
  key text;
begin
  if w is null or jsonb_typeof(w) <> 'object' then return false; end if;
  if w->>'version' is distinct from '1' or w->>'timezone' is distinct from 'Asia/Manila' then return false; end if;
  if w->>'status' is null or w->>'status' not in ('known', 'unknown') then return false; end if;

  if jsonb_typeof(w->'days') <> 'object' or (select count(*) from jsonb_object_keys(w->'days')) <> 7 then return false; end if;
  foreach k in array array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] loop
    if not public.is_valid_day_schedule(w->'days'->k) then return false; end if;
    if w->>'status' = 'unknown' and w->'days'->k->>'status' <> 'unknown' then return false; end if;
  end loop;

  if jsonb_typeof(w->'unmodeled_rules') <> 'array' then return false; end if;
  if exists (select 1 from jsonb_array_elements(w->'unmodeled_rules') u where jsonb_typeof(u) <> 'string') then return false; end if;
  if w ? 'source_text' and jsonb_typeof(w->'source_text') not in ('string', 'null') then return false; end if;

  if jsonb_typeof(w->'special') <> 'array' then return false; end if;
  for e in select value from jsonb_array_elements(w->'special') loop
    if jsonb_typeof(e) <> 'object' or not public.is_valid_day_schedule(e->'day') then return false; end if;
    if (e ? 'date') = (e ? 'recurring') then return false; end if;  -- exactly one of the two
    begin
      if e ? 'date' then
        if e->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
        perform make_date(substr(e->>'date', 1, 4)::int, substr(e->>'date', 6, 2)::int, substr(e->>'date', 9, 2)::int);
        key := 'd:' || (e->>'date');
      else
        if e->>'recurring' !~ '^\d{2}-\d{2}$' then return false; end if;
        perform make_date(2000, substr(e->>'recurring', 1, 2)::int, substr(e->>'recurring', 4, 2)::int);
        key := 'r:' || (e->>'recurring');
      end if;
    exception when others then
      return false;  -- e.g. 2026-02-30
    end;
    if key = any(seen) then return false; end if;
    seen := seen || key;
  end loop;
  return true;
end
$$;

-- ---------------------------------------------------------------------------
-- Calculating "open now" (never stored)
-- ---------------------------------------------------------------------------

-- The schedule that applies to the periods STARTING on calendar date d:
-- a one-off special date beats a yearly one, which beats the regular weekday.
create or replace function public.cafe_day_schedule(w jsonb, d date)
returns jsonb language plpgsql immutable parallel safe
as $$
declare
  s jsonb;
begin
  if w->>'status' = 'unknown' then return '{"status":"unknown"}'::jsonb; end if;
  select e->'day' into s from jsonb_array_elements(w->'special') e where e->>'date' = to_char(d, 'YYYY-MM-DD') limit 1;
  if s is null then
    select e->'day' into s from jsonb_array_elements(w->'special') e where e->>'recurring' = to_char(d, 'MM-DD') limit 1;
  end if;
  if s is not null then return s; end if;
  return w->'days'->((array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])[extract(dow from d)::int + 1]);
end
$$;

-- 'open' | 'closed' | 'unknown' at instant `at`, in Asia/Manila time. Minute resolution;
-- a range is [open, close), overnight ranges (close < open) run into the next morning,
-- and an 'unknown' day is reported as unknown, never as closed.
create or replace function public.cafe_open_state(w jsonb, at timestamptz default now())
returns text language plpgsql stable parallel safe
as $$
declare
  local_ts timestamp := at at time zone 'Asia/Manila';
  today date := local_ts::date;
  m integer := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  today_s jsonb := public.cafe_day_schedule(w, today);
  yest_s jsonb := public.cafe_day_schedule(w, today - 1);
  r jsonb;
  o integer;
  c integer;
begin
  if today_s->>'status' = 'open' then
    for r in select value from jsonb_array_elements(today_s->'ranges') loop
      o := public.clock_minutes(r->>'open');
      c := public.clock_minutes(r->>'close');
      if c > o then
        if m >= o and m < c then return 'open'; end if;
      elsif m >= o then            -- overnight: open from `open` until midnight
        return 'open';
      end if;
    end loop;
  end if;

  if yest_s->>'status' = 'open' then  -- overnight range that began yesterday
    for r in select value from jsonb_array_elements(yest_s->'ranges') loop
      o := public.clock_minutes(r->>'open');
      c := public.clock_minutes(r->>'close');
      if c < o and m < c then return 'open'; end if;
    end loop;
  end if;

  if w->>'status' = 'unknown' or today_s->>'status' = 'unknown' then return 'unknown'; end if;
  return 'closed';
end
$$;

-- true / false / null (unknown). Convenient in WHERE clauses: where cafe_is_open(weekly_hours) is true
create or replace function public.cafe_is_open(w jsonb, at timestamptz default now())
returns boolean language sql stable parallel safe
as $$
  select case public.cafe_open_state(w, at) when 'open' then true when 'closed' then false else null end
$$;

-- Verified 24/7: all seven days are one full-day range, no unmodeled rules, and no special
-- day that closes or shortens it. (Writers keep ranges merged, so this canonical form is complete.)
create or replace function public.cafe_is_always_open(w jsonb)
returns boolean language sql immutable parallel safe
as $$
  select coalesce(
    w->>'status' = 'known'
    and jsonb_array_length(w->'unmodeled_rules') = 0
    and (select bool_and(w->'days'->k = '{"status":"open","ranges":[{"open":"00:00","close":"24:00"}]}'::jsonb)
         from unnest(array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) as k)
    and not exists (
      select 1 from jsonb_array_elements(w->'special') e
      where e->'day' <> '{"status":"open","ranges":[{"open":"00:00","close":"24:00"}]}'::jsonb),
    false)
$$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.cafes (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null,
  description             text,
  address                 text,
  barangay                text,
  latitude                double precision not null,
  longitude               double precision not null,
  weekly_hours            jsonb not null default
    '{"version":1,"timezone":"Asia/Manila","status":"unknown","days":{"mon":{"status":"unknown"},"tue":{"status":"unknown"},"wed":{"status":"unknown"},"thu":{"status":"unknown"},"fri":{"status":"unknown"},"sat":{"status":"unknown"},"sun":{"status":"unknown"}},"special":[],"unmodeled_rules":[],"source_text":null}'::jsonb,
  price_range             public.price_range,
  amenities               text[] not null default '{}',
  image_url               text,
  photo_urls              text[] not null default '{}',
  phone                   text,
  website_url             text,
  -- Generated from the coordinates so it can never drift.
  directions_url          text generated always as (
    'https://www.google.com/maps/dir/?api=1&destination='
    || trim_scale(round(latitude::numeric, 7))::text || ',' || trim_scale(round(longitude::numeric, 7))::text
  ) stored,
  verification_status     public.verification_status not null default 'unverified',
  last_verified_at        timestamptz,
  last_verified_precision public.verification_precision,
  cuisine                 text[] not null default '{}',
  notes                   text,
  source                  text not null default 'manual',
  source_ref              text,
  geog                    extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored,
  search_text             text generated always as (
    lower(public.immutable_unaccent(name || ' ' || coalesce(address, '') || ' ' || coalesce(barangay, '')))
  ) stored,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint cafes_slug_key               unique (slug),
  constraint cafes_source_ref_key         unique (source, source_ref),
  constraint cafes_name_not_blank         check (length(btrim(name)) > 0),
  constraint cafes_slug_format            check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint cafes_latitude_range         check (latitude  between -90  and 90),
  constraint cafes_longitude_range        check (longitude between -180 and 180),
  constraint cafes_weekly_hours_valid     check (public.is_valid_weekly_hours(weekly_hours)),
  constraint cafes_amenities_allowed      check (amenities <@ array['wifi', 'power', 'aircon', 'parking', 'outdoor', 'takeaway']),
  constraint cafes_image_url_http         check (image_url is null or image_url ~* '^https?://\S+$'),
  constraint cafes_website_url_http       check (website_url is null or website_url ~* '^https?://\S+$'),
  constraint cafes_photo_urls_http        check (public.all_http_urls(photo_urls)),
  constraint cafes_phone_format           check (phone is null or phone ~ '^[+0-9().;,/[:space:]-]+$'),
  constraint cafes_verified_has_date      check (verification_status <> 'verified' or last_verified_at is not null),
  constraint cafes_verified_precision     check ((last_verified_at is null) = (last_verified_precision is null)),
  constraint cafes_timestamps_ordered     check (updated_at >= created_at)
);

comment on table  public.cafes is 'Cafés in Butuan City. Current opening status is calculated, never stored (see cafe_open_state).';
comment on column public.cafes.weekly_hours is 'Weekly schedule JSON (version 1). Ranges belong to the day they start on; close < open means overnight; "24:00" only as a close time.';
comment on column public.cafes.price_range  is 'Confirmed price level only. NULL means not confirmed.';
comment on column public.cafes.amenities    is 'Amenities a source affirmatively records. Absent means unknown, not unavailable.';
comment on column public.cafes.last_verified_at is 'When a person last checked the details. last_verified_precision says how exact the date is.';
comment on column public.cafes.geog         is 'Generated point for spatial queries (ST_DWithin, distance ordering).';

-- ---------------------------------------------------------------------------
-- Indexes for the common searches
-- ---------------------------------------------------------------------------
create index cafes_geog_gist             on public.cafes using gist (geog);                                   -- near me, map bounds
create index cafes_search_trgm           on public.cafes using gin (search_text extensions.gin_trgm_ops);     -- name / street / barangay search
create index cafes_amenities_gin         on public.cafes using gin (amenities);                               -- Wi-Fi, outlets, parking...
create index cafes_barangay_lower        on public.cafes (lower(barangay)) where barangay is not null;
create index cafes_verification_status   on public.cafes (verification_status);
create index cafes_price_range           on public.cafes (price_range) where price_range is not null;
create index cafes_always_open           on public.cafes (public.cafe_is_always_open(weekly_hours));          -- "verified 24/7 only"

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger cafes_set_updated_at
  before update on public.cafes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access: the public (anon key) may only read; writes use the service role, server-side.
-- Two independent layers, so a mistake in one still leaves writes closed:
--   1. Privileges: Supabase grants anon/authenticated ALL on new public tables by default;
--      revoke that and grant SELECT only.
--   2. RLS: enabled, with a SELECT policy and deliberately NO insert/update/delete policy.
-- The service role bypasses both and must never reach browser code.
-- ---------------------------------------------------------------------------
revoke all on public.cafes from anon, authenticated;
grant select on public.cafes to anon, authenticated;

alter table public.cafes enable row level security;

create policy "Cafés are publicly readable"
  on public.cafes for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Convenience: status calculated at query time
-- ---------------------------------------------------------------------------
create view public.cafes_with_status with (security_invoker = on) as
select
  c.*,
  public.cafe_open_state(c.weekly_hours)     as open_state,       -- 'open' | 'closed' | 'unknown', right now
  public.cafe_is_always_open(c.weekly_hours) as is_always_open    -- structural, not "open now"
from public.cafes c;

revoke all on public.cafes_with_status from anon, authenticated;
grant select on public.cafes_with_status to anon, authenticated;

-- Cafés within radius_m metres of a point, nearest first.
create or replace function public.cafes_near(lat double precision, lon double precision, radius_m double precision default 5000)
returns table (id uuid, slug text, name text, distance_m double precision)
language sql stable parallel safe
as $$
  with p as (select extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography as g)
  select c.id, c.slug, c.name, extensions.st_distance(c.geog, p.g)::double precision
  from public.cafes c, p
  where extensions.st_dwithin(c.geog, p.g, radius_m)
  order by 4
$$;

-- Every word must appear in the name, address or barangay (accent- and case-insensitive).
create or replace function public.search_cafes(q text)
returns setof public.cafes
language sql stable parallel safe
as $$
  select c.*
  from public.cafes c
  where not exists (
    select 1
    from unnest(string_to_array(btrim(lower(public.immutable_unaccent(q))), ' ')) as w
    where w <> ''
      and c.search_text not like '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  )
  order by c.name
$$;
