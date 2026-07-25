import { apiFetch } from './api';

export const AD_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google' },
  { value: 'other', label: 'Other' },
] as const;

export function platformLabel(value: string): string {
  return AD_PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

export interface AdSpend {
  id: string;
  shop_id: string;
  spend_date: string; // YYYY-MM-DD
  platform: string;
  amount_bdt: string;
  note?: string;
  /** True when auto-filled from a daily budget rather than confirmed by the seller. */
  is_estimated: boolean;
  updated_at: string;
}

/** A recurring daily spend the platform fills in automatically. */
export interface AdBudget {
  shop_id: string;
  platform: string;
  daily_amount_bdt: string;
  is_active: boolean;
  starts_on: string;
  updated_at: string;
}

export interface PlatformSpend {
  platform: string;
  amount_bdt: string;
}

// ProfitSummary mirrors the backend's unit-economics report. Ratio fields are
// null when their denominator is zero — render a dash, never a zero.
export interface ProfitSummary {
  start_date: string;
  end_date: string;

  total_orders: number;
  delivered_orders: number;
  returned_orders: number;
  in_flight_orders: number;

  delivered_revenue_bdt: string;
  booked_revenue_bdt: string;
  cogs_bdt: string;
  gross_profit_bdt: string;
  ad_spend_bdt: string;
  net_profit_bdt: string;

  gross_margin_pct: number | null;
  roas: number | null;
  break_even_roas: number | null;
  cost_per_order_bdt: string | null;
  cac_delivered_bdt: string | null;
  delivery_success_pct: number | null;
  aov_bdt: string | null;
  profit_per_order_bdt: string | null;

  items_missing_cost: number;
  /** Portion of ad_spend_bdt that came from a budget estimate. */
  estimated_spend_bdt: string;
  spend_by_platform: PlatformSpend[];
}

export interface ProductProfit {
  product_id: string;
  product_name: string;
  units_delivered: number;
  revenue_bdt: string;
  cogs_bdt: string;
  profit_bdt: string;
  margin_pct: number | null;
  has_cost: boolean;
}

interface RangeParams {
  from?: string;
  to?: string;
}

function rangeQuery(params: RangeParams = {}): string {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const getProfitSummary = (params: RangeParams = {}) =>
  apiFetch<ProfitSummary>(`/api/shops/me/profit-summary${rangeQuery(params)}`);

export const getProductProfit = (params: RangeParams = {}) =>
  apiFetch<ProductProfit[]>(`/api/shops/me/product-profit${rangeQuery(params)}`);

export const listAdSpend = (params: RangeParams = {}) =>
  apiFetch<AdSpend[]>(`/api/shops/me/ad-spend${rangeQuery(params)}`);

// recordAdSpend upserts: posting the same date+platform replaces that entry
// rather than adding a duplicate.
export const recordAdSpend = (input: {
  spend_date: string;
  platform: string;
  amount_bdt: string;
  note?: string;
}) =>
  apiFetch<AdSpend>('/api/shops/me/ad-spend', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const listAdBudgets = () =>
  apiFetch<AdBudget[]>('/api/shops/me/ad-budgets');

// setAdBudget saves a recurring daily spend and immediately fills the spend
// rows for it, so the profit report updates without waiting for the nightly job.
export const setAdBudget = (input: {
  platform: string;
  daily_amount_bdt: string;
  is_active: boolean;
}) =>
  apiFetch<AdBudget>('/api/shops/me/ad-budgets', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const deleteAdSpend = (id: string) =>
  apiFetch<{ message: string }>(`/api/shops/me/ad-spend/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
