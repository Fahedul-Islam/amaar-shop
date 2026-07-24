import { apiFetch } from './api';

// CourierSettings is the secret-free view of a shop's courier config. The API
// never returns the stored keys — only whether they're present (`configured`).
export interface CourierSettings {
  provider: string;
  enabled: boolean;
  configured: boolean;
}

export const getCourierSettings = () =>
  apiFetch<CourierSettings>('/api/shops/me/courier-settings');

// updateCourierSettings upserts credentials. Blank keys keep the stored values,
// so the seller can toggle `enabled` without re-typing both secrets.
export const updateCourierSettings = (input: {
  api_key: string;
  secret_key: string;
  enabled: boolean;
}) =>
  apiFetch<CourierSettings>('/api/shops/me/courier-settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export interface BookCourierResult {
  order_id: string;
  status: string;
  courier_name: string;
  tracking_id: string;
}

// bookCourier auto-creates the Steadfast consignment for a confirmed order and
// marks it shipped with the returned tracking code.
export const bookCourier = (orderId: string) =>
  apiFetch<BookCourierResult>(
    `/api/shops/me/orders/${encodeURIComponent(orderId)}/book-courier`,
    { method: 'POST' },
  );
