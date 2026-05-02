import { apiFetch, apiFetchEnvelope } from './api';

// ----- Fee rule (admin) -----------------------------------------------------

export type FeeRuleType = 'percentage' | 'fixed_per_order';

export interface FeeRule {
  rule_type: FeeRuleType;
  /** Numeric string. For percentage: e.g. "5.0000". For fixed: BDT per order. */
  value: string;
  description?: string;
  updated_at: string;
  updated_by?: string | null;
}

export const FEE_RULE_TYPE_OPTIONS: { id: FeeRuleType; label: string; help: string }[] = [
  {
    id: 'percentage',
    label: 'Percentage of sales',
    help: 'Charge a % of the shop\'s total sales (most common for marketplaces).',
  },
  {
    id: 'fixed_per_order',
    label: 'Fixed amount per order',
    help: 'Charge a flat ৳ for every non-cancelled order, regardless of order value.',
  },
];

// humanLabel mirrors domain.FeeRule.HumanLabel on the backend so admins and
// sellers see the rule worded the same way in every place.
export function humanLabelFeeRule(r: FeeRule): string {
  if (r.rule_type === 'percentage') return `${stripTrailingZeros(r.value)}% of sales`;
  return `BDT ${r.value} per order`;
}

function stripTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

export const getFeeRule = () => apiFetch<FeeRule>('/api/admin/fee-rule');

export const updateFeeRule = (body: { rule_type: FeeRuleType; value: string; description?: string }) =>
  apiFetch<FeeRule>('/api/admin/fee-rule', {
    method: 'PUT',
    body: JSON.stringify(body),
  });

// ----- Fee submissions ------------------------------------------------------

export type FeeSubmissionStatus = 'pending' | 'approved' | 'rejected';
export type PaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'bank_transfer' | 'cash' | 'other';

export const PAYMENT_METHOD_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: 'bkash',         label: 'bKash' },
  { id: 'nagad',         label: 'Nagad' },
  { id: 'rocket',        label: 'Rocket' },
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'cash',          label: 'Cash' },
  { id: 'other',         label: 'Other' },
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((o) => [o.id, o.label]),
) as Record<PaymentMethod, string>;

export interface FeeSubmission {
  id: string;
  shop_id: string;
  amount_bdt: string;
  payment_method: PaymentMethod;
  transaction_id: string;
  sender_account?: string;
  note?: string;
  status: FeeSubmissionStatus;
  admin_feedback?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  fee_payment_id?: string | null;
  submitted_at: string;
}

export interface AdminFeeSubmissionRow extends FeeSubmission {
  shop_name: string;
  shop_slug: string;
}

export interface AdminSubmissionsList {
  submissions: AdminFeeSubmissionRow[];
  counts: Record<FeeSubmissionStatus, number>;
}

export const listFeeSubmissions = (params: { status?: string; page?: number; page_size?: number } = {}) => {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.page) sp.set('page', String(params.page));
  if (params.page_size) sp.set('page_size', String(params.page_size));
  const qs = sp.toString();
  return apiFetchEnvelope<{
    data: AdminSubmissionsList;
    pagination: { page: number; page_size: number; total: number };
  }>(`/api/admin/fee-submissions${qs ? '?' + qs : ''}`);
};

export const approveFeeSubmission = (id: string, admin_feedback?: string) =>
  apiFetch<AdminFeeSubmissionRow>(`/api/admin/fee-submissions/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ admin_feedback: admin_feedback || '' }),
  });

export const rejectFeeSubmission = (id: string, admin_feedback: string) =>
  apiFetch<AdminFeeSubmissionRow>(`/api/admin/fee-submissions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ admin_feedback }),
  });

// ----- Seller billing -------------------------------------------------------

export type FeeStatus = 'paid_up' | 'due' | 'overdue';

export interface ShopBillingSnapshot {
  rule: FeeRule;
  unbilled_orders: number;
  unbilled_gmv_bdt: string;
  outstanding_fee_bdt: string;
  last_paid_at?: string | null;
  days_since_last_paid?: number | null;
  status: FeeStatus;
  has_pending_submission: boolean;
  recent_submissions: FeeSubmission[];
}

export const getMyBilling = () => apiFetch<ShopBillingSnapshot>('/api/shops/me/billing');

export const submitMyPayment = (body: {
  amount_bdt: string;
  payment_method: PaymentMethod;
  transaction_id: string;
  sender_account?: string;
  note?: string;
}) =>
  apiFetch<FeeSubmission>('/api/shops/me/billing/submissions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getMySubmissions = (limit = 25) =>
  apiFetch<FeeSubmission[]>(`/api/shops/me/billing/submissions?limit=${limit}`);
