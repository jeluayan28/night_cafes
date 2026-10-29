'use client';

import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { Cafe, Category } from '@/types';
import type { LatLon } from '@/lib/geo';
import { CATEGORY_LABEL } from '@/lib/cafes';
import { MapControls, type MapStyle } from './MapControls';

export type { MapStyle };

/** Pixels of the map covered by overlays (search bar on top, bottom sheet below). */
export interface Insets {
  top: number;
  bottom: number;
}

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
function FitToCafes({ cafes, signal, insets }: { cafes: Cafe[]; signal: number; insets: Insets }) {
  const map = useMap();
  useEffect(() => {
    if (cafes.length === 0) return;
    map.fitBounds(L.latLngBounds(cafes.map((c) => [c.lat, c.lon] as L.LatLngTuple)), {
      paddingTopLeft: [48, insets.top + 32],
      paddingBottomRight: [48, insets.bottom + 32],
      maxZoom: 16,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, map]);
  return null;
}

/** Flies to the selection, centred in the part of the map that no overlay covers. */
function FlyToSelected({ cafe, insets }: { cafe: Cafe | null; insets: Insets }) {
  const map = useMap();
  useEffect(() => {
    if (!cafe) return;
    const zoom = Math.max(map.getZoom(), 16);
    const target = map.project([cafe.lat, cafe.lon], zoom).add([0, (insets.bottom - insets.top) / 2]);
    map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.6 });
    // Re-centres when the overlays resize (e.g. the sheet settling), keeping the pin in view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafe?.id, insets.top, insets.bottom, map]);
  return null;
}

interface Props {
  cafes: Cafe[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userPos: LatLon | null;
  style: MapStyle;
  onStyleChange: (style: MapStyle) => void;
  showLegend: boolean;
  onShowLegendChange: (show: boolean) => void;
  fitSignal: number;
  onRecenter: () => void;
  onLocate: () => void;
  insets: Insets;
}

export default function MapView({
  cafes, selectedId, onSelect, userPos, style, onStyleChange, showLegend, onShowLegendChange,
  fitSignal, onRecenter, onLocate, insets,
}: Props) {
  const [map, setMap] = useState<L.Map | null>(null);
  const selected = cafes.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="absolute inset-0">
      <MapContainer ref={setMap} center={BUTUAN_CENTER} zoom={13} zoomControl={false} className="size-full" aria-label="Map of cafés in Butuan City">
        <TileLayer key={style} url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} className={style === 'night' ? 'tiles--night' : ''} />
        <DeselectOnMapClick onSelect={onSelect} />
        <FitToCafes cafes={cafes} signal={fitSignal} insets={insets} />
        <FlyToSelected cafe={selected} insets={insets} />

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
          <CircleMarker center={[userPos.lat, userPos.lon]} radius={8} pathOptions={{ color: '#f6f2ec', weight: 3, fillColor: '#a7b4ff', fillOpacity: 1 }}>
            <Tooltip>You are here</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <MapControls
        map={map}
        style={style}
        onStyleChange={onStyleChange}
        showLegend={showLegend}
        onShowLegendChange={onShowLegendChange}
        onRecenter={onRecenter}
        onLocate={onLocate}
      />
    </div>
  );
}
