import type { Category } from '@/types';

/** Explains the data's limits honestly; most prominent when no night café is verified. */
export function DataNotice({ counts, dataDate }: { counts: Record<Category, number>; dataDate: string }) {
  const noNight = counts.always + counts.late === 0;
  const updated = new Date(dataDate).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila',
  });
  return (
    <aside
      className={
        noNight
          ? 'rounded-2xl border border-sand/60 bg-slate px-3.5 py-3 text-sm'
          : 'rounded-2xl border border-dashed border-line px-3.5 py-3 text-sm text-muted'
      }
    >
      {noNight && (
        <p>
          <strong>No verified night cafés yet.</strong> None of the Butuan cafés on OpenStreetMap currently list
          24/7 or late-night hours, and we don’t guess. If you know one, add its hours on OpenStreetMap and it
          will appear here after the next data refresh.
        </p>
      )}
      <p className={`text-xs text-muted ${noNight ? 'mt-2' : ''}`}>
        Data: © OpenStreetMap contributors (ODbL), snapshot of {updated}. Hours are in Philippine time.
      </p>
    </aside>
  );
}
