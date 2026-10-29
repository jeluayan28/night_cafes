'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, LocateFixed, Moon, Sun } from 'lucide-react';
import type { Cafe, Filters } from '@/types';
import { applyFilters, countByCategory, sortCafes } from '@/lib/cafes';
import { manilaWallClock, openStatus, parseHours } from '@/lib/hours';
import { distanceM, type LatLon } from '@/lib/geo';
import { CATEGORY_STYLE } from '@/lib/category';
import { CATEGORY_LABEL } from '@/lib/cafes';
import { MapLoader } from './map/MapLoader';
import type { MapStyle } from './map/MapView';
import { FilterBar } from './FilterBar';
import { CafeCard, CafeDetail } from './CafeCard';
import { DataNotice } from './DataNotice';

const INITIAL: Filters = { query: '', category: 'all', openNow: false, amenities: [] };
const headerBtn =
  'inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-medium hover:border-muted md:min-h-10 md:text-sm';

export function CafeExplorer({ cafes, dataDate }: { cafes: Cafe[]; dataDate: string }) {
  const [filters, setFilters] = useState(INITIAL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<LatLon | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('night');
  const [sheetOpen, setSheetOpen] = useState(true);
  // Philippine wall clock; null on the server and first render so hydration matches.
  const [now, setNow] = useState<Date | null>(null);
  const [fitSignal, setFitSignal] = useState(0);

  useEffect(() => {
    setNow(manilaWallClock());
    const id = setInterval(() => setNow(manilaWallClock()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hours = useMemo(() => new Map(cafes.map((c) => [c.id, parseHours(c.hoursText)])), [cafes]);
  const statusOf = (c: Cafe) => (now ? openStatus(hours.get(c.id) ?? null, now) : undefined);

  const counts = useMemo(() => countByCategory(cafes), [cafes]);
  const visible = useMemo(() => {
    const filtered = applyFilters(cafes, filters, (c) => {
      const s = now ? openStatus(hours.get(c.id) ?? null, now) : null;
      return s?.isOpen ?? null;
    });
    return sortCafes(filtered, userPos ? (c) => distanceM(userPos, c) : null);
  }, [cafes, filters, userPos, now, hours]);

  const visibleKey = visible.map((c) => c.id).join();
  useEffect(() => setFitSignal((n) => n + 1), [visibleKey]);

  const selected = visible.find((c) => c.id === selectedId) ?? null;
  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) setSheetOpen(true);
  };
  const distance = (c: Cafe) => (userPos ? distanceM(userPos, c) : null);

  function locate() {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError('Location is not supported by this browser.');
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setGeoError('Couldn’t get your location. Check your browser’s permission.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-[1100] flex h-14 flex-none items-center justify-between gap-3 border-b border-line bg-ink px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Moon className="size-5 flex-none fill-sand text-sand" aria-hidden />
          <div className="min-w-0">
            <h1 className="whitespace-nowrap font-display text-[19px] font-semibold leading-none md:text-[22px]">
              Night Café <em className="font-medium text-sand">Butuan</em>
            </h1>
            <p className="mt-1 hidden text-xs text-muted sm:block">Your city, after hours.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {now && (
            <p className="mr-2 hidden font-mono text-xs text-muted md:block" aria-label="Current time in Butuan">
              <span className="text-verified">●</span> {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')} PHT
            </p>
          )}
          <button type="button" className={headerBtn} onClick={locate}>
            <LocateFixed className="size-4" aria-hidden /> {userPos ? 'Update location' : 'Near me'}
          </button>
          <button type="button" className={headerBtn} aria-pressed={mapStyle === 'day'} onClick={() => setMapStyle(mapStyle === 'night' ? 'day' : 'night')}>
            {mapStyle === 'night' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{mapStyle === 'night' ? 'Light map' : 'Dark map'}</span>
            <span className="sr-only sm:hidden">Switch map style</span>
          </button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 md:grid md:grid-cols-[340px_1fr] lg:grid-cols-[400px_1fr]">
        <section aria-label="Map" className="absolute inset-0 md:relative md:order-2">
          <MapLoader cafes={visible} selectedId={selected?.id ?? null} onSelect={select} userPos={userPos} style={mapStyle} fitSignal={fitSignal} />
          <ul
            aria-label="Map legend"
            className="absolute left-3 right-14 top-3 z-[500] flex flex-wrap gap-x-3.5 gap-y-1.5 rounded-xl border border-line bg-ink px-3 py-2 text-xs md:bottom-7 md:right-auto md:top-auto"
          >
            {(['always', 'late', 'day', 'unknown'] as const).map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span className={`size-3 rounded-full ${CATEGORY_STYLE[c].dot}`} />
                {c === 'always' ? '24/7' : c === 'day' ? 'Daytime' : CATEGORY_LABEL[c]}
              </li>
            ))}
          </ul>
        </section>

        <aside
          aria-label="Café list"
          className={`absolute inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-[20px] border-t border-line bg-ink shadow-[0_-10px_30px_rgba(0,0,0,0.45)] transition-[height] duration-200 ${
            sheetOpen ? 'h-[56dvh]' : 'h-11'
          } md:static md:order-1 md:h-auto md:min-h-0 md:rounded-none md:border-r md:border-t-0 md:shadow-none`}
        >
          <button
            type="button"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(!sheetOpen)}
            className="flex h-11 w-full flex-none items-center justify-center md:hidden"
          >
            <span aria-hidden className="h-1 w-10 rounded-full bg-line" />
            <ChevronDown aria-hidden className={`ml-2 size-4 text-muted transition-transform ${sheetOpen ? '' : 'rotate-180'}`} />
            <span className="sr-only">{sheetOpen ? 'Collapse' : 'Expand'} café list</span>
          </button>

          <div className={`min-h-0 flex-1 content-start gap-3.5 overflow-y-auto px-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] md:grid md:p-4 ${sheetOpen ? 'grid' : 'hidden'}`}>
            {selected ? (
              <CafeDetail cafe={selected} status={statusOf(selected)} distance={distance(selected)} onClose={() => select(null)} />
            ) : (
              <>
                <DataNotice counts={counts} dataDate={dataDate} />
                <FilterBar filters={filters} counts={counts} total={cafes.length} onChange={setFilters} />
                {geoError && <p role="alert" className="text-[13px] text-closed">{geoError}</p>}
                <p aria-live="polite" className="text-[13px] text-muted">
                  {visible.length} {visible.length === 1 ? 'café' : 'cafés'}
                  {userPos ? ' · nearest first' : ''}
                </p>
                {visible.length > 0 ? (
                  <ul className="grid gap-2">
                    {visible.map((c) => (
                      <CafeCard key={c.id} cafe={c} status={statusOf(c)} distance={distance(c)} onSelect={() => select(c.id)} />
                    ))}
                  </ul>
                ) : (
                  <div className="grid justify-items-start gap-2.5 text-muted">
                    <p>No cafés match these filters.</p>
                    <button type="button" className={headerBtn} onClick={() => setFilters(INITIAL)}>Clear filters</button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
