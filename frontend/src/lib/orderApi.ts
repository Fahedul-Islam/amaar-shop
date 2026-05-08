import { apiFetch } from './api';
import type { Order } from './storefrontApi';

export type { Order, OrderItem } from './storefrontApi';

// prettyOrderStatus turns the raw enum into seller-friendly copy. "Pending"
// alone is ambiguous — sellers wonder whose move is next. The mapping makes
// the next action explicit and is reused everywhere status is rendered.
export function prettyOrderStatus(s: string): string {
  switch (s) {
    case 'pending': return 'Awaiting confirmation';
    case 'confirmed': return 'Confirmed';
    case 'shipped': return 'With courier';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default: return s;
  }
}

export interface OrderListParams {
  page?: number;
  page_size?: number;
  status?: string;
  phone?: string;
}

export function listOrders(params: OrderListParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  if (params.status) qs.set('status', params.status);
  if (params.phone) qs.set('phone', params.phone);
  const q = qs.toString();
  return apiFetch<Order[]>(`/api/shops/me/orders${q ? `?${q}` : ''}`);
}

export const getOrder = (id: string) =>
  apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}`);

export const updateOrderStatus = (id: string, status: string, cancellation_reason?: string) =>
  apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, cancellation_reason }),
  });

export const markAdvanceReceived = (id: string, received = true) =>
  apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}/advance-received`, {
    method: 'POST',
    body: JSON.stringify({ received }),
  });
