import type { Category } from '@/types';

/** Full class strings so Tailwind can see them. */
export const CATEGORY_STYLE: Record<Category, { dot: string; tag: string }> = {
  always: { dot: 'bg-verified shadow-[0_0_10px_var(--color-verified)]', tag: 'text-verified' },
  late: { dot: 'bg-sand shadow-[0_0_10px_var(--color-sand)]', tag: 'text-sand' },
  day: { dot: 'bg-day', tag: 'text-day' },
  unknown: { dot: 'border-2 border-unknown', tag: 'text-muted' },
};
