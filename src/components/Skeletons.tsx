/** Placeholders shown while data or the map loads. They carry no made-up content, only shape. */

export function CardSkeleton() {
  return (
    <li aria-hidden className="flex min-h-[92px] items-start gap-3 rounded-2xl border border-line bg-slate p-3">
      <div className="skeleton size-16 flex-none !bg-ink" />
      <div className="grid flex-1 gap-2 pt-1">
        <div className="skeleton h-4 w-2/3 !bg-ink" />
        <div className="skeleton h-3 w-full !bg-ink" />
        <div className="skeleton h-3 w-1/2 !bg-ink" />
      </div>
    </li>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul aria-hidden className="grid grid-cols-1 gap-2">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </ul>
  );
}

export function MapSkeleton() {
  return (
    <div role="status" className="skeleton absolute inset-0 grid place-items-center !rounded-none text-muted">
      <span className="rounded-xl bg-ink px-3 py-2 text-sm">Loading map…</span>
    </div>
  );
}

/** Whole-page placeholder with the same layout as the explorer, so nothing jumps when it arrives. */
export function PageSkeleton() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden" role="status" aria-busy="true">
      <span className="sr-only">Loading cafés…</span>
      <div aria-hidden className="hidden h-14 flex-none items-center gap-4 border-b border-line bg-ink px-4 md:flex">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton mx-auto h-10 w-full max-w-md" />
        <div className="skeleton h-10 w-24" />
      </div>
      <div aria-hidden className="relative min-h-0 flex-1 md:grid md:grid-cols-[340px_1fr] lg:grid-cols-[400px_1fr]">
        <div className="skeleton absolute inset-0 !rounded-none md:relative md:order-2" />
        <div className="absolute inset-x-0 bottom-0 z-10 grid h-1/2 content-start gap-3 rounded-t-[20px] border-t border-line bg-ink p-3.5 md:static md:order-1 md:h-auto md:rounded-none md:border-r md:border-t-0 md:p-4">
          <div className="skeleton h-9 w-full max-w-xs" />
          <ListSkeleton />
        </div>
      </div>
    </div>
  );
}
