'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/** Shown when café data (or the page itself) can't be loaded. No stale or invented data is substituted. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid h-dvh place-items-center p-6">
      <div role="alert" className="grid max-w-md justify-items-start gap-3">
        <h1 className="font-display text-2xl font-semibold">Cafés are unavailable right now</h1>
        <p className="text-muted">
          We couldn’t load the café list. This is usually a temporary connection problem; nothing you did caused it.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sand bg-sand px-4 text-sm font-medium text-ink hover:brightness-110"
        >
          <RefreshCw className="size-4" aria-hidden /> Try again
        </button>
      </div>
    </main>
  );
}
