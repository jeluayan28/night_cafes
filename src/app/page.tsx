import { CafeExplorer } from '@/components/CafeExplorer';
import { buildCafes } from '@/lib/cafes';
import { loadSnapshot } from '@/lib/repository';

export default async function Home() {
  const snapshot = await loadSnapshot();
  return (
    <CafeExplorer
      cafes={buildCafes(snapshot.cafes)}
      dataDate={snapshot.osmTimestamp ?? snapshot.generatedAt}
    />
  );
}
