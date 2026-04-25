import { formatBDT } from '@/lib/format';

interface Props {
  amount: number | string;
  old?: number | string | null;
  locale?: 'en' | 'bn';
  size?: 'sm' | 'md' | 'lg';
}

export function Price({ amount, old, locale = 'en', size = 'md' }: Props) {
  const fs = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base';
  const oldFs = size === 'lg' ? 'text-base' : 'text-xs';
  const a = typeof amount === 'string' ? parseFloat(amount) : amount;
  const o = old != null ? (typeof old === 'string' ? parseFloat(old) : old) : null;
  const onSale = o != null && o > a;
  return (
    <div className="flex items-baseline gap-2">
      {onSale && <span className={`text-stone-400 line-through ${oldFs}`}>{formatBDT(o!, locale)}</span>}
      <span className={`${onSale ? 'text-coral-500' : 'text-stone-900'} font-semibold ${fs}`}>
        {formatBDT(a, locale)}
      </span>
    </div>
  );
}
