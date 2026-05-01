'use client';
import { useEffect, useState } from 'react';
import { getFinancial, type FinancialReport, type PeriodMetric } from '@/lib/adminApi';
import { formatBDT, formatNumber, formatShortDate } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, ShopMark, Spinner, EmptyState,
} from '../ui';
import { LineChart } from '@/components/ui/LineChart';

const RANGES = [
  { id: 7,   label: 'Last 7 days' },
  { id: 30,  label: 'Last 30 days' },
  { id: 90,  label: 'Last 90 days' },
  { id: 365, label: 'Last year' },
];

function formatChange(m: PeriodMetric): { text: string; up: boolean | null } {
  if (m.change_pct === null || m.change_pct === undefined) return { text: '—', up: null };
  const up = m.change_pct >= 0;
  return { text: `${up ? '↑' : '↓'} ${Math.abs(m.change_pct).toFixed(1)}%`, up };
}

function MoneyTile({
  label,
  metric,
  hint,
  accent,
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

function PlainTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 relative overflow-hidden">
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      )}
      <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight text-stone-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminFinancialPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FinancialReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getFinancial(days)
      .then((r) => setData(r))
      .catch((e) => setError(e?.message || 'Failed to load financial report'))
      .finally(() => setLoading(false));
  }, [days]);

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

        {loading || !data ? (
          <Spinner />
        ) : (
          <>
            {/* Headline tiles — money in, fee earned, refunds, owed to shops */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <MoneyTile
                label="Total sales"
                metric={data.gmv_bdt}
                accent="#0D9488"
                hint="all paid orders"
              />
              <MoneyTile
                label="Platform fee earned"
                metric={data.platform_fee_bdt}
                hint={`${data.revenue_split.platform_fee_pct.toFixed(0)}% of sales`}
              />
              <PlainTile
                label="Owed to shops"
                value={formatBDT(data.pending_payouts_bdt)}
                sub={`${formatNumber(data.pending_payout_count)} shop${data.pending_payout_count === 1 ? '' : 's'} · running total`}
                accent="#F59E0B"
              />
              <MoneyTile
                label="Refunded"
                metric={data.refunds_bdt}
                hint="cancelled orders"
              />
            </div>

            {/* Sales chart + revenue split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2">
                <SectionCard title="Sales per day">
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
              </div>

              <SectionCard title="Where the money goes">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-stone-900">Paid to shop owners</span>
                      <span className="text-stone-500 tabular-nums">
                        {formatBDT(data.revenue_split.to_shops_bdt)}
                      </span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full"
                        style={{ width: `${data.revenue_split.to_shops_pct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-stone-900">Platform fee</span>
                      <span className="text-stone-500 tabular-nums">
                        {formatBDT(data.revenue_split.platform_fee_bdt)}
                      </span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${data.revenue_split.platform_fee_pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-stone-100 flex justify-between text-sm">
                    <span className="text-stone-500">Total sales · period</span>
                    <span className="font-bold tabular-nums">{formatBDT(data.gmv_bdt.current)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Per-shop earnings table */}
            <SectionCard title="What each shop has earned" padBody={false}>
              {data.upcoming_payouts.length === 0 ? (
                <EmptyState message="No shop earnings in this period." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 text-left">
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Orders</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Total sales</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Platform fee</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Owed to shop</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming_payouts.map((p) => (
                        <tr key={p.shop_id} className="border-t border-stone-100 hover:bg-stone-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <ShopMark name={p.shop_name} size={28} />
                              <span className="font-medium text-stone-900">{p.shop_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(p.orders)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatBDT(p.gross_bdt)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-stone-500">
                            −{formatBDT(p.fee_bdt)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold">
                            {formatBDT(p.net_bdt)}
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
      </PageBody>
    </>
  );
}
