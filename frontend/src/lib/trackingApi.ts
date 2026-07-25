import { apiFetch } from './api';

/** Secret-free view of a shop's Meta Conversions API setup. */
export interface MetaSettings {
  enabled: boolean;
  configured: boolean;
  track_delivered: boolean;
  has_test_code: boolean;
}

export interface MetaEventTypeStat {
  event_name: string;
  sent: number;
  pending: number;
  failed: number;
  value_bdt: string;
}

/** Health of the conversion data we send to Meta. */
export interface TrackingStats {
  start_date: string;
  end_date: string;
  enabled: boolean;
  configured: boolean;
  total_sent: number;
  total_pending: number;
  total_failed: number;
  avg_match_fields: number;
  match_quality_pct: number;
  reported_value_bdt: string;
  last_error?: string;
  last_sent_at?: string;
  by_event_type: MetaEventTypeStat[];
}

export interface MetaEvent {
  id: string;
  order_id?: string;
  event_name: string;
  event_id: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  last_error?: string;
  value_bdt: string;
  match_fields: number;
  sent_at?: string;
  created_at: string;
}

/** The shop's own funnel — computed from our data, never from Meta. */
export interface FunnelStats {
  start_date: string;
  end_date: string;
  product_views: number;
  unique_visitors: number;
  orders_placed: number;
  orders_delivered: number;
  view_to_order_pct: number | null;
  order_to_delivered_pct: number | null;
  view_to_delivered_pct: number | null;
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

export const getMetaSettings = () =>
  apiFetch<MetaSettings>('/api/shops/me/meta-settings');

// Blank pixel_id / access_token keep the stored values.
export const updateMetaSettings = (input: {
  pixel_id: string;
  access_token: string;
  enabled: boolean;
  track_delivered: boolean;
  test_event_code?: string;
}) =>
  apiFetch<MetaSettings>('/api/shops/me/meta-settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const getTrackingStats = (params: RangeParams = {}) =>
  apiFetch<TrackingStats>(`/api/shops/me/tracking-stats${rangeQuery(params)}`);

export const getTrackingEvents = (limit = 25) =>
  apiFetch<MetaEvent[]>(`/api/shops/me/tracking-events?limit=${limit}`);

export const getFunnelStats = (params: RangeParams = {}) =>
  apiFetch<FunnelStats>(`/api/shops/me/funnel${rangeQuery(params)}`);

/** Human label for the event names we send. */
export function eventLabel(name: string): string {
  switch (name) {
    case 'Purchase':
      return 'Order placed';
    case 'OrderDelivered':
      return 'Delivered';
    default:
      return name;
  }
}
