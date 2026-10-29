'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import type { Cafe, Category } from '@/types';
import type { LatLon } from '@/lib/geo';
import { CATEGORY_LABEL } from '@/lib/cafes';

export type MapStyle = 'night' | 'day';

const BUTUAN_CENTER: L.LatLngTuple = [8.9475, 125.5406];
// OSM standard tiles in both modes; night mode darkens them with a CSS filter (.tiles--night).
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const icons = new Map<string, L.DivIcon>();
function pinIcon(category: Category, selected: boolean) {
  const key = `${category}:${selected}`;
  let icon = icons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<span class="pin pin--${category}${selected ? ' pin--selected' : ''}"><i></i></span>`,
      iconSize: [34, 42],
      iconAnchor: [17, 40],
    });
    icons.set(key, icon);
  }
  return icon;
}

function DeselectOnMapClick({ onSelect }: { onSelect: (id: string | null) => void }) {
  useMapEvents({ click: () => onSelect(null) });
  return null;
}

/** Re-fits the view to the visible cafés whenever `signal` changes. */
function FitToCafes({ cafes, signal }: { cafes: Cafe[]; signal: number }) {
  const map = useMap();
  useEffect(() => {
    if (cafes.length === 0) return;
    map.fitBounds(L.latLngBounds(cafes.map((c) => [c.lat, c.lon] as L.LatLngTuple)), {
      padding: [60, 60],
      maxZoom: 16,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, map]);
  return null;
}

function FlyToSelected({ cafe }: { cafe: Cafe | null }) {
  const map = useMap();
  useEffect(() => {
    if (cafe) map.flyTo([cafe.lat, cafe.lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafe?.id, map]);
  return null;
}

interface Props {
  cafes: Cafe[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userPos: LatLon | null;
  style: MapStyle;
  fitSignal: number;
}

export default function MapView({ cafes, selectedId, onSelect, userPos, style, fitSignal }: Props) {
  const selected = cafes.find((c) => c.id === selectedId) ?? null;
  return (
    <MapContainer
      center={BUTUAN_CENTER}
      zoom={13}
      zoomControl={false}
      className="absolute inset-0"
      aria-label="Map of cafés in Butuan City"
    >
      <TileLayer key={style} url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} className={style === 'night' ? 'tiles--night' : ''} />
      <ZoomControl position="topright" />
      <DeselectOnMapClick onSelect={onSelect} />
      <FitToCafes cafes={cafes} signal={fitSignal} />
      <FlyToSelected cafe={selected} />

      {cafes.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lon]}
          icon={pinIcon(c.category, c.id === selectedId)}
          zIndexOffset={c.id === selectedId ? 1000 : 0}
          title={`${c.name} — ${CATEGORY_LABEL[c.category]}`}
          alt={c.name}
          keyboard
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              onSelect(c.id);
            },
          }}
        />
      ))}

      {userPos && (
        <CircleMarker
          center={[userPos.lat, userPos.lon]}
          radius={8}
          pathOptions={{ color: '#fff', weight: 3, fillColor: '#4da3ff', fillOpacity: 1 }}
        >
          <Tooltip>You are here</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
