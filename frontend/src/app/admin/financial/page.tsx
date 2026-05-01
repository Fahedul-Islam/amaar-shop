'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getFinancial, recordFeePayment,
  type FinancialReport, type PeriodMetric,
  type ShopFeeStatus, type FeeStatus,
} from '@/lib/adminApi';
import { formatBDT, formatNumber, formatShortDate, formatDate } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, ShopMark, Spinner, EmptyState,
} from '../ui';
import { LineChart } from '@/components/ui/LineChart';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IcX } from '@/components/icons/Icons';

const RANGES = [
  { id: 7,   label: 'Last 7 days' },
  { id: 30,  label: 'Last 30 days' },
  { id: 90,  label: 'Last 90 days' },
  { id: 365, label: 'Last year' },
];

// formatChange renders "↑ 14.2%" / "↓ 3.1%" / "—" for a PeriodMetric.
function formatChange(m: PeriodMetric): { text: string; up: boolean | null } {
  if (m.change_pct === null || m.change_pct === undefined) return { text: '—', up: null };
  const up = m.change_pct >= 0;
  return { text: `${up ? '↑' : '↓'} ${Math.abs(m.change_pct).toFixed(1)}%`, up };
}

function MoneyTile({
  label, metric, hint, accent,
}: {
  label: string;
  metric: PeriodMetric;
  hint?: string;
  accent?: string;
}) {
  const change = formatChange(metric);
  const changeColor =
    change.up === null ? 'text-stone-500' : change.up ? 'text-emerald-700' : 'text-red-600';
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 relative overflow-hidden">
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      )}
      <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
        {formatBDT(metric.current)}
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs">
        <span className={`font-medium ${changeColor}`}>{change.text}</span>
        <span className="text-stone-500">{hint || 'vs previous period'}</span>
      </div>
    </div>
  );
}

function PlainTile({
  label, value, sub, accent, valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 relative overflow-hidden">
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      )}
      <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-2xl font-bold tracking-tight mt-1 ${valueClass || 'text-stone-900'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}
    </div>
  );
}

const STATUS_LABEL: Record<FeeStatus, string> = {
  paid_up: 'All settled',
  due:     'Owes money',
  overdue: 'Overdue',
};

