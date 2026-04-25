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
