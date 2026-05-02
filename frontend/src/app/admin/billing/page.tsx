'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  listFeeSubmissions, approveFeeSubmission, rejectFeeSubmission,
  PAYMENT_METHOD_LABEL,
  type AdminFeeSubmissionRow, type FeeSubmissionStatus,
} from '@/lib/billingApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, ShopMark, Tab,
  Pagination, Spinner, EmptyState,
} from '../ui';
import { Button } from '@/components/ui/Button';
import { IcX } from '@/components/icons/Icons';

const PAGE_SIZE = 25;

const TABS: { id: 'all' | FeeSubmissionStatus; label: string; api: string }[] = [
  { id: 'all',      label: 'All',          api: '' },
  { id: 'pending',  label: 'Awaiting review', api: 'pending' },
  { id: 'approved', label: 'Approved',     api: 'approved' },
  { id: 'rejected', label: 'Rejected',     api: 'rejected' },
];

const STATUS_TONE: Record<FeeSubmissionStatus, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<FeeSubmissionStatus, string> = {
  pending:  'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function AdminFeeSubmissionsPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('pending');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminFeeSubmissionRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    pending: 0, approved: 0, rejected: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AdminFeeSubmissionRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = TABS.find((x) => x.id === tab)!;
      const res = await listFeeSubmissions({ status: t.api, page, page_size: PAGE_SIZE });
      setRows(res.data.submissions);
      setCounts(res.data.counts);
      setTotal(res.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fee submissions');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <>
      <PageHeader title="Fee submissions" crumbs={['Home', 'Reports', 'Fee submissions']} />
      <PageBody>
        <div className="bg-teal-50 border border-teal-200 text-teal-900 text-sm rounded-md p-3 mb-4 leading-relaxed">
          When a shop owner sends their platform fee (via bKash/Nagad/bank), they submit
          the transaction details here. Review each one — approve to mark the fee as
          received, or reject with feedback if something looks wrong.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <SectionCard padBody={false}>
          <div className="flex items-center border-b border-stone-200 px-4 pt-1 flex-wrap">
            {TABS.map((t) => (
              <Tab
                key={t.id}
                label={t.label}
                badge={t.id === 'all'
                  ? counts.pending + counts.approved + counts.rejected
                  : counts[t.id] ?? 0}
                active={tab === t.id}
                onClick={() => { setTab(t.id); setPage(1); }}
              />
            ))}
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState message="No submissions in this view." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Method</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Transaction id</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Amount</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer"
                      onClick={() => setActive(s)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <ShopMark name={s.shop_name} size={28} />
                          <span className="font-medium text-stone-900">{s.shop_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{PAYMENT_METHOD_LABEL[s.payment_method] || s.payment_method}</td>
                      <td className="px-4 py-3 font-mono text-xs">{s.transaction_id}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">
                        {formatBDT(s.amount_bdt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_TONE[s.status]
                          }`}
                        >
                          {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {formatDateTime(s.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </SectionCard>

        {active && (
          <SubmissionDrawer
            sub={active}
            onClose={() => setActive(null)}
            onChanged={async () => {
              await refresh();
              setActive(null);
            }}
          />
        )}
      </PageBody>
    </>
  );
}

function SubmissionDrawer({
  sub,
  onClose,
  onChanged,
}: {
  sub: AdminFeeSubmissionRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [feedback, setFeedback] = useState(sub.admin_feedback || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    if (!confirm('Mark this submission as received? This will settle the shop\'s outstanding fee balance.')) return;
    setBusy('approve');
    setError(null);
    try {
      await approveFeeSubmission(sub.id, feedback.trim() || undefined);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!feedback.trim()) {
      setError('Please add feedback so the seller knows what to fix.');
      return;
    }
    setBusy('reject');
    setError(null);
    try {
      await rejectFeeSubmission(sub.id, feedback.trim());
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
      setBusy(null);
    }
  };

  const isPending = sub.status === 'pending';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 py-4 border-b border-stone-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold flex-1">Submission details</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <IcX size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <ShopMark name={sub.shop_name} size={40} />
            <div>
              <div className="font-semibold text-stone-900">{sub.shop_name}</div>
              <a
                href={`/s/${sub.shop_slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-600 hover:underline"
              >
                amaarshop.com/s/{sub.shop_slug}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount claimed">{formatBDT(sub.amount_bdt)}</Field>
            <Field label="Payment method">{PAYMENT_METHOD_LABEL[sub.payment_method] || sub.payment_method}</Field>
            <Field label="Transaction id" mono>{sub.transaction_id}</Field>
            <Field label="Sender account" mono>{sub.sender_account || '—'}</Field>
          </div>

          {sub.note && (
            <Field label="Seller's note">
              <p className="bg-stone-50 border border-stone-100 p-3 rounded-md text-sm leading-relaxed">
                {sub.note}
              </p>
            </Field>
          )}

          <Field label="Status">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                STATUS_TONE[sub.status]
              }`}
            >
              {STATUS_LABEL[sub.status]}
            </span>
            {sub.reviewed_at && (
              <div className="text-xs text-stone-500 mt-1">
                Reviewed {formatDateTime(sub.reviewed_at)}
              </div>
            )}
          </Field>

          {!isPending && sub.admin_feedback && (
            <Field label="Your feedback">
              <p className="bg-stone-50 border border-stone-100 p-3 rounded-md text-sm leading-relaxed">
                {sub.admin_feedback}
              </p>
            </Field>
          )}

          {isPending && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Feedback (optional for approval, required to reject)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="e.g. Confirmed in our bKash account on May 1"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100 resize-none"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
              {error}
            </div>
          )}
        </div>

        {isPending && (
          <div className="border-t border-stone-200 sticky bottom-0 bg-white">
            <div className="px-5 py-3 grid grid-cols-2 gap-2">
              <Button variant="danger" disabled={!!busy} onClick={reject}>
                {busy === 'reject' ? 'Saving…' : 'Reject'}
              </Button>
              <Button variant="primary" disabled={!!busy} onClick={approve}>
                {busy === 'approve' ? 'Saving…' : 'Mark as received'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
        {label}
      </div>
      <div className={`text-sm text-stone-900 ${mono ? 'font-mono' : ''}`}>{children}</div>
    </div>
  );
}