const STATUS_TONE: Record<FeeStatus, string> = {
  paid_up: 'bg-emerald-100 text-emerald-700',
  due:     'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function AdminFinancialPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FinancialReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordingFor, setRecordingFor] = useState<ShopFeeStatus | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return getFinancial(days)
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load financial report'))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <>
      <PageHeader
        title="Money & payouts"
        crumbs={['Home', 'Money']}
        actions={
          <div className="inline-flex bg-stone-100 rounded-md p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setDays(r.id)}
                className={`px-3 h-7 text-xs font-medium rounded ${
                  days === r.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {/* Plain-English explainer so admins remember how the money flow works */}
        <div className="bg-teal-50 border border-teal-200 text-teal-900 text-sm rounded-md p-3 mb-4 leading-relaxed">
          <strong>How money flows:</strong> Buyers pay shops directly in cash on delivery.
          AmaarShop earns a 5% platform fee — shop owners send this to us every 14 days
          via bKash, bank transfer, or cash. Use this page to see what each shop owes
          and record payments as they come in.
        </div>

        {loading || !data ? (
          <Spinner />
        ) : (
          <>
            {/* Headline tiles — what shops owe vs what was collected */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <PlainTile
                label="Shops owe right now"
                value={formatBDT(data.outstanding_fees_bdt)}
                sub={`${formatNumber(data.shops_with_outstanding_fees)} shop${data.shops_with_outstanding_fees === 1 ? '' : 's'} · ${formatNumber(data.shops_overdue)} overdue`}
                accent={data.shops_overdue > 0 ? '#DC2626' : '#F59E0B'}
                valueClass={data.shops_overdue > 0 ? 'text-red-700' : 'text-stone-900'}
              />
              <MoneyTile
                label="Fees we collected"
                metric={data.fees_collected_bdt}
                hint="payments recorded in this window"
                accent="#0D9488"
              />
              <MoneyTile
                label="Total sales by shops"
                metric={data.gmv_bdt}
                hint="cash collected by shops"
              />
              <MoneyTile
                label="Fees earned (theoretical)"
                metric={data.platform_fee_bdt}
                hint="5% of total sales"
              />
            </div>

            {/* Sales chart */}
            <SectionCard title="Marketplace sales per day" padBody={true}>
              {data.gmv_daily.length === 0 ? (
                <EmptyState message="No sales yet." />
              ) : (
                <LineChart
                  data={data.gmv_daily.map((p) => ({ x: p.date, y: Number(p.value) }))}
                  formatY={(n) => formatBDT(Math.round(n))}
                  formatX={(s) => formatShortDate(s)}
                  height={220}
                />
              )}
            </SectionCard>

            <div className="h-4" />

            {/* Per-shop fee table */}
            <SectionCard title="What each shop owes" padBody={false}>
              {data.shop_fees.length === 0 ? (
                <EmptyState message="No shops yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 text-left">
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Unbilled orders</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Sales since last paid</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Owes (5%)</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Last paid</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.shop_fees.map((s) => (
                        <tr key={s.shop_id} className="border-t border-stone-100 hover:bg-stone-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <ShopMark name={s.shop_name} size={28} />
                              <span className="font-medium text-stone-900">{s.shop_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatNumber(s.unbilled_orders)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatBDT(s.unbilled_gmv_bdt)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold">
                            {Number(s.outstanding_fee_bdt) > 0 ? (
                              <span className={s.status === 'overdue' ? 'text-red-700' : 'text-stone-900'}>
                                {formatBDT(s.outstanding_fee_bdt)}
                              </span>
                            ) : (
                              <span className="text-stone-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-500">
                            {s.last_paid_at ? (
                              <>
                                {formatDate(s.last_paid_at)}
                                {typeof s.days_since_last_paid === 'number' && (
                                  <span className="text-stone-400 ml-1">
                                    ({s.days_since_last_paid}d ago)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-stone-400 italic">Never</span>
                            )}
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
                          <td className="px-4 py-3 text-right">
                            {Number(s.outstanding_fee_bdt) > 0 ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => setRecordingFor(s)}
                              >
                                Mark fee paid
                              </Button>
                            ) : (
                              <span className="text-xs text-stone-400">All settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}

        {recordingFor && (
          <RecordPaymentModal
            shop={recordingFor}
            onClose={() => setRecordingFor(null)}
            onRecorded={async () => {
              setRecordingFor(null);
              await refresh();
            }}
          />
        )}
      </PageBody>
    </>
  );
}

// RecordPaymentModal records a fee payment from a shop owner.
function RecordPaymentModal({
  shop,
  onClose,
  onRecorded,
}: {
  shop: ShopFeeStatus;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState(shop.outstanding_fee_bdt);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const amt = parseFloat(amount);
      if (!isFinite(amt) || amt <= 0) {
        setError('Amount must be greater than zero.');
        setBusy(false);
        return;
      }
      await recordFeePayment(shop.shop_id, {
        amount_bdt: amt.toFixed(2),
        note: note.trim() || undefined,
      });
      onRecorded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold flex-1">Record fee payment</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <IcX size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 grid gap-4">
          <div className="flex items-center gap-3">
            <ShopMark name={shop.shop_name} size={36} />
            <div>
              <div className="font-medium text-stone-900">{shop.shop_name}</div>
              <div className="text-xs text-stone-500">
                Owes {formatBDT(shop.outstanding_fee_bdt)} · {formatNumber(shop.unbilled_orders)} unbilled orders
              </div>
            </div>
          </div>

          <Input
            type="text"
            inputMode="decimal"
            label="Amount received (BDT)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Paid via bKash on May 1"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100 resize-none"
            />
          </div>

          <div className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-md p-2.5 leading-relaxed">
            This marks all current unbilled orders as settled. Any new orders going forward
            will start a fresh balance for this shop.
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="neutral" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Recording…' : 'Record payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
