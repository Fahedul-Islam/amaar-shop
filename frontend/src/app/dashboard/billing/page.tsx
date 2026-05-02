'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getMyBilling, submitMyPayment,
  PAYMENT_METHOD_OPTIONS, PAYMENT_METHOD_LABEL, humanLabelFeeRule,
  type ShopBillingSnapshot, type FeeStatus, type FeeSubmissionStatus, type PaymentMethod,
} from '@/lib/billingApi';
import { formatBDT, formatNumber, formatDate, formatDateTime } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiRequestError } from '@/lib/api';

const STATUS_LABEL: Record<FeeStatus, string> = {
  paid_up: 'All settled',
  due:     "There's a balance to pay",
  overdue: 'Overdue — please pay soon',
};

const STATUS_TONE: Record<FeeStatus, string> = {
  paid_up: 'bg-emerald-100 text-emerald-700',
  due:     'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
};

const SUB_STATUS_LABEL: Record<FeeSubmissionStatus, string> = {
  pending:  'Awaiting admin review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const SUB_STATUS_TONE: Record<FeeSubmissionStatus, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function SellerBillingPage() {
  const [snap, setSnap] = useState<ShopBillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return getMyBilling()
      .then(setSnap)
      .catch((e) => setError(e?.message || 'Failed to load billing info'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-[1100px]">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Billing</h1>
      <p className="text-stone-500 mt-1 mb-5">
        Track what you owe AmaarShop and submit your payment.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {loading || !snap ? (
        <Card className="p-8 text-center text-stone-500" hover={false}>Loading…</Card>
      ) : (
        <>
          {/* Headline status */}
          <Card className="p-5 mb-4" hover={false}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                  You owe right now
                </div>
                <div
                  className={`text-3xl font-bold tracking-tight mt-1 ${
                    snap.status === 'overdue' ? 'text-red-700' : 'text-stone-900'
                  }`}
                >
                  {formatBDT(snap.outstanding_fee_bdt)}
                </div>
                <div className="text-sm text-stone-500 mt-1">
                  Across <strong>{formatNumber(snap.unbilled_orders)}</strong> unbilled orders ·{' '}
                  total sales {formatBDT(snap.unbilled_gmv_bdt)}
                </div>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  STATUS_TONE[snap.status]
                }`}
              >
                {STATUS_LABEL[snap.status]}
              </span>
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100 grid sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-stone-500 text-xs">Current fee rule</div>
                <div className="font-semibold mt-0.5">{humanLabelFeeRule(snap.rule)}</div>
              </div>
              <div>
                <div className="text-stone-500 text-xs">Last paid</div>
                <div className="font-semibold mt-0.5">
                  {snap.last_paid_at ? (
                    <>
                      {formatDate(snap.last_paid_at)}
                      {typeof snap.days_since_last_paid === 'number' && (
                        <span className="text-stone-400 ml-1 font-normal">
                          ({snap.days_since_last_paid}d ago)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-stone-400 italic font-normal">No payments yet</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-stone-500 text-xs">Billing cycle</div>
                <div className="font-semibold mt-0.5">Every 14 days</div>
              </div>
            </div>
          </Card>

          {/* Plain-English explainer */}
          <div className="bg-teal-50 border border-teal-200 text-teal-900 text-sm rounded-md p-3 mb-4 leading-relaxed">
            <strong>How payment works:</strong> AmaarShop is cash-on-delivery first.
            You collect cash directly from buyers. The platform fee shown above is what
            you owe AmaarShop. Send it via bKash, Nagad, Rocket, or bank transfer to
            our company account, then submit the transaction details below — admin will
            confirm receipt and your balance updates.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <SubmitForm
              snap={snap}
              onSubmitted={refresh}
            />

            <SubmissionsHistory submissions={snap.recent_submissions} />
          </div>
        </>
      )}
    </div>
  );
}

function SubmitForm({
  snap,
  onSubmitted,
}: {
  snap: ShopBillingSnapshot;
  onSubmitted: () => void;
}) {
  const [amount, setAmount] = useState(snap.outstanding_fee_bdt);
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [txnId, setTxnId] = useState('');
  const [sender, setSender] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      await submitMyPayment({
        amount_bdt: amount,
        payment_method: method,
        transaction_id: txnId.trim(),
        sender_account: sender.trim() || undefined,
        note: note.trim() || undefined,
      });
      setSuccess(true);
      setTxnId('');
      setSender('');
      setNote('');
      onSubmitted();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Could not submit payment');
      }
    } finally {
      setBusy(false);
    }
  };

  if (snap.has_pending_submission) {
    return (
      <Card className="p-5" hover={false}>
        <h3 className="text-base font-semibold">Payment submitted</h3>
        <p className="text-sm text-stone-600 mt-2 leading-relaxed">
          You have a payment submission awaiting admin review. We'll update your balance
          as soon as it's approved. Check the timeline on the right for status.
        </p>
      </Card>
    );
  }

  const owed = parseFloat(snap.outstanding_fee_bdt);
  if (!isFinite(owed) || owed < 0.005) {
    return (
      <Card className="p-5" hover={false}>
        <h3 className="text-base font-semibold">Nothing to pay right now</h3>
        <p className="text-sm text-stone-600 mt-2 leading-relaxed">
          You're all caught up. As you take new orders, your balance will accumulate
          here for the next billing cycle.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5" hover={false}>
      <h3 className="text-base font-semibold">Submit your payment</h3>
      <p className="text-sm text-stone-500 mt-1 mb-4">
        After sending the fee, fill in the transaction details below.
      </p>
      <form onSubmit={submit} className="grid gap-3.5">
        <Input
          label="Amount you sent (BDT)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Payment method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            required
            className="w-full h-10 px-3 bg-white border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100"
          >
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <Input
          label="Transaction id"
          value={txnId}
          onChange={(e) => setTxnId(e.target.value)}
          placeholder="e.g. 8N7H4MY1Q2"
          required
        />
        <Input
          label={method === 'bank_transfer' ? 'Account / reference (optional)' : `Your ${PAYMENT_METHOD_LABEL[method]} number (optional)`}
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="01XXXXXXXXX"
        />
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything admin should know"
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100 resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
            Submitted. Admin will review shortly.
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit payment'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SubmissionsHistory({ submissions }: { submissions: ShopBillingSnapshot['recent_submissions'] }) {
  return (
    <Card className="p-5" hover={false}>
      <h3 className="text-base font-semibold mb-3">Recent submissions</h3>
      {submissions.length === 0 ? (
        <div className="text-sm text-stone-500 italic">No submissions yet.</div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{formatBDT(s.amount_bdt)}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    SUB_STATUS_TONE[s.status]
                  }`}
                >
                  {SUB_STATUS_LABEL[s.status]}
                </span>
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {PAYMENT_METHOD_LABEL[s.payment_method] || s.payment_method} · #{s.transaction_id}
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Submitted {formatDateTime(s.submitted_at)}
              </div>
              {s.admin_feedback && (
                <div className="text-xs text-stone-600 mt-2 bg-stone-50 border border-stone-100 p-2 rounded">
                  <strong>Admin:</strong> {s.admin_feedback}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
