import { CafeExplorer } from '@/components/CafeExplorer';
import { buildCafes } from '@/lib/cafes';
import { loadCafes } from '@/lib/repository';

export default async function Home() {
  const { cafes, dataDate } = await loadCafes();
  return <CafeExplorer cafes={buildCafes(cafes)} dataDate={dataDate} />;
}
