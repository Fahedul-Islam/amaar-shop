'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { IcChart, IcTrash, IcCheck } from '@/components/icons/Icons';
import {
  AD_PLATFORMS,
  platformLabel,
  getProfitSummary,
  getProductProfit,
  listAdSpend,
  recordAdSpend,
  deleteAdSpend,
  listAdBudgets,
  setAdBudget,
  type AdBudget,
} from '@/lib/marketingApi';
import {
  getTrackingStats,
  getFunnelStats,
  eventLabel,
  type TrackingStats,
  type FunnelStats,
} from '@/lib/trackingApi';
import { formatBDT } from '@/lib/format';
import { getPresetRange, type DateRange } from '@/lib/dateRange';
import { useI18n } from '@/hooks/useI18n';
import { ApiRequestError } from '@/lib/api';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MarketingPage() {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [range, setRange] = useState<DateRange>(() => getPresetRange('last30'));

  const params = { from: range.startDate, to: range.endDate };

  const profitQ = useQuery({
    queryKey: ['profit-summary', params.from, params.to],
    queryFn: () => getProfitSummary(params),
  });
  const productQ = useQuery({
    queryKey: ['product-profit', params.from, params.to],
    queryFn: () => getProductProfit(params),
  });
  const spendQ = useQuery({
    queryKey: ['ad-spend', params.from, params.to],
    queryFn: () => listAdSpend(params),
  });
  const budgetQ = useQuery({
    queryKey: ['ad-budgets'],
    queryFn: listAdBudgets,
  });
  const trackingQ = useQuery({
    queryKey: ['tracking-stats', params.from, params.to],
    queryFn: () => getTrackingStats(params),
  });
  const funnelQ = useQuery({
    queryKey: ['funnel-stats', params.from, params.to],
    queryFn: () => getFunnelStats(params),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['profit-summary'] });
    qc.invalidateQueries({ queryKey: ['ad-spend'] });
    qc.invalidateQueries({ queryKey: ['ad-budgets'] });
  };

  const s = profitQ.data;
  const net = s ? parseFloat(s.net_profit_bdt) : 0;
  const profitable = net >= 0;

  // Is the campaign clearing the bar it has to clear?
  const roasVerdict = (() => {
    if (!s || s.roas == null || s.break_even_roas == null) return null;
    return s.roas >= s.break_even_roas;
  })();

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-6xl">
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">
            Profit &amp; Ads
          </h1>
          <p className="text-stone-500 mt-1">
            What you actually earned after product cost and ad spend.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Headline verdict */}
      <Card
        className={`p-5 md:p-6 mb-5 ${
          profitable
            ? 'bg-gradient-to-br from-teal-50 to-white border-teal-200'
            : 'bg-gradient-to-br from-red-50 to-white border-red-200'
        }`}
        hover={false}
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1">
              Net profit
            </div>
            <div
              className={`text-[34px] leading-none font-bold tracking-tight ${
                profitable ? 'text-teal-800' : 'text-red-700'
              }`}
            >
              {s ? formatBDT(s.net_profit_bdt, locale) : '—'}
            </div>
            <div className="text-xs text-stone-500 mt-1.5">
              {s
                ? `${formatBDT(s.delivered_revenue_bdt, locale)} delivered − ${formatBDT(s.cogs_bdt, locale)} cost − ${formatBDT(s.ad_spend_bdt, locale)} ads`
                : ''}
            </div>
          </div>

          {s && s.roas != null && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1">
                ROAS
              </div>
              <div className="text-[34px] leading-none font-bold tracking-tight text-stone-900">
                {s.roas.toFixed(2)}x
              </div>
              {s.break_even_roas != null && (
                <div
                  className={`text-xs mt-1.5 font-medium ${
                    roasVerdict ? 'text-teal-700' : 'text-red-700'
                  }`}
                >
                  {roasVerdict ? 'Above' : 'Below'} break-even of{' '}
                  {s.break_even_roas.toFixed(2)}x
                </div>
              )}
            </div>
          )}
        </div>

        {s && s.items_missing_cost > 0 && (
          <div className="mt-4 text-[13px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
            <strong className="font-semibold">Profit is understated.</strong>{' '}
            {s.items_missing_cost} delivered item
            {s.items_missing_cost === 1 ? ' has' : 's have'} no buying price
            recorded, so their cost counts as ৳0.{' '}
            <Link href="/dashboard/products" className="underline font-medium">
              Add buying prices
            </Link>
          </div>
        )}
      </Card>

      {/* Metric grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Metric
          label="Delivered revenue"
          value={s ? formatBDT(s.delivered_revenue_bdt, locale) : '—'}
          sub={s ? `${s.delivered_orders} delivered` : ''}
          tooltip="Money from delivered orders only. Cash-on-delivery income isn't real until the parcel lands."
        />
        <Metric
          label="Ad spend"
          value={s ? formatBDT(s.ad_spend_bdt, locale) : '—'}
          sub={
            s && parseFloat(s.estimated_spend_bdt) > 0
              ? `${formatBDT(s.estimated_spend_bdt, locale)} estimated from budget`
              : s && s.spend_by_platform.length
                ? s.spend_by_platform.map((p) => platformLabel(p.platform)).join(' · ')
                : 'No spend logged'
          }
          tooltip="Total for this period across all platforms. Amounts auto-filled from your daily budget are estimates until you confirm them."
        />
        <Metric
          label="Cost per order"
          value={s?.cost_per_order_bdt ? formatBDT(s.cost_per_order_bdt, locale) : '—'}
          sub={s?.cac_delivered_bdt ? `${formatBDT(s.cac_delivered_bdt, locale)} per delivered` : ''}
          tooltip="Ad spend divided by orders. The 'per delivered' figure is your true acquisition cost."
        />
        <Metric
          label="Gross margin"
          value={s?.gross_margin_pct != null ? `${s.gross_margin_pct.toFixed(1)}%` : '—'}
          sub={s ? `${formatBDT(s.gross_profit_bdt, locale)} before ads` : ''}
          tooltip="Delivered revenue minus product cost, as a percentage."
        />
        <Metric
          label="Delivery success"
          value={s?.delivery_success_pct != null ? `${s.delivery_success_pct.toFixed(1)}%` : '—'}
          sub={s ? `${s.returned_orders} returned` : ''}
          tooltip="Delivered vs (delivered + returned). Every return costs you courier fees both ways."
          warn={s?.delivery_success_pct != null && s.delivery_success_pct < 70}
        />
        <Metric
          label="Avg order value"
          value={s?.aov_bdt ? formatBDT(s.aov_bdt, locale) : '—'}
          sub={s ? `${s.total_orders} orders total` : ''}
          tooltip="Average value of a delivered order."
        />
        <Metric
          label="Profit per order"
          value={s?.profit_per_order_bdt ? formatBDT(s.profit_per_order_bdt, locale) : '—'}
          sub="after cost + ads"
          tooltip="Net profit divided by delivered orders."
          warn={!!s?.profit_per_order_bdt && parseFloat(s.profit_per_order_bdt) < 0}
        />
        <Metric
          label="Still in flight"
          value={s ? String(s.in_flight_orders) : '—'}
          sub={s ? `${formatBDT(s.booked_revenue_bdt, locale)} booked` : ''}
          tooltip="Orders not yet delivered or returned — money still at risk."
        />
      </div>

      {funnelQ.data && <FunnelSection funnel={funnelQ.data} locale={locale} />}

      {trackingQ.data && (
        <TrackingSection stats={trackingQ.data} locale={locale} />
      )}

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className="grid gap-5">
          <BudgetPanel
            budgets={budgetQ.data ?? []}
            onChanged={invalidate}
            locale={locale}
          />
          <AdSpendPanel
            entries={spendQ.data ?? []}
            onChanged={invalidate}
            locale={locale}
          />
        </div>

        {/* Per-product profit */}
        <Card className="p-0 overflow-hidden" hover={false}>
          <div className="px-5 py-3.5 border-b border-stone-200 flex items-center gap-2">
            <IcChart size={16} className="text-stone-500" />
            <h2 className="text-base font-semibold">Profit by product</h2>
            <span className="ml-auto text-xs text-stone-500">delivered only</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-left">
                  <Th>Product</Th>
                  <Th>Units</Th>
                  <Th>Revenue</Th>
                  <Th>Profit</Th>
                  <Th>Margin</Th>
                </tr>
              </thead>
              <tbody>
                {(productQ.data ?? []).map((p) => (
                  <tr key={p.product_id} className="border-t border-stone-100">
                    <Td>
                      <span className="font-medium text-stone-900">{p.product_name}</span>
                      {!p.has_cost && (
                        <span
                          className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded"
                          title="No buying price recorded — profit shown is overstated."
                        >
                          no cost
                        </span>
                      )}
                    </Td>
                    <Td>{p.units_delivered}</Td>
                    <Td>{formatBDT(p.revenue_bdt, locale)}</Td>
                    <Td
                      className={
                        parseFloat(p.profit_bdt) >= 0
                          ? 'font-semibold text-teal-700'
                          : 'font-semibold text-red-700'
                      }
                    >
                      {formatBDT(p.profit_bdt, locale)}
                    </Td>
                    <Td className="text-stone-600">
                      {p.margin_pct != null ? `${p.margin_pct.toFixed(1)}%` : '—'}
                    </Td>
                  </tr>
                ))}
                {!productQ.isLoading && (productQ.data?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                      No delivered orders in this period yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Daily budget (the no-typing path) ───────────────────────── */

function BudgetPanel({
  budgets,
  onChanged,
  locale,
}: {
  budgets: AdBudget[];
  onChanged: () => void;
  locale: 'en' | 'bn';
}) {
  const [platform, setPlatform] = useState('facebook');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = budgets.filter((b) => b.is_active && parseFloat(b.daily_amount_bdt) > 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setAdBudget({
        platform,
        daily_amount_bdt: amount.trim(),
        is_active: true,
      });
      setAmount('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const turnOff = async (b: AdBudget) => {
    try {
      await setAdBudget({
        platform: b.platform,
        daily_amount_bdt: b.daily_amount_bdt,
        is_active: false,
      });
      onChanged();
    } catch {
      // list refreshes regardless
    }
  };

  return (
    <Card className="p-5 bg-gradient-to-b from-teal-50/60 to-white border-teal-100" hover={false}>
      <h2 className="text-base font-semibold mb-1">Daily ad budget</h2>
      <p className="text-xs text-stone-600 mb-4 leading-relaxed">
        Spend about the same every day? Set it once and we&rsquo;ll fill in each
        day&rsquo;s spend automatically — no daily typing. Change any single day
        below whenever it differs.
      </p>

      {active.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {active.map((b) => (
            <div
              key={b.platform}
              className="flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-stone-900">
                  {formatBDT(b.daily_amount_bdt, locale)}
                  <span className="font-normal text-stone-500"> / day</span>
                </div>
                <div className="text-[11px] text-stone-500">
                  {platformLabel(b.platform)} · auto-filling since {b.starts_on}
                </div>
              </div>
              <button
                type="button"
                onClick={() => turnOff(b)}
                className="text-xs font-medium text-stone-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Turn off
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={save} className="grid gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full h-10 px-2.5 bg-white border border-stone-300 rounded-md text-sm text-stone-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              {AD_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              ৳ per day
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              inputMode="decimal"
              className="w-full h-10 px-2.5 bg-white border border-stone-300 rounded-md text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? 'Saving…' : active.length ? 'Update budget' : 'Set it and forget it'}
        </Button>
      </form>
    </Card>
  );
}

/* ── Ad spend entry ───────────────────────────────────────────── */

function AdSpendPanel({
  entries,
  onChanged,
  locale,
}: {
  entries: import('@/lib/marketingApi').AdSpend[];
  onChanged: () => void;
  locale: 'en' | 'bn';
}) {
  const [date, setDate] = useState(todayIso());
  const [platform, setPlatform] = useState('facebook');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await recordAdSpend({
        spend_date: date,
        platform,
        amount_bdt: amount.trim(),
      });
      setAmount('');
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteAdSpend(id);
      onChanged();
    } catch {
      // ignore — the list refreshes either way
    }
  };

  return (
    <Card className="p-5" hover={false}>
      <h2 className="text-base font-semibold mb-1">Correct a single day</h2>
      <p className="text-xs text-stone-500 mb-4">
        Spent something different on one day — or don&rsquo;t use a daily budget?
        Enter the exact amount here. It replaces that day&rsquo;s figure and marks
        it confirmed.
      </p>

      <form onSubmit={submit} className="grid gap-3">
        <Input
          type="date"
          label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Platform
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-stone-300 rounded-md text-sm text-stone-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          >
            {AD_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Amount (৳)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="5000"
          inputMode="decimal"
          required
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : saved ? (<><IcCheck size={14} /> Saved</>) : 'Save spend'}
        </Button>
      </form>

      <div className="mt-5 border-t border-stone-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
          Logged in this period
        </h3>
        {entries.length === 0 ? (
          <p className="text-sm text-stone-500 py-2">Nothing logged yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-stone-100 max-h-[320px] overflow-y-auto">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-stone-900 flex items-center gap-1.5">
                    {formatBDT(e.amount_bdt, locale)}
                    {e.is_estimated && (
                      <span
                        className="text-[9px] uppercase tracking-wide font-semibold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded"
                        title="Auto-filled from your daily budget. Enter the real amount above to confirm it."
                      >
                        est
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {e.spend_date} · {platformLabel(e.platform)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  title="Delete entry"
                  className="w-8 h-8 grid place-items-center rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <IcTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Bits ─────────────────────────────────────────────────────── */

function Metric({
  label,
  value,
  sub,
  tooltip,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tooltip: string;
  warn?: boolean;
}) {
  return (
    <Card className="p-4" hover={false}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">
          {label}
        </div>
        <span className="text-stone-300 text-xs cursor-help" title={tooltip}>
          ⓘ
        </span>
      </div>
      <div
        className={`text-xl font-bold tracking-tight ${
          warn ? 'text-red-700' : 'text-stone-900'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-stone-500 mt-0.5 truncate">{sub}</div>}
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>{children}</td>;
}

/* ── Funnel ───────────────────────────────────────────────────── */

// FunnelSection shows where buyers drop off, computed from our own visit and
// order data — Meta is never the source of truth for the seller's numbers.
function FunnelSection({
  funnel,
  locale,
}: {
  funnel: FunnelStats;
  locale: 'en' | 'bn';
}) {
  void locale;
  const steps = [
    { label: 'Shoppers', value: funnel.unique_visitors, hint: `${funnel.product_views} product views` },
    { label: 'Ordered', value: funnel.orders_placed, hint: pctLabel(funnel.view_to_order_pct, 'of shoppers') },
    { label: 'Delivered', value: funnel.orders_delivered, hint: pctLabel(funnel.order_to_delivered_pct, 'of orders') },
  ];
  const max = Math.max(funnel.unique_visitors, funnel.orders_placed, 1);

  return (
    <Card className="p-5 mb-6" hover={false}>
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-base font-semibold">Your funnel</h2>
        <span className="text-xs text-stone-500">
          {funnel.view_to_delivered_pct != null
            ? `${funnel.view_to_delivered_pct}% of shoppers end up paying`
            : 'Not enough traffic yet'}
        </span>
      </div>
      <div className="grid gap-2.5">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-[86px] text-[13px] font-medium text-stone-700 flex-shrink-0">
              {s.label}
            </div>
            <div className="flex-1 min-w-0 h-8 bg-stone-100 rounded-md overflow-hidden">
              <div
                className={`h-full rounded-md ${
                  i === 0 ? 'bg-stone-300' : i === 1 ? 'bg-teal-300' : 'bg-teal-600'
                }`}
                style={{ width: `${Math.max((s.value / max) * 100, s.value > 0 ? 4 : 0)}%` }}
              />
            </div>
            <div className="w-[132px] text-right flex-shrink-0">
              <div className="text-sm font-bold text-stone-900">{s.value}</div>
              <div className="text-[11px] text-stone-500 truncate">{s.hint}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function pctLabel(v: number | null, suffix: string): string {
  return v != null ? `${v}% ${suffix}` : '—';
}

/* ── Meta tracking health ─────────────────────────────────────── */

function TrackingSection({
  stats,
  locale,
}: {
  stats: TrackingStats;
  locale: 'en' | 'bn';
}) {
  // Nothing to show until the seller connects Meta.
  if (!stats.configured) {
    return (
      <Card className="p-5 mb-6 border-dashed" hover={false}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <h2 className="text-base font-semibold mb-1">
              Facebook isn&rsquo;t learning from your sales yet
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Connect Meta and we&rsquo;ll report every order — and every successful
              delivery — back to Facebook, so your ads start finding more people who
              actually pay.
            </p>
          </div>
          <Link href="/dashboard/settings">
            <Button variant="primary" size="sm">Connect Facebook</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const healthy = stats.total_failed === 0;

  return (
    <Card className="p-5 mb-6" hover={false}>
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-base font-semibold">Facebook ad tracking</h2>
        <span
          className={`text-[11px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full ${
            !stats.enabled
              ? 'bg-stone-100 text-stone-600'
              : healthy
                ? 'bg-teal-100 text-teal-800'
                : 'bg-red-100 text-red-700'
          }`}
        >
          {!stats.enabled ? 'Paused' : healthy ? 'Working' : 'Needs attention'}
        </span>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Conversions sent"
          value={String(stats.total_sent)}
          sub={stats.total_pending > 0 ? `${stats.total_pending} queued` : 'all delivered'}
          tooltip="Orders and deliveries successfully reported to Meta in this period."
        />
        <Metric
          label="Value reported"
          value={formatBDT(stats.reported_value_bdt, locale)}
          sub="told to Facebook"
          tooltip="Total order value Meta was told about — it uses this to optimise for higher-value buyers."
        />
        <Metric
          label="Match quality"
          value={`${stats.match_quality_pct}%`}
          sub={`${stats.avg_match_fields} identifiers per event`}
          tooltip="How much identifying data (phone, name, city) we can attach. Higher means Meta can credit more of your sales to the right ad."
          warn={stats.match_quality_pct < 50}
        />
        <Metric
          label="Failed"
          value={String(stats.total_failed)}
          sub={stats.total_failed > 0 ? 'check the error below' : 'no problems'}
          tooltip="Events Meta rejected. A failure usually means the access token expired."
          warn={stats.total_failed > 0}
        />
      </div>

      {stats.by_event_type.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {stats.by_event_type.map((t) => (
            <span
              key={t.event_name}
              className="inline-flex items-center gap-1.5 text-xs bg-stone-50 border border-stone-200 rounded-full px-3 py-1.5"
            >
              <span className="font-medium text-stone-800">{eventLabel(t.event_name)}</span>
              <span className="text-stone-500">{t.sent} sent</span>
              {t.failed > 0 && <span className="text-red-600">{t.failed} failed</span>}
            </span>
          ))}
        </div>
      )}

      {stats.last_error && (
        <div className="mt-4 text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
          <strong className="font-semibold">Meta said:</strong> {stats.last_error}
          {' — '}
          <Link href="/dashboard/settings" className="underline font-medium">
            check your token
          </Link>
        </div>
      )}
    </Card>
  );
}
