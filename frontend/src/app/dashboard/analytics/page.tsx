'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { LineChart, type LineChartPoint } from '@/components/ui/LineChart';
import {
  getRangeStats,
  getStatsSummary,
  getTopProducts,
  getVisitSummary,
  getTopVisitedProducts,
  type VisitPeriod,
} from '@/lib/analyticsApi';
import {
  formatBDT,
  formatCompactBDT,
  formatCompactNumber,
  formatShortDate,
  formatDate,
} from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';
import {
  type DateRange,
  daysInRange,
  formatRangeLabel,
  getPresetRange,
  getPreviousPeriod,
} from '@/lib/dateRange';

export default function AnalyticsPage() {
  const { locale } = useI18n();
  const [range, setRange] = useState<DateRange>(() => getPresetRange('last30'));
  const [compare, setCompare] = useState(false);
  const [visitPeriod, setVisitPeriod] = useState<VisitPeriod>('daily');

  const previous = useMemo(
    () => (compare ? getPreviousPeriod(range) : null),
    [compare, range],
  );

  const summaryQ = useQuery({
    queryKey: ['stats-summary', range.startDate, range.endDate, previous?.startDate ?? null, previous?.endDate ?? null],
    queryFn: () =>
      getStatsSummary(range.startDate, range.endDate, previous?.startDate, previous?.endDate),
  });

  const rangeQ = useQuery({
    queryKey: ['stats-range', range.startDate, range.endDate],
    queryFn: () => getRangeStats(range.startDate, range.endDate),
  });

  const prevRangeQ = useQuery({
    queryKey: ['stats-range-prev', previous?.startDate, previous?.endDate],
    queryFn: () =>
      getRangeStats(previous!.startDate, previous!.endDate),
    enabled: !!previous,
  });

  const topQ = useQuery({ queryKey: ['top-products'], queryFn: getTopProducts });

  const visitSummaryQ = useQuery({
    queryKey: ['visits-summary', visitPeriod],
    queryFn: () => getVisitSummary(visitPeriod),
  });
  const topVisitedQ = useQuery({
    queryKey: ['visits-top-products'],
    queryFn: getTopVisitedProducts,
  });

  const summary = summaryQ.data?.current;
  const previousSummary = summaryQ.data?.previous;
  const changes = summaryQ.data?.changes;

  const revenuePoints: LineChartPoint[] = (rangeQ.data ?? []).map((d) => ({
    x: d.date,
    y: parseFloat(d.revenue_bdt),
  }));
  const prevRevenuePoints: LineChartPoint[] | undefined = compare && prevRangeQ.data
    ? prevRangeQ.data.map((d) => ({ x: d.date, y: parseFloat(d.revenue_bdt) }))
    : undefined;

  const buckets = visitSummaryQ.data?.buckets ?? [];
  const totalVisitPoints: LineChartPoint[] = buckets.map((b) => ({ x: b.bucket, y: b.total_visits }));
  const uniqueVisitPoints: LineChartPoint[] = buckets.map((b) => ({ x: b.bucket, y: b.unique_visits }));

  const rangeDays = daysInRange(range);

  return (
    <div className="px-6 md:px-8 py-6 md:py-7">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Analytics</h1>
          <p className="text-stone-500 mt-1">
            <span className="font-medium text-stone-700">{formatRangeLabel(range)}</span>
            <span className="text-stone-400">
              {' · '}{formatDate(range.startDate, locale)} – {formatDate(range.endDate, locale)} ({rangeDays} {rangeDays === 1 ? 'day' : 'days'})
            </span>
          </p>
        </div>
        <DateRangePicker
          value={range}
          onChange={setRange}
          compare={compare}
          onCompareChange={setCompare}
        />
      </div>

      {compare && previous && (
        <div className="mb-5 mt-3 p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600 flex items-center gap-2">
          <span className="inline-block w-4 border-t-[2px] border-dashed border-stone-400" />
          <span>
            Comparing with <span className="font-medium text-stone-800">{formatDate(previous.startDate, locale)} – {formatDate(previous.endDate, locale)}</span> (previous {rangeDays} {rangeDays === 1 ? 'day' : 'days'})
          </span>
        </div>
      )}

      <div className="grid gap-3.5 mb-5 mt-5 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        <MetricCard
          label="Revenue"
          value={summary ? formatBDT(summary.revenue_bdt, locale) : '—'}
          previousValue={previousSummary ? formatBDT(previousSummary.revenue_bdt, locale) : null}
          change={changes?.revenue_pct ?? null}
          showChange={compare}
        />
        <MetricCard
          label="Orders"
          value={summary ? String(summary.orders) : '—'}
          previousValue={previousSummary ? String(previousSummary.orders) : null}
          change={changes?.orders_pct ?? null}
          showChange={compare}
        />
        <MetricCard
          label="Avg order value"
          value={summary ? formatBDT(summary.aov_bdt, locale) : '—'}
          previousValue={previousSummary ? formatBDT(previousSummary.aov_bdt, locale) : null}
          change={changes?.aov_pct ?? null}
          showChange={compare}
        />
        <MetricCard
          label="Total visits"
          value={summary ? String(summary.total_visits) : '—'}
          previousValue={previousSummary ? String(previousSummary.total_visits) : null}
          change={changes?.total_visits_pct ?? null}
          showChange={compare}
        />
        <MetricCard
          label="Unique visitors"
          value={summary ? String(summary.unique_visits) : '—'}
          previousValue={previousSummary ? String(previousSummary.unique_visits) : null}
          change={changes?.unique_visits_pct ?? null}
          showChange={compare}
        />
        <MetricCard
          label="Visit → order rate"
          value={summary ? `${summary.order_rate.toFixed(2)}%` : '—'}
          previousValue={previousSummary ? `${previousSummary.order_rate.toFixed(2)}%` : null}
          change={changes?.order_rate_pct ?? null}
          showChange={compare}
        />
      </div>

      <Card className="p-5 mb-5" hover={false}>
        <div className="flex items-baseline justify-between mb-3.5 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Daily revenue</h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Hover any point to see the exact amount for that day.
            </p>
          </div>
          {summary && (
            <div className="text-right">
              <div className="text-[11px] text-stone-500 uppercase tracking-wider">Total</div>
              <div className="text-lg font-bold text-stone-900">{formatBDT(summary.revenue_bdt, locale)}</div>
            </div>
          )}
        </div>
        <LineChart
          data={revenuePoints}
          compareData={prevRevenuePoints}
          formatY={(n) => formatCompactBDT(n, locale)}
          formatX={(s) => formatShortDate(s, locale)}
          formatTooltipX={(s) => formatDate(s, locale)}
          currentLabel={`This ${rangeDays}d`}
          compareLabel={`Previous ${rangeDays}d`}
        />
      </Card>

      <div className="flex items-center justify-between mb-3 mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Visitor traffic</h2>
        <div className="flex bg-stone-100 rounded-md p-0.5 text-xs">
          {(['daily', 'weekly', 'monthly'] as VisitPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setVisitPeriod(p)}
              className={`px-3 py-1.5 rounded font-medium capitalize transition-colors ${
                visitPeriod === p ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5 mb-5" hover={false}>
        <div className="flex items-baseline justify-between mb-3.5 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Visits per {visitPeriod === 'daily' ? 'day' : visitPeriod === 'weekly' ? 'week' : 'month'}</h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              <span className="inline-flex items-center gap-1.5 mr-3">
                <span className="w-3 h-0.5 bg-teal-600" /> Total visits
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-coral-500" /> Unique visitors
              </span>
            </p>
          </div>
        </div>
        {buckets.length === 0 ? (
          <div className="text-sm text-stone-500 py-10 text-center">No visits yet.</div>
        ) : (
          <DualLineChart
            primary={totalVisitPoints}
            secondary={uniqueVisitPoints}
            primaryLabel="Total visits"
            secondaryLabel="Unique visitors"
            formatY={(n) => formatCompactNumber(n, locale)}
            formatX={(s) => formatShortDate(s, locale)}
          />
        )}
      </Card>

      <Card className="p-5 mb-5" hover={false}>
        <h3 className="text-sm font-semibold mb-3">Most visited products · 30d</h3>
        {(topVisitedQ.data ?? []).length === 0 ? (
          <div className="text-sm text-stone-500 py-3">No product visits yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 text-left">
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium">Visits</th>
                <th className="py-2 font-medium">Unique</th>
              </tr>
            </thead>
            <tbody>
              {(topVisitedQ.data ?? []).map((p) => (
                <tr key={p.product_id} className="border-t border-stone-100">
                  <td className="py-2.5">{p.product_name}</td>
                  <td className="py-2.5 font-medium">{p.total_visits}</td>
                  <td className="py-2.5 text-stone-600">{p.unique_visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-5" hover={false}>
        <h3 className="text-sm font-semibold mb-3">Top products · sales</h3>
        {(topQ.data ?? []).length === 0 ? (
          <div className="text-sm text-stone-500 py-3">No sales data yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-stone-500 text-left">
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium">Sold</th>
                <th className="py-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(topQ.data ?? []).map((p) => (
                <tr key={p.product_id} className="border-t border-stone-100">
                  <td className="py-2.5">{p.product_name}</td>
                  <td className="py-2.5">{p.total_quantity}</td>
                  <td className="py-2.5 font-medium">{formatBDT(p.total_revenue_bdt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  previousValue,
  change,
  showChange,
}: {
  label: string;
  value: string;
  previousValue: string | null;
  change: number | null;
  showChange: boolean;
}) {
  const noPrev = showChange && (change == null || previousValue == null);
  const up = change != null && change >= 0;
  const accent = !showChange || change == null
    ? ''
    : up
      ? 'border-l-4 border-l-emerald-500'
      : 'border-l-4 border-l-red-500';

  return (
    <Card className={`p-4 ${accent}`} hover={false}>
      <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold tracking-tight mt-1.5 text-stone-900">{value}</div>

      {showChange && !noPrev && change != null && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              up
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {up ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 15 12 9 18 15" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            {up ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="text-[11px] text-stone-500">
            vs <span className="font-medium text-stone-700">{previousValue}</span>
          </span>
        </div>
      )}
      {noPrev && (
        <div className="mt-2.5 text-[11px] text-stone-400">No previous data to compare</div>
      )}
    </Card>
  );
}

// DualLineChart shows two series on the same axes — used for visits where
// "Total" and "Unique" naturally share a scale. Reuses LineChart by stacking
// a transparent overlay; simpler to inline a small variant than to overload
// LineChart's API.
function DualLineChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
  formatY,
  formatX,
}: {
  primary: LineChartPoint[];
  secondary: LineChartPoint[];
  primaryLabel: string;
  secondaryLabel: string;
  formatY: (n: number) => string;
  formatX: (s: string) => string;
}) {
  return (
    <LineChart
      data={primary}
      compareData={secondary}
      formatY={formatY}
      formatX={formatX}
      currentLabel={primaryLabel}
      compareLabel={secondaryLabel}
      color="#0D9488"
      compareColor="#F87171"
    />
  );
}
