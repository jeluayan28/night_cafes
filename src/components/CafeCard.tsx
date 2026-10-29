'use client';

import { useState } from 'react';
import { Clock, Coffee, MapPin, Plug, ShoppingBag, Snowflake, SquareParking, Trees, Wifi, type LucideIcon } from 'lucide-react';
import type { Amenity, Cafe, OpenStatus } from '@/types';
import { AMENITY_LABEL, CATEGORY_LABEL } from '@/lib/cafes';
import { CATEGORY_STYLE } from '@/lib/category';
import { formatDistance } from '@/lib/geo';

export const AMENITY_ICON: Record<Amenity, LucideIcon> = {
  wifi: Wifi,
  power: Plug,
  parking: SquareParking,
  outdoor: Trees,
  aircon: Snowflake,
  takeaway: ShoppingBag,
};

/** undefined until the client clock is available; null when the café lists no hours. */
export type Status = OpenStatus | null | undefined;

/** Real photo when OpenStreetMap has one; otherwise a category-tinted icon tile. Never a fake photo. */
export function CafeThumb({ cafe, className = '' }: { cafe: Cafe; className?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = cafe.photos[0];
  if (photo && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`rounded-xl border border-line object-cover ${className}`} />;
  }
  return (
    <span aria-hidden className={`grid place-items-center rounded-xl border border-line bg-ink ${CATEGORY_STYLE[cafe.category].tag} ${className}`}>
      <Coffee className="size-1/2" strokeWidth={1.75} />
    </span>
  );
}

export function StatusLine({ status }: { status: Status }) {
  if (status === undefined) return <span className="h-5" aria-hidden />;
  if (status === null) return <span className="text-[13px] text-muted">Opening hours not listed</span>;
  if (status.unknown) return <span className="text-[13px] text-muted">Hours need confirming right now</span>;
  return (
    <span className={`text-[13px] font-medium ${status.isOpen ? 'text-verified' : 'text-closed'}`}>
      {status.isOpen ? 'Open now' : 'Closed now'}
      {status.changeAt && ` · ${status.isOpen ? 'closes' : 'opens'} ${status.changeAt}`}
    </span>
  );
}

export function CategoryTag({ cafe }: { cafe: Cafe }) {
  return (
    <span className={`rounded-full border border-current px-2 font-mono text-[11px] uppercase tracking-wide ${CATEGORY_STYLE[cafe.category].tag}`}>
      {CATEGORY_LABEL[cafe.category]}
    </span>
  );
}

export function AmenityIcons({ amenities }: { amenities: Amenity[] }) {
  if (amenities.length === 0) return null;
  return (
    <ul aria-label="Amenities" className="flex gap-2 text-muted">
      {amenities.map((a) => {
        const Icon = AMENITY_ICON[a];
        return (
          <li key={a} title={AMENITY_LABEL[a]}>
            <Icon className="size-4" aria-hidden />
            <span className="sr-only">{AMENITY_LABEL[a]}</span>
          </li>
        );
      })}
    </ul>
  );
}

interface CardProps {
  cafe: Cafe;
  status: Status;
  distance: number | null;
  onSelect: () => void;
}

export function CafeCard({ cafe, status, distance, onSelect }: CardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-[92px] w-full items-start gap-3 rounded-2xl border border-line bg-slate p-3 text-left hover:border-selected"
      >
        <CafeThumb cafe={cafe} className="size-16 flex-none" />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="truncate font-display text-[17px] font-semibold leading-tight">{cafe.name}</span>
            {distance != null && <span className="flex-none font-mono text-xs text-muted">{formatDistance(distance)}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
            <MapPin className="size-3.5 flex-none" aria-hidden />
            <span className="truncate">{cafe.shortAddress ?? 'Butuan City'}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-muted">
            <Clock className="size-3.5 flex-none" aria-hidden />
            <span className="truncate font-mono text-xs">{cafe.hoursText ?? 'Hours not listed'}</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5">
            <CategoryTag cafe={cafe} />
            {status !== null && <StatusLine status={status} />}
          </span>
          <AmenityIcons amenities={cafe.amenities} />
        </span>
      </button>
    </li>
  );
}
