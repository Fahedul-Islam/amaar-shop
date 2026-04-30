import { apiFetch, publicFetch, ApiRequestError } from './api';

export interface TodayStats {
  total_orders: number;
  pending_orders: number;
  revenue_bdt: string;
  date: string;
}

export interface DayStat {
  date: string;
  orders: number;
  revenue_bdt: string;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue_bdt: string;
}

export const getTodayStats = () => apiFetch<TodayStats>('/api/shops/me/stats/today');

export const getRangeStats = (from: string, to: string) =>
  apiFetch<DayStat[]>(`/api/shops/me/stats/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

export interface PeriodSummary {
  start_date: string;
  end_date: string;
  revenue_bdt: string;
  orders: number;
  aov_bdt: string;
  total_visits: number;
  unique_visits: number;
  order_rate: number;
}

export interface SummaryChanges {
  revenue_pct: number | null;
  orders_pct: number | null;
  aov_pct: number | null;
  total_visits_pct: number | null;
  unique_visits_pct: number | null;
  order_rate_pct: number | null;
}

export interface StatsSummary {
  current: PeriodSummary;
  previous?: PeriodSummary;
  changes?: SummaryChanges;
}

export const getStatsSummary = (
  startDate: string,
  endDate: string,
  compareStartDate?: string,
  compareEndDate?: string,
) => {
  const qs = new URLSearchParams({ startDate, endDate });
  if (compareStartDate && compareEndDate) {
    qs.set('compareStartDate', compareStartDate);
    qs.set('compareEndDate', compareEndDate);
  }
  return apiFetch<StatsSummary>(`/api/shops/me/stats/summary?${qs.toString()}`);
};

export const getTopProducts = () => apiFetch<TopProduct[]>('/api/shops/me/stats/top-products');

export interface PopularProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
}

export async function getPopularProducts(slug: string): Promise<PopularProduct[]> {
  try {
    return await publicFetch<PopularProduct[]>(
      `/api/shops/by-slug/${encodeURIComponent(slug)}/popular-products`,
    );
  } catch (err) {
    if (err instanceof ApiRequestError) return [];
    throw err;
  }
}

// --- Visit analytics ---

export type VisitPeriod = 'daily' | 'weekly' | 'monthly';

export interface VisitBucket {
  bucket: string;
  total_visits: number;
  unique_visits: number;
}

export interface VisitSummary {
  period: VisitPeriod;
  from: string;
  to: string;
  buckets: VisitBucket[];
}

export interface TopVisitedProduct {
  product_id: string;
  product_name: string;
  total_visits: number;
  unique_visits: number;
}

export interface VisitConversion {
  unique_visits: number;
  total_visits: number;
  order_count: number;
  order_rate: number;
}

export const getVisitSummary = (period: VisitPeriod = 'daily', days?: number) => {
  const qs = new URLSearchParams({ period });
  if (days) qs.set('days', String(days));
  return apiFetch<VisitSummary>(`/api/shops/me/visits/summary?${qs.toString()}`);
};

export const getTopVisitedProducts = () =>
  apiFetch<TopVisitedProduct[]>('/api/shops/me/visits/top-products');

export const getVisitConversion = (days = 30) =>
  apiFetch<VisitConversion>(`/api/shops/me/visits/conversion?days=${days}`);

// trackProductView fires a fire-and-forget visit event. Failures are
// intentionally swallowed: missing a beacon must never disrupt the page.
export async function trackProductView(shopSlug: string, productId: string): Promise<void> {
  try {
    await fetch('/api/track/product-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_slug: shopSlug, product_id: productId }),
      keepalive: true,
    });
  } catch {
    // ignore — best-effort beacon
  }
}
