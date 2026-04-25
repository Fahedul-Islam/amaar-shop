import { apiFetch } from './api';
import type { Order } from './storefrontApi';

export type { Order, OrderItem } from './storefrontApi';

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

export const markAdvanceReceived = (id: string) =>
  apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}/advance-received`, { method: 'POST' });
