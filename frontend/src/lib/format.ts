const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function toBnDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
}

export function formatNumber(n: number | string, locale: 'en' | 'bn' = 'en'): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (Number.isNaN(num)) return String(n);
  const s = num.toLocaleString('en-BD', { maximumFractionDigits: 2 });
  return locale === 'bn' ? toBnDigits(s) : s;
}

export function formatBDT(n: number | string, locale: 'en' | 'bn' = 'en'): string {
  return '৳' + formatNumber(n, locale);
}

export function formatDate(iso: string, locale: 'en' | 'bn' = 'en'): string {
  try {
    const d = new Date(iso);
    const s = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return locale === 'bn' ? toBnDigits(s) : s;
  } catch {
    return iso;
  }
}

// Returns { effective, original } when a discount is set.
// `original` is undefined when the product has no discount.
export function applyDiscount(
  priceBdt: string | number,
  discountType: string | null | undefined,
  discountValue: string | null | undefined,
): { effective: number; original: number | null } {
  const original = typeof priceBdt === 'string' ? parseFloat(priceBdt) : priceBdt;
  if (!discountType || !discountValue) return { effective: original, original: null };
  const v = parseFloat(discountValue);
  if (!Number.isFinite(v) || v <= 0) return { effective: original, original: null };
  if (discountType === 'percentage') {
    return { effective: Math.max(0, original * (1 - v / 100)), original };
  }
  if (discountType === 'flat') {
    return { effective: Math.max(0, original - v), original };
  }
  return { effective: original, original: null };
}

export function formatDateTime(iso: string, locale: 'en' | 'bn' = 'en'): string {
  try {
    const d = new Date(iso);
    const s =
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ', ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return locale === 'bn' ? toBnDigits(s) : s;
  } catch {
    return iso;
  }
}
