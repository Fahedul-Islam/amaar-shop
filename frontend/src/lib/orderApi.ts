import { apiFetch } from './api';
import type { Order } from './storefrontApi';

export type { Order } from './storefrontApi';
export type { OrderItem } from './storefrontApi';

// --- Seller endpoints (authenticated) ---

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
  const query = qs.toString();
  const path = `/api/shops/me/orders${query ? `?${query}` : ''}`;
  return apiFetch<Order[]>(path);
}

export function getOrder(id: string) {
  return apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}`);
}

export function updateOrderStatus(id: string, status: string, cancellation_reason?: string) {
  return apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, cancellation_reason }),
  });
}

export function markAdvanceReceived(id: string) {
  return apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}/advance-received`, {
    method: 'POST',
  });
}
