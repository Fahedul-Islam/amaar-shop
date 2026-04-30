import { apiFetch } from './api';

export type CustomerSegment = 'vip' | 'returning' | 'new' | 'inactive';

export interface Customer {
  normalized_phone: string;
  display_phone: string;
  name: string;
  delivery_area: string;
  total_orders: number;
  total_spent_bdt: string;
  avg_order_bdt: string;
  first_order_at: string | null;
  last_order_at: string | null;
  segment: CustomerSegment;
  note: string;
  note_updated_at: string | null;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
}

export interface CustomerOrderSummary {
  order_id: string;
  total_bdt: string;
  status: string;
  items_count: number;
  created_at: string;
}

export interface CustomerAnalytics {
  total_customers: number;
  new_count: number;
  returning_count: number;
  vip_count: number;
  inactive_count: number;
  avg_lifetime_bdt: string;
  total_lifetime_bdt: string;
  repeat_purchase_rate: string;
}

export type CustomerSort = 'recent' | 'orders' | 'spent' | 'name';

export interface ListCustomerParams {
  segment?: CustomerSegment;
  search?: string;
  sort?: CustomerSort;
  limit?: number;
  offset?: number;
}

export const listCustomers = (params: ListCustomerParams = {}) => {
  const qs = new URLSearchParams();
  if (params.segment) qs.set('segment', params.segment);
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const q = qs.toString();
  return apiFetch<CustomerListResponse>(`/api/shops/me/customers${q ? `?${q}` : ''}`);
};

export const getCustomerAnalytics = () =>
  apiFetch<CustomerAnalytics>('/api/shops/me/customers/analytics');

export const getCustomer = (phone: string) =>
  apiFetch<Customer>(`/api/shops/me/customers/${encodeURIComponent(phone)}`);

export const getCustomerOrders = (phone: string) =>
  apiFetch<CustomerOrderSummary[]>(`/api/shops/me/customers/${encodeURIComponent(phone)}/orders`);

export const upsertCustomerNote = (phone: string, note: string) =>
  apiFetch<Customer>(`/api/shops/me/customers/${encodeURIComponent(phone)}/note`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
  });

export const deleteCustomerNote = (phone: string) =>
  apiFetch<void>(`/api/shops/me/customers/${encodeURIComponent(phone)}/note`, {
    method: 'DELETE',
  });

// normalizePhone collapses any phone format down to its trailing 11 digits,
// matching the backend's normalize_phone() SQL function. Used so the
// frontend can build /customers/{phone} URLs without round-tripping through
// the server.
export function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, '');
  return digits.length > 11 ? digits.slice(-11) : digits;
}

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  vip: 'VIP',
  returning: 'Returning',
  new: 'New',
  inactive: 'Inactive',
};

export const SEGMENT_DESCRIPTIONS: Record<CustomerSegment, string> = {
  vip: 'High-value customers (≥ ৳10,000 spent or 5+ orders).',
  returning: 'Customers with 2+ orders in the last 90 days.',
  new: 'First-time buyers in the last 30 days.',
  inactive: 'No orders in the last 90 days — at risk of churning.',
};
