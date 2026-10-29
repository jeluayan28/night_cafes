'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Info, Navigation, Pencil } from 'lucide-react';
import type { Cafe } from '@/types';
import { AMENITY_LABEL } from '@/lib/cafes';
import { directionsUrl, formatDistance } from '@/lib/geo';
import { manilaWallClock, parseHours, weeklyHours } from '@/lib/hours';
import { uncertaintyNotes } from '@/lib/notes';
import { phoneHref } from '@/lib/safe';
import { verificationOf } from '@/lib/verification';
import { AMENITY_ICON, CafeThumb, CategoryTag, StatusLine, type Status } from './CafeCard';

const NotConfirmed = () => <span className="italic text-muted">Not confirmed</span>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-line pt-3">
      <h3 className="font-mono text-[11px] uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

const tone = {
  ok: 'border-verified text-verified',
  warn: 'border-sand text-sand',
  none: 'border-line text-muted',
} as const;

/** Only photos that load are shown; a dead link simply disappears. */
function PhotoStrip({ cafe }: { cafe: Cafe }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const shown = cafe.photos.filter((p) => !failed.has(p));
  if (shown.length === 0) return null;
  return (
    <Section title="Photos">
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {shown.map((src, i) => (
          <li key={src} className="snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${cafe.name}, photo ${i + 1}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailed((s) => new Set(s).add(src))}
              className="h-32 w-auto max-w-[240px] rounded-xl border border-line object-cover"
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Linked from OpenStreetMap. We don’t host or check these images.</p>
    </Section>
  );
}

interface Props {
  cafe: Cafe;
  status: Status;
  distance: number | null;
  onClose: () => void;
}

export function CafeDetail({ cafe, status, distance, onClose }: Props) {
  // Browser-only values (the page itself is prebuilt), so they're always current.
  const now = useMemo(() => manilaWallClock(), []);
  const oh = useMemo(() => parseHours(cafe.hoursText), [cafe.hoursText]);
  const week = useMemo(() => weeklyHours(oh, now), [oh, now]);
  const todayIndex = (now.getDay() + 6) % 7;
  const verification = verificationOf(cafe.checkedOn, now);
  const notes = uncertaintyNotes(cafe, now);
  const phone = cafe.phone ? phoneHref(cafe.phone) : null;

  const btn =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium no-underline hover:brightness-110 md:min-h-10';

  return (
    <article className="grid gap-3.5 border-l-2 border-selected pl-3.5" aria-labelledby="detail-title">
      <button type="button" onClick={onClose} className="-ml-1 flex min-h-11 items-center gap-1.5 justify-self-start px-1 text-sm text-muted hover:text-text md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden /> All cafés
      </button>

      <header className="flex items-start gap-3">
        <CafeThumb cafe={cafe} className="size-14 flex-none" />
        <div className="grid min-w-0 gap-1.5">
          <h2 id="detail-title" className="font-display text-2xl font-semibold leading-tight md:text-3xl">{cafe.name}</h2>
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <CategoryTag cafe={cafe} />
            {distance != null && <span className="font-mono text-xs">{formatDistance(distance)} away</span>}
          </p>
        </div>
      </header>

      <StatusLine status={status} />

      <div className="flex flex-wrap gap-2">
        <a href={directionsUrl(cafe)} target="_blank" rel="noreferrer noopener" className={`${btn} border-sand bg-sand !text-ink`}>
          <Navigation className="size-4" aria-hidden /> Directions in Google Maps
        </a>
        <a href={cafe.osmEditUrl} target="_blank" rel="noreferrer noopener" className={`${btn} border-line bg-slate !text-text`}>
          <Pencil className="size-4" aria-hidden /> Fix or add details
        </a>
      </div>

      {cafe.description && <p className="leading-relaxed">{cafe.description}</p>}

      <Section title="Opening hours">
        {week && cafe.hoursText ? (
          <>
            <table className="w-full text-sm">
              <caption className="sr-only">Weekly opening hours, Philippine time</caption>
              <tbody>
                {week.map((d, i) => (
                  <tr key={d.day} className={i === todayIndex ? 'font-medium text-text' : 'text-muted'}>
                    <th scope="row" className="py-1 pr-3 text-left font-[inherit]">
                      {d.day}
                      {i === todayIndex && <span className="ml-1.5 rounded bg-selected/20 px-1 font-mono text-[10px] uppercase text-selected">Today</span>}
                    </th>
                    <td className="py-1 text-right font-mono text-[13px]">
                      {d.ranges.length ? d.ranges.map((r) => <div key={r}>{r}</div>) : 'Closed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted">
              Philippine time. As recorded: <span className="font-mono">{cafe.hoursText}</span>
            </p>
          </>
        ) : (
          <p><NotConfirmed /></p>
        )}
      </Section>

      <Section title="Details">
        <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-2">
          <Row label="Address">{cafe.address ?? <NotConfirmed />}</Row>
          <Row label="Barangay">{cafe.barangay ?? <NotConfirmed />}</Row>
          <Row label="Price range">{cafe.priceRange ?? <NotConfirmed />}</Row>
          {cafe.cuisine.length > 0 && <Row label="Serves">{cafe.cuisine.join(', ')}</Row>}
          {cafe.phone && <Row label="Phone">{phone ? <a href={phone}>{cafe.phone}</a> : cafe.phone}</Row>}
          {cafe.website && (
            <Row label="Web">
              <a href={cafe.website} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all">
                {cafe.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                <ExternalLink className="size-3 flex-none" aria-hidden />
              </a>
            </Row>
          )}
          {!cafe.phone && !cafe.website && <Row label="Contact"><NotConfirmed /></Row>}
          <Row label="Location">
            <span className="font-mono text-[13px]">{cafe.lat.toFixed(5)}, {cafe.lon.toFixed(5)}</span>
          </Row>
          <Row label="ID"><span className="font-mono text-[13px]">{cafe.id}</span></Row>
        </dl>
      </Section>

      <Section title="Amenities">
        {cafe.amenities.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {cafe.amenities.map((a) => {
              const Icon = AMENITY_ICON[a];
              return (
                <li key={a} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-slate px-2.5 py-1 text-[13px]">
                  <Icon className="size-3.5" aria-hidden /> {AMENITY_LABEL[a]}
                </li>
              );
            })}
          </ul>
        ) : (
          <p><NotConfirmed /></p>
        )}
      </Section>

      <PhotoStrip cafe={cafe} />

      <Section title="Verification">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${tone[verification.tone]}`}>{verification.label}</span>
        </p>
        <p className="text-sm text-muted">{verification.detail}</p>
      </Section>

      {notes.length > 0 && (
        <section aria-labelledby="notes-title" className="grid gap-2 rounded-2xl border border-dashed border-line bg-slate/50 p-3">
          <h3 id="notes-title" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
            <Info className="size-3.5" aria-hidden /> Notes on uncertain information
          </h3>
          <ul className="grid gap-1.5 text-sm">
            {notes.map((n) => (
              <li key={n} className="flex gap-2"><span aria-hidden className="text-sand">•</span><span>{n}</span></li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        Source: <a href={cafe.osmUrl} target="_blank" rel="noreferrer noopener">OpenStreetMap</a> contributors (ODbL). Night Café Butuan hasn’t independently verified this café.
      </p>
    </article>
  );
}
