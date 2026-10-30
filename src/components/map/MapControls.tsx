'use client';

import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { Layers, LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import { Legend } from '../Legend';

export type MapStyle = 'night' | 'day';

interface Props {
  map: L.Map | null;
  style: MapStyle;
  onStyleChange: (style: MapStyle) => void;
  showLegend: boolean;
  onShowLegendChange: (show: boolean) => void;
  onRecenter: () => void;
  onLocate: () => void;
}

const btn = 'grid size-11 place-items-center text-text hover:bg-slate md:size-10';
const group = 'overflow-hidden rounded-xl border border-edge bg-ink shadow-lg divide-y divide-edge';
const option =
  'min-h-11 rounded-lg border border-edge px-3 text-sm aria-pressed:border-selected aria-pressed:text-selected md:min-h-9';

/** Floating controls. They sit outside Leaflet's DOM so they share our styling and accessibility. */
export function MapControls({ map, style, onStyleChange, showLegend, onShowLegendChange, onRecenter, onLocate }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={box} className="absolute right-3 top-[calc(7.75rem+env(safe-area-inset-top))] z-[500] grid gap-2 md:top-3">
      <div className={`relative ${group}`}>
        <button type="button" className={btn} aria-label="Map display options" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Layers className="size-5" aria-hidden />
        </button>
        {open && (
          <div
            role="dialog"
            aria-label="Map display options"
            className="absolute right-full top-0 z-[700] mr-2 grid w-60 gap-3 rounded-xl border border-line bg-ink p-3 shadow-xl"
          >
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">Map style</legend>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={option} aria-pressed={style === 'night'} onClick={() => onStyleChange('night')}>Night</button>
                <button type="button" className={option} aria-pressed={style === 'day'} onClick={() => onStyleChange('day')}>Light</button>
              </div>
            </fieldset>
            <label className="hidden min-h-9 items-center gap-2 text-sm md:flex">
              <input type="checkbox" className="size-4 accent-[#f2c38b]" checked={showLegend} onChange={(e) => onShowLegendChange(e.target.checked)} />
              Show legend
            </label>
            <div className="md:hidden">
              <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">Legend</p>
              <Legend />
            </div>
          </div>
        )}
      </div>

      <div className={group}>
        <button type="button" className={btn} aria-label="Zoom in" onClick={() => map?.zoomIn()}><Plus className="size-5" aria-hidden /></button>
        <button type="button" className={btn} aria-label="Zoom out" onClick={() => map?.zoomOut()}><Minus className="size-5" aria-hidden /></button>
      </div>
      <div className={group}>
        <button type="button" className={btn} aria-label="Show all listed cafés" onClick={onRecenter}><Maximize2 className="size-[18px]" aria-hidden /></button>
        <button type="button" className={btn} aria-label="Show my location" onClick={onLocate}><LocateFixed className="size-5" aria-hidden /></button>
      </div>
    </div>
  );
}
