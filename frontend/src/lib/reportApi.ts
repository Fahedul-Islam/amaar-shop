import { publicFetch } from './api';

// Reasons mirror the domain.ValidReportReasons allow-list on the backend.
// `id` is what we send to the API; `label` is what the customer sees.
export const REPORT_REASONS: { id: string; label: string }[] = [
  { id: 'counterfeit',   label: 'Selling fake/counterfeit goods' },
  { id: 'scam',          label: 'Scam — never delivered or stole money' },
  { id: 'inappropriate', label: 'Inappropriate or offensive content' },
  { id: 'poor_quality',  label: 'Very poor product quality' },
  { id: 'harassment',    label: 'The shop owner harassed me' },
  { id: 'other',         label: 'Something else' },
];

export interface SubmitReportRequest {
  reason: string;
  description: string;
  reporter_name?: string;
  reporter_phone?: string;
}

export interface SubmitReportResponse {
  id: string;
  status: string;
  created_at: string;
}

// submitShopReport sends a customer-facing complaint about a shop.
// No auth required — anonymous reports are allowed.
export const submitShopReport = (slug: string, body: SubmitReportRequest) =>
  publicFetch<SubmitReportResponse>(`/api/shops/by-slug/${encodeURIComponent(slug)}/report`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
