'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';

export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];
const PEEK_PX = 112;
const TOP_GAP_PX = 72;

interface Props {
  snap: Snap;
  onSnap: (snap: Snap) => void;
  /** Reports the settled sheet height so the map can keep its content clear of it. */
  onHeight: (px: number) => void;
  summary: ReactNode;
  /** Shown above the summary on desktop only (filters live on the map overlay on mobile). */
  desktopTop: ReactNode;
  children: ReactNode;
}

/**
 * Bottom sheet on phones (peek / half / full, draggable by its handle); a plain
 * left column from `md` up. Only the handle takes drags and the body scrolls with
 * `overscroll-contain`, so map gestures and list scrolling never compete.
 */
export function BottomSheet({ snap, onSnap, onHeight, summary, desktopTop, children }: Props) {
  const [vh, setVh] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null);

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const heights = vh ? { peek: PEEK_PX, half: Math.round(vh * 0.5), full: vh - TOP_GAP_PX } : null;

  useEffect(() => {
    if (heights) onHeight(heights[snap]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, vh]);

  const cycle = () => onSnap(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (!heights || !root.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, h: root.current.getBoundingClientRect().height, moved: false };
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const s = start.current;
    if (!s || !heights) return;
    const dy = s.y - e.clientY;
    if (Math.abs(dy) > 6) s.moved = true;
    if (s.moved) setDrag(Math.min(Math.max(s.h + dy, PEEK_PX), heights.full));
  }
  function onPointerUp() {
    const s = start.current;
    start.current = null;
    if (!s || !heights) return;
    if (!s.moved) return cycle(); // a tap
    const h = drag ?? s.h;
    const nearest = ORDER.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a));
    setDrag(null);
    onSnap(nearest);
  }

  const height = drag ?? heights?.[snap];
  return (
    <aside
      ref={root}
      aria-label="Café results"
      style={{ '--sheet-h': height !== undefined ? `${height}px` : undefined } as CSSProperties}
      className={`absolute inset-x-0 bottom-0 z-[1000] flex h-[var(--sheet-h,50dvh)] flex-col rounded-t-[20px] border-t border-line bg-ink pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.45)] ${
        drag === null ? 'transition-[height] duration-200' : ''
      } md:static md:order-1 md:h-auto md:min-h-0 md:rounded-none md:border-r md:border-t-0 md:pb-0 md:shadow-none`}
    >
      <button
        type="button"
        aria-expanded={snap !== 'peek'}
        aria-label={snap === 'full' ? 'Collapse café list' : 'Expand café list'}
        onClick={(e) => e.detail === 0 && cycle()} // keyboard activation; pointer taps are handled above
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; setDrag(null); }}
        className="flex h-11 w-full flex-none touch-none items-center justify-center md:hidden"
      >
        <span aria-hidden className="h-1 w-10 rounded-full bg-line" />
        <ChevronUp aria-hidden className={`ml-2 size-4 text-muted transition-transform ${snap === 'full' ? 'rotate-180' : ''}`} />
      </button>

      <div className="hidden flex-none p-4 pb-2 md:block">{desktopTop}</div>
      <div className="flex flex-none items-baseline justify-between gap-3 px-3.5 pb-2 md:px-4">{summary}</div>

      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto overscroll-contain px-3.5 pb-4 md:px-4">{children}</div>
    </aside>
  );
}
