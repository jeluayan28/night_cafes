'use client';

import dynamic from 'next/dynamic';

/** Leaflet touches `window` on import, so the map is only ever loaded in the browser. */
export const MapLoader = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-ink text-muted" role="status">
      Loading map…
    </div>
  ),
});
