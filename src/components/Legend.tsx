import { CATEGORY_LABEL } from '@/lib/cafes';
import { CATEGORY_STYLE } from '@/lib/category';

const ORDER = ['always', 'late', 'day', 'unknown'] as const;

export function Legend({ className = '' }: { className?: string }) {
  return (
    <ul aria-label="Map legend" className={`flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs ${className}`}>
      {ORDER.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-full ${CATEGORY_STYLE[c].dot}`} />
          {c === 'always' ? '24/7' : c === 'day' ? 'Daytime' : CATEGORY_LABEL[c]}
        </li>
      ))}
    </ul>
  );
}
