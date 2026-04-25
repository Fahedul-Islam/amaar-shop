'use client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { getRangeStats, getTodayStats, getTopProducts } from '@/lib/analyticsApi';
import { formatBDT } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const { locale } = useI18n();
  const todayIso = new Date().toISOString().slice(0, 10);
  const from = isoDaysAgo(29);

  const todayQ = useQuery({ queryKey: ['stats-today'], queryFn: getTodayStats });
  const rangeQ = useQuery({ queryKey: ['stats-range', from, todayIso], queryFn: () => getRangeStats(from, todayIso) });
  const topQ = useQuery({ queryKey: ['top-products'], queryFn: getTopProducts });

  const series = rangeQ.data ?? [];
  const totalRevenue = series.reduce((s, d) => s + parseFloat(d.revenue_bdt), 0);
  const totalOrders = series.reduce((s, d) => s + d.orders, 0);
  const avg = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // chart path
  const w = 600, h = 160;
  const max = Math.max(1, ...series.map((d) => parseFloat(d.revenue_bdt)));
  const pts = series.map((d, i) => {
    const x = (i / Math.max(1, series.length - 1)) * w;
    const y = h - 20 - (parseFloat(d.revenue_bdt) / max) * (h - 30);
    return [x, y];
  });
  const path = pts.length ? 'M' + pts.map((p) => p.join(',')).join(' L') : '';
  const fill = path ? `${path} L ${w},${h - 20} L 0,${h - 20} Z` : '';

  return (
    <div className="px-6 md:px-8 py-6 md:py-7">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mb-1">Analytics</h1>
      <p className="text-stone-500 mb-5">Last 30 days.</p>

      <div className="grid gap-3.5 mb-5 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Stat label="Revenue · today" value={todayQ.data ? formatBDT(todayQ.data.revenue_bdt, locale) : '—'} />
        <Stat label="Revenue · 30d" value={formatBDT(totalRevenue, locale)} />
        <Stat label="Orders · 30d" value={String(totalOrders)} />
        <Stat label="Avg order" value={formatBDT(avg, locale)} />
      </div>

      <Card className="p-5 mb-5" hover={false}>
        <h3 className="text-sm font-semibold mb-3.5">Revenue · daily</h3>
        {series.length === 0 ? (
          <div className="text-sm text-stone-500 py-10 text-center">No data yet.</div>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D9488" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fill} fill="url(#grad)" />
            <path d={path} fill="none" stroke="#0D9488" strokeWidth="2" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r="2" fill="#0D9488" />
            ))}
          </svg>
        )}
      </Card>

      <Card className="p-5" hover={false}>
        <h3 className="text-sm font-semibold mb-3">Top products</h3>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4" hover={false}>
      <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold tracking-tight mt-1.5 text-stone-900">{value}</div>
    </Card>
  );
}
