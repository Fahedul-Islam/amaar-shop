import type { ReactNode } from 'react';

export type Tone = 'discount' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'neutral' | 'success';

const toneClass: Record<Tone, string> = {
  discount: 'bg-coral-50 text-coral-600',
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  neutral: 'bg-stone-100 text-stone-700',
  success: 'bg-teal-50 text-teal-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium leading-[1.4] ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

const toneMap: Record<string, Tone> = {
  pending: 'pending',
  confirmed: 'confirmed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};
export function statusTone(status: string): Tone {
  return toneMap[status.toLowerCase()] ?? 'neutral';
}
