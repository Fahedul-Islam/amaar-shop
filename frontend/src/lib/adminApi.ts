import { apiFetch, apiFetchEnvelope } from './api';

export interface PlatformStats {
  total_shops: number;
  active_shops: number;
  suspended_shops: number;
  total_users: number;
  total_products: number;
  total_orders: number;
  orders_today: number;
  gmv_all_time: string;
  gmv_30d: string;
  new_shops_7d: number;
  pending_orders: number;
}

export interface AdminShopRow {
  id: string;
  owner_user_id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  contact_phone: string;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
  owner_email: string;
  product_count: number;
  order_count: number;
  revenue_bdt: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  is_admin: boolean;
  is_owner: boolean;
  shop_name?: string;
  shop_slug?: string;
  order_count: number;
  spent_bdt: string;
  created_at: string;
}

export interface AdminOrderRow {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  customer_name: string;
  customer_phone: string;
  delivery_area: string;
  total_bdt: string;
  status: string;
  created_at: string;
}

export interface AdminProductRow {
  id: string;
  name: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  price_bdt: string;
  stock: number;
  is_active: boolean;
  is_archived: boolean;
  image_url: string;
  created_at: string;
}

export interface AdminOverview {
  stats: PlatformStats;
  recent_shops: AdminShopRow[];
  top_shops: AdminShopRow[];
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

export interface PageEnvelope<T> {
  data: T[];
  pagination: Pagination;
}

interface ListParams {
  page?: number;
  page_size?: number;
  status?: string;
  role?: string;
  q?: string;
}

function qs(params: ListParams): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.page_size) sp.set('page_size', String(params.page_size));
  if (params.status) sp.set('status', params.status);
  if (params.role) sp.set('role', params.role);
  if (params.q) sp.set('q', params.q);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const getOverview = () => apiFetch<AdminOverview>('/api/admin/overview');

export const getStats = () => apiFetch<PlatformStats>('/api/admin/stats');

export const listShops = (p: ListParams = {}) =>
  apiFetchEnvelope<PageEnvelope<AdminShopRow>>(`/api/admin/shops${qs(p)}`);

export const getShop = (id: string) =>
  apiFetch<AdminShopRow>(`/api/admin/shops/${id}`);

export const setShopSuspended = (id: string, is_suspended: boolean) =>
  apiFetch<AdminShopRow>(`/api/admin/shops/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_suspended }),
  });

export const listUsers = (p: ListParams = {}) =>
  apiFetchEnvelope<PageEnvelope<AdminUserRow>>(`/api/admin/users${qs(p)}`);

export const listOrders = (p: ListParams = {}) =>
  apiFetchEnvelope<PageEnvelope<AdminOrderRow>>(`/api/admin/orders${qs(p)}`);

export const listProducts = (p: ListParams = {}) =>
  apiFetchEnvelope<PageEnvelope<AdminProductRow>>(`/api/admin/products${qs(p)}`);

export const setProductActive = (id: string, is_active: boolean) =>
  apiFetch<{ id: string; is_active: boolean }>(`/api/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });

// ----- Insights (Analytics) -------------------------------------------------

export interface PeriodMetric {
  current: string;
  previous: string;
  change_pct: number | null;
}

export interface DailyPoint {
  date: string;
  value: string;
}

export interface CategoryBreakdown {
  name: string;
  gmv_bdt: string;
  percentage: number;
}

export interface TopProductRow {
  id: string;
  name: string;
  shop_name: string;
  units_sold: number;
  gmv_bdt: string;
  image_url: string;
}

export interface GeoBreakdown {
  area: string;
  orders: number;
  percentage: number;
}

export interface AnalyticsReport {
  days: number;
  gmv_bdt: PeriodMetric;
  orders: PeriodMetric;
  new_customers: PeriodMetric;
  new_shops: PeriodMetric;
  avg_order_value_bdt: PeriodMetric;
  orders_daily: DailyPoint[];
  new_customers_daily: DailyPoint[];
  top_categories: CategoryBreakdown[];
  top_products: TopProductRow[];
  geographic: GeoBreakdown[];
}

export const getAnalytics = (days = 30) =>
  apiFetch<AnalyticsReport>(`/api/admin/analytics?days=${days}`);

// ----- Money & payouts (Financial) ------------------------------------------

export interface RevenueSplit {
  to_shops_bdt: string;
  platform_fee_bdt: string;
  to_shops_pct: number;
  platform_fee_pct: number;
}

export interface ShopPayout {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  orders: number;
  gross_bdt: string;
  fee_bdt: string;
  net_bdt: string;
}

export interface FinancialReport {
  days: number;
  gmv_bdt: PeriodMetric;
  platform_fee_bdt: PeriodMetric;
  pending_payouts_bdt: string;
  pending_payout_count: number;
  refunds_bdt: PeriodMetric;
  gmv_daily: DailyPoint[];
  revenue_split: RevenueSplit;
  upcoming_payouts: ShopPayout[];
}

export const getFinancial = (days = 30) =>
  apiFetch<FinancialReport>(`/api/admin/financial?days=${days}`);

// ----- Admin team (Roles & access) ------------------------------------------

export interface AdminTeamMember {
  id: string;
  email: string;
  role: string;
  is_super_admin: boolean;
  created_at: string;
}

export const listAdmins = () => apiFetch<AdminTeamMember[]>('/api/admin/admins');

export const setUserAdmin = (userId: string, is_admin: boolean) =>
  apiFetch<{ id: string; is_admin: boolean }>(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ is_admin }),
  });
