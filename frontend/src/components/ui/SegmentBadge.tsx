import { type CustomerSegment, SEGMENT_DESCRIPTIONS, SEGMENT_LABELS } from '@/lib/customerApi';

const STYLES: Record<CustomerSegment, string> = {
  vip: 'bg-amber-50 text-amber-800 border-amber-200',
  returning: 'bg-teal-50 text-teal-700 border-teal-200',
  new: 'bg-sky-50 text-sky-700 border-sky-200',
  inactive: 'bg-stone-100 text-stone-600 border-stone-200',
};

const DOTS: Record<CustomerSegment, string> = {
  vip: 'bg-amber-500',
  returning: 'bg-teal-500',
  new: 'bg-sky-500',
  inactive: 'bg-stone-400',
};

export function SegmentBadge({ segment, size = 'md' }: { segment: CustomerSegment; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span
      title={SEGMENT_DESCRIPTIONS[segment]}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium cursor-help ${sz} ${STYLES[segment]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[segment]}`} />
      {SEGMENT_LABELS[segment]}
    </span>
  );
}
