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
    case 'returned': return 'Returned';
    case 'cancelled': return 'Cancelled';
    default: return s;
  }
}

// COURIERS is the list of couriers a Bangladeshi seller commonly hands parcels
// to. `track` builds the public tracking URL from a consignment/tracking ID
// where the courier exposes one; an empty string means no public lookup page.
export interface Courier {
  value: string;
  label: string;
  track: (trackingId: string) => string;
}

export const COURIERS: Courier[] = [
  { value: 'steadfast', label: 'Steadfast', track: (t) => `https://steadfast.com.bd/t/${encodeURIComponent(t)}` },
  { value: 'pathao', label: 'Pathao', track: () => 'https://merchant.pathao.com/tracking' },
  { value: 'redx', label: 'RedX', track: (t) => `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(t)}` },
  { value: 'paperfly', label: 'Paperfly', track: () => 'https://go.paperfly.com.bd/track' },
  { value: 'sundarban', label: 'Sundarban Courier', track: () => 'https://sundarbancourierltd.com' },
  { value: 'ecourier', label: 'eCourier', track: (t) => `https://track.ecourier.com.bd/?trackingId=${encodeURIComponent(t)}` },
  { value: 'self', label: 'Self / own delivery', track: () => '' },
  { value: 'other', label: 'Other courier', track: () => '' },
];

// courierLabel resolves a stored courier value (or free-text) to a display name.
export function courierLabel(value?: string): string {
  if (!value) return '';
  const found = COURIERS.find((c) => c.value === value);
  return found ? found.label : value;
}

// courierTrackingUrl returns the public tracking URL for a courier + tracking
// ID, or '' when the courier has no public lookup page or no ID was recorded.
export function courierTrackingUrl(courier?: string, trackingId?: string): string {
  if (!courier || !trackingId) return '';
  const found = COURIERS.find((c) => c.value === courier);
  return found ? found.track(trackingId) : '';
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

// shipOrder records courier + tracking on an order. From a confirmed order the
// backend advances it to "shipped"; on an already-shipped order it just edits
// the tracking details.
export const shipOrder = (id: string, courier_name: string, tracking_id: string) =>
  apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}/ship`, {
    method: 'POST',
    body: JSON.stringify({ courier_name, tracking_id }),
  });

export const markAdvanceReceived = (id: string, received = true) =>
  apiFetch<Order>(`/api/shops/me/orders/${encodeURIComponent(id)}/advance-received`, {
    method: 'POST',
    body: JSON.stringify({ received }),
  });
