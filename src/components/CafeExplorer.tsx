'use client';

import { useEffect, useMemo, useState } from 'react';
import { LocateFixed, Moon } from 'lucide-react';
import type { Cafe, Filters } from '@/types';
import { applyFilters, countByCategory, sortCafes } from '@/lib/cafes';
import { manilaWallClock, openStatus, parseHours } from '@/lib/hours';
import { distanceM, type LatLon } from '@/lib/geo';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { MapLoader } from './map/MapLoader';
import type { MapStyle } from './map/MapView';
import { BottomSheet, type Snap } from './BottomSheet';
import { CafeCard, CafeDetail } from './CafeCard';
import { DataNotice } from './DataNotice';
import { FilterChips } from './FilterChips';
import { Legend } from './Legend';
import { SearchInput } from './SearchInput';

const INITIAL: Filters = { query: '', category: 'all', openNow: false, amenities: [] };
/** Height of the floating search bar + chip row on phones, in px. */
const MOBILE_TOP_INSET = 128;

export function CafeExplorer({ cafes, dataDate }: { cafes: Cafe[]; dataDate: string }) {
  const [filters, setFilters] = useState(INITIAL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<LatLon | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('night');
  const [showLegend, setShowLegend] = useState(true);
  const [snap, setSnap] = useState<Snap>('peek');
  const [sheetPx, setSheetPx] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  // Philippine wall clock; null on the server and first render so hydration matches.
  const [now, setNow] = useState<Date | null>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    setNow(manilaWallClock());
    const id = setInterval(() => setNow(manilaWallClock()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hours = useMemo(() => new Map(cafes.map((c) => [c.id, parseHours(c.hoursText)])), [cafes]);
  const statusOf = (c: Cafe) => (now ? openStatus(hours.get(c.id) ?? null, now) : undefined);

  const counts = useMemo(() => countByCategory(cafes), [cafes]);
  const noNight = counts.always + counts.late === 0;
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
    if (id) setSnap('half'); // phones: show the details without hiding the map
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

  const chips = (scroll: boolean) => (
    <FilterChips filters={filters} counts={counts} total={cafes.length} onChange={setFilters} scroll={scroll} />
  );
  const insets = isMobile ? { top: MOBILE_TOP_INSET, bottom: snap === 'full' ? 0 : sheetPx } : { top: 0, bottom: 0 };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Desktop / tablet header */}
      <header className="z-[1100] hidden h-14 flex-none items-center gap-4 border-b border-line bg-ink px-4 md:flex">
        <div className="flex min-w-0 flex-none items-center gap-2.5">
          <Moon className="size-5 flex-none fill-sand text-sand" aria-hidden />
          <div>
            <h1 className="whitespace-nowrap font-display text-[22px] font-semibold leading-none">
              Night Café <em className="font-medium text-sand">Butuan</em>
            </h1>
            <p className="mt-1 hidden text-xs leading-none text-muted lg:block">Your city, after hours.</p>
          </div>
        </div>
        <SearchInput value={filters.query} onChange={(query) => setFilters({ ...filters, query })} className="mx-auto w-full max-w-md" />
        <div className="flex flex-none items-center gap-3">
          {now && (
            <p className="hidden font-mono text-xs text-muted lg:block" aria-label="Current time in Butuan">
              <span className="text-verified">●</span> {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')} PHT
            </p>
          )}
          <button
            type="button"
            onClick={locate}
            aria-label={userPos ? 'Update my location' : 'Find cafés near me'}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:border-muted"
          >
            <LocateFixed className="size-4" aria-hidden />
            <span className="hidden lg:inline">{userPos ? 'Update location' : 'Near me'}</span>
          </button>
        </div>
      </header>

      <main
        className="relative min-h-0 flex-1 md:grid md:grid-cols-[340px_1fr] lg:grid-cols-[400px_1fr]"
        style={{ '--sheet-h': `${sheetPx}px` } as React.CSSProperties}
      >
        <section aria-label="Map" className="absolute inset-0 z-0 md:relative md:order-2">
          <MapLoader
            cafes={visible}
            selectedId={selected?.id ?? null}
            onSelect={select}
            userPos={userPos}
            style={mapStyle}
            onStyleChange={setMapStyle}
            showLegend={showLegend}
            onShowLegendChange={setShowLegend}
            fitSignal={fitSignal}
            onRecenter={() => setFitSignal((n) => n + 1)}
            onLocate={locate}
            insets={insets}
          />
          {showLegend && <Legend className="absolute bottom-7 left-3 z-[500] hidden rounded-xl border border-line bg-ink px-3 py-2 md:flex" />}
        </section>

        {/* Phone: floating search + horizontally scrolling chips. Wrapper ignores touches so the map stays draggable around them. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
          <h1 className="sr-only">Night Café Butuan — Your city, after hours.</h1>
          <div className="pointer-events-auto mx-3 flex items-center gap-2 rounded-2xl border border-line bg-ink p-1.5 shadow-lg">
            <Moon className="ml-2 size-5 flex-none fill-sand text-sand" aria-hidden />
            <SearchInput value={filters.query} onChange={(query) => setFilters({ ...filters, query })} className="min-w-0 flex-1 [&_input]:border-0" />
          </div>
          <div className="pointer-events-auto mt-2">{chips(true)}</div>
        </div>

        <BottomSheet
          snap={snap}
          onSnap={setSnap}
          onHeight={setSheetPx}
          desktopTop={chips(false)}
          summary={
            selected ? (
              snap === 'peek' ? (
                <span className="truncate font-display text-base font-semibold md:hidden">{selected.name}</span>
              ) : (
                <span className="text-[13px] text-muted md:hidden">Selected café</span>
              )
            ) : (
              <>
                <span aria-live="polite" className="text-[13px] text-muted">
                  {visible.length} {visible.length === 1 ? 'café' : 'cafés'}
                  {userPos ? ' · nearest first' : ''}
                </span>
                {noNight && <span className="text-xs text-sand">No verified night hours yet</span>}
              </>
            )
          }
        >
          {geoError && <p role="alert" className="mb-3 text-[13px] text-closed">{geoError}</p>}
          {selected && (
            <CafeDetail cafe={selected} status={statusOf(selected)} distance={distance(selected)} onClose={() => select(null)} />
          )}
          {/* Kept mounted (hidden) while a café is open so the list keeps its scroll position. */}
          <div className={selected ? 'hidden' : 'grid grid-cols-1 gap-3.5'}>
            <DataNotice counts={counts} dataDate={dataDate} />
            {visible.length > 0 ? (
              <ul className="grid grid-cols-1 gap-2">
                {visible.map((c) => (
                  <CafeCard key={c.id} cafe={c} status={statusOf(c)} distance={distance(c)} onSelect={() => select(c.id)} />
                ))}
              </ul>
            ) : (
              <div className="grid justify-items-start gap-2.5 text-muted">
                <p>No cafés match these filters.</p>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-line px-3.5 text-sm font-medium text-text hover:border-muted md:min-h-10"
                  onClick={() => setFilters(INITIAL)}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </BottomSheet>
      </main>
    </div>
  );
}
