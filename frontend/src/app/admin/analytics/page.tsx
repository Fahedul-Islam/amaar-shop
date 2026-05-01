'use client';
import { useEffect, useState } from 'react';
import { getAnalytics, type AnalyticsReport, type PeriodMetric } from '@/lib/adminApi';
import { formatBDT, formatNumber, formatShortDate } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, Spinner, EmptyState,
} from '../ui';
import { LineChart } from '@/components/ui/LineChart';

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

function MetricTile({
  label, metric, money, sub,
}: {
  label: string;
  metric: PeriodMetric;
  money?: boolean;
  sub?: string;
}) {
  const change = formatChange(metric);
  const value = money
    ? formatBDT(metric.current)
    : formatNumber(metric.current);
  const changeColor =
    change.up === null ? 'text-stone-500' : change.up ? 'text-emerald-700' : 'text-red-600';
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight text-stone-900 mt-1">{value}</div>
      <div className="flex items-center gap-2 mt-1 text-xs">
        <span className={`font-medium ${changeColor}`}>{change.text}</span>
        <span className="text-stone-500">{sub || 'vs previous period'}</span>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAnalytics(days)
      .then((r) => setData(r))
      .catch((e) => setError(e?.message || 'Failed to load insights'))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <>
      <PageHeader
        title="Marketplace insights"
        crumbs={['Home', 'Insights']}
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
            {/* Headline tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <MetricTile label="Total sales" metric={data.gmv_bdt} money />
              <MetricTile label="Orders" metric={data.orders} />
              <MetricTile label="New customers" metric={data.new_customers} sub="distinct phone numbers" />
              <MetricTile label="New shops" metric={data.new_shops} />
              <MetricTile label="Average order" metric={data.avg_order_value_bdt} money />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <SectionCard title="Order volume per day">
                {data.orders_daily.length === 0 ? (
                  <EmptyState message="No orders yet." />
                ) : (
                  <LineChart
                    data={data.orders_daily.map((p) => ({ x: p.date, y: Number(p.value) }))}
                    formatY={(n) => formatNumber(Math.round(n))}
                    formatX={(s) => formatShortDate(s)}
                    height={200}
                  />
                )}
              </SectionCard>

              <SectionCard title="New customers per day">
                {data.new_customers_daily.length === 0 ? (
                  <EmptyState message="No customers yet." />
                ) : (
                  <LineChart
                    data={data.new_customers_daily.map((p) => ({ x: p.date, y: Number(p.value) }))}
                    formatY={(n) => formatNumber(Math.round(n))}
                    formatX={(s) => formatShortDate(s)}
                    height={200}
                    color="#F59E0B"
                  />
                )}
              </SectionCard>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SectionCard title="Top categories">
                {data.top_categories.length === 0 ? (
                  <EmptyState message="No sales yet." />
                ) : (
                  <div className="space-y-3">
                    {data.top_categories.map((c) => (
                      <div key={c.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium text-stone-900">{c.name}</span>
                          <span className="text-stone-500 tabular-nums">
                            {formatBDT(c.gmv_bdt)} · {c.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full"
                            style={{ width: `${c.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Best-selling products">
                {data.top_products.length === 0 ? (
                  <EmptyState message="No sales yet." />
                ) : (
                  <div className="flex flex-col">
                    {data.top_products.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0"
                      >
                        <span className="w-4 text-stone-400 text-xs tabular-nums">{i + 1}</span>
                        <div className="w-9 h-9 rounded-md bg-stone-100 overflow-hidden flex-shrink-0 grid place-items-center text-xs text-stone-400">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            '—'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-900 line-clamp-1">
                            {p.name}
                          </div>
                          <div className="text-xs text-stone-500 line-clamp-1">{p.shop_name}</div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums">{p.units_sold}</div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Where buyers are">
                {data.geographic.length === 0 ? (
                  <EmptyState message="No deliveries yet." />
                ) : (
                  <div className="space-y-3">
                    {data.geographic.map((g) => (
                      <div key={g.area}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium text-stone-900">{g.area}</span>
                          <span className="text-stone-500 tabular-nums">
                            {formatNumber(g.orders)} orders · {g.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${g.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
