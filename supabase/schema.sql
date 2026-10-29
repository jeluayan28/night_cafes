-- Night Café Butuan: schema for when persistent storage replaces the JSON snapshot.
-- Not applied automatically. Run in the Supabase SQL editor or as a migration.

create table if not exists public.cafes (
  id          text primary key,              -- OSM element, e.g. 'node/3665313816'
  name        text not null,
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  tags        jsonb not null default '{}',   -- raw OSM tags we keep (opening_hours, addr:*, ...)
  source      text not null default 'openstreetmap',
  updated_at  timestamptz not null default now()
);

create index if not exists cafes_name_idx on public.cafes (name);

-- Public site: anyone may read; writes only via the service role (no policy = denied).
alter table public.cafes enable row level security;

create policy "Cafés are publicly readable"
  on public.cafes for select
  using (true);
