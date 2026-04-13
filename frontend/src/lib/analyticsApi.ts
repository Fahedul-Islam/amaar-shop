import { apiFetch } from './api';

// --- Seller analytics (authenticated) ---

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

export function getTodayStats() {
  return apiFetch<TodayStats>('/api/shops/me/stats/today');
}

export function getRangeStats(from: string, to: string) {
  return apiFetch<DayStat[]>(`/api/shops/me/stats/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export function getTopProducts() {
  return apiFetch<TopProduct[]>('/api/shops/me/stats/top-products');
}

// --- Public storefront analytics (no auth) ---

export interface PopularProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
}

export async function getPopularProducts(slug: string): Promise<PopularProduct[]> {
  const res = await fetch(`/api/shops/by-slug/${encodeURIComponent(slug)}/popular-products`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.data ?? []) as PopularProduct[];
}
