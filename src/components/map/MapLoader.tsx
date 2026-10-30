'use client';

import dynamic from 'next/dynamic';
import { MapSkeleton } from '../Skeletons';

/** Leaflet touches `window` on import, so the map is only ever loaded in the browser. */
export const MapLoader = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});
