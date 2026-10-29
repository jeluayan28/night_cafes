'use client';

import { useState } from 'react';
import { ArrowLeft, Clock, Coffee, MapPin, Navigation, Pencil, ShoppingBag, Snowflake, Trees, Wifi, type LucideIcon } from 'lucide-react';
import type { Amenity, Cafe, OpenStatus } from '@/types';
import { AMENITY_LABEL, CATEGORY_LABEL } from '@/lib/cafes';
import { CATEGORY_STYLE } from '@/lib/category';
import { directionsUrl, formatDistance } from '@/lib/geo';

const AMENITY_ICON: Record<Amenity, LucideIcon> = {
  wifi: Wifi,
  outdoor: Trees,
  aircon: Snowflake,
  takeaway: ShoppingBag,
};

/** undefined until the client clock is available; null when the café lists no hours. */
type Status = OpenStatus | null | undefined;

/** Real photo when OpenStreetMap has one; otherwise a category-tinted icon tile. Never a fake photo. */
export function CafeThumb({ cafe, className = '' }: { cafe: Cafe; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (cafe.image && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cafe.image} alt="" loading="lazy" onError={() => setFailed(true)} className={`rounded-xl border border-line object-cover ${className}`} />;
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
  return (
    <span className={`text-[13px] font-medium ${status.isOpen ? 'text-verified' : 'text-closed'}`}>
      {status.isOpen ? 'Open now' : 'Closed now'}
      {status.changeAt && ` · ${status.isOpen ? 'closes' : 'opens'} ${status.changeAt}`}
    </span>
  );
}

function CategoryTag({ cafe }: { cafe: Cafe }) {
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
            <span className="truncate">{cafe.address ?? 'Butuan City'}</span>
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

const btn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-slate px-3.5 py-2 text-sm font-medium no-underline hover:border-muted md:min-h-10';

export function CafeDetail({ cafe, status, distance, onClose }: Omit<CardProps, 'onSelect'> & { onClose: () => void }) {
  return (
    <article className="grid gap-3 border-l-2 border-selected pl-3.5" aria-labelledby="detail-title">
      <button type="button" onClick={onClose} className="-ml-1 flex min-h-11 items-center gap-1.5 justify-self-start px-1 text-sm text-muted hover:text-text md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden /> All cafés
      </button>
      <div className="flex items-start gap-3">
        <CafeThumb cafe={cafe} className="size-14 flex-none" />
        <div className="grid min-w-0 gap-1.5">
          <h2 id="detail-title" className="font-display text-2xl font-semibold leading-tight md:text-3xl">{cafe.name}</h2>
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <CategoryTag cafe={cafe} />
            {distance != null && <span className="font-mono text-xs">{formatDistance(distance)} away</span>}
          </p>
        </div>
      </div>
      <StatusLine status={status} />

      <dl className="my-1 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2">
        <dt className="text-[13px] text-muted">Hours</dt>
        <dd className="font-mono text-[13px]">{cafe.hoursText ?? 'Not listed on OpenStreetMap yet'}</dd>
        {cafe.address && (<><dt className="text-[13px] text-muted">Address</dt><dd>{cafe.address}</dd></>)}
        {cafe.cuisine.length > 0 && (<><dt className="text-[13px] text-muted">Serves</dt><dd>{cafe.cuisine.join(', ')}</dd></>)}
        {cafe.phone && (<><dt className="text-[13px] text-muted">Phone</dt><dd><a href={`tel:${cafe.phone}`}>{cafe.phone}</a></dd></>)}
        {cafe.website && (
          <>
            <dt className="text-[13px] text-muted">Web</dt>
            <dd className="break-all"><a href={cafe.website} target="_blank" rel="noreferrer noopener">{cafe.website.replace(/^https?:\/\/(www\.)?/, '')}</a></dd>
          </>
        )}
        <dt className="text-[13px] text-muted">Coordinates</dt>
        <dd className="font-mono text-[13px]">{cafe.lat.toFixed(5)}, {cafe.lon.toFixed(5)}</dd>
      </dl>

      {cafe.amenities.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Amenities">
          {cafe.amenities.map((a) => {
            const Icon = AMENITY_ICON[a];
            return (
              <li key={a} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-slate px-2.5 py-1 text-[13px]">
                <Icon className="size-3.5" aria-hidden /> {AMENITY_LABEL[a]}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={directionsUrl(cafe)} target="_blank" rel="noreferrer noopener" className={`${btn} !border-sand !bg-sand !text-ink hover:brightness-105`}>
          <Navigation className="size-4" aria-hidden /> Get directions
        </a>
        <a href={cafe.osmEditUrl} target="_blank" rel="noreferrer noopener" className={`${btn} !text-text`}>
          <Pencil className="size-4" aria-hidden /> Update details on OSM
        </a>
      </div>
      <p className="text-xs text-muted">
        Details come from <a href={cafe.osmUrl} target="_blank" rel="noreferrer noopener">OpenStreetMap</a>. Fields appear only when someone has recorded them there.
      </p>
    </article>
  );
}
