'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { LineChart } from '@/components/ui/LineChart';
import { getSalesReport } from '@/lib/analyticsApi';
import { formatBDT, formatCompactBDT, formatShortDate } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';
import { type DateRange, getPresetRange, getPreviousPeriod } from '@/lib/dateRange';

const statuses = [
  ['pending', 'Waiting for confirmation', 'Confirm these orders with your buyers.'],
  ['confirmed', 'Ready to send', 'Prepare these parcels for the courier.'],
  ['shipped', 'With the courier', 'Follow up on parcels that have not arrived.'],
  ['delivered', 'Delivered', 'Check courier settlements separately.'],
  ['returned', 'Returned', 'Review the reason before taking another order.'],
  ['cancelled', 'Cancelled', 'Review cancellations to find recurring problems.'],
] as const;

export default function AnalyticsPage() {
  const { locale } = useI18n();
  const [range, setRange] = useState<DateRange>(() => getPresetRange('last30'));
  const [compare, setCompare] = useState(false);
  const previous = getPreviousPeriod(range);
  const reportQ = useQuery({ queryKey: ['sales-report', range.startDate, range.endDate], queryFn: () => getSalesReport(range.startDate, range.endDate) });
  const previousQ = useQuery({ queryKey: ['sales-report', previous.startDate, previous.endDate], queryFn: () => getSalesReport(previous.startDate, previous.endDate), enabled: compare });
  const report = reportQ.data;
  const money = (value: string | number) => formatBDT(String(value), locale);
  const count = (status: string) => report?.status_counts[status] ?? 0;
  const value = (status: string) => report?.status_values[status] ?? '0';
  const exportDaily = () => {
    if (!report) return;
    const csv = ['Date,Orders including cancelled,Order value BDT excluding cancelled', ...report.daily.map(d => `${d.date},${d.orders},${d.revenue_bdt}`)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `sales-${range.startDate}-${range.endDate}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="px-4 md:px-8 py-6 max-w-6xl space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div><h1 className="text-2xl font-bold">Sales reports</h1><p className="text-sm text-stone-600 mt-1">See what sold and where your orders stand.</p></div>
        <DateRangePicker value={range} onChange={setRange} compare={compare} onCompareChange={setCompare} />
      </div>
      <p className="text-sm text-stone-500">Orders placed {range.startDate} to {range.endDate}, using Bangladesh dates. Statuses show where those orders are now. Order values include delivery charges and discounts; they are not cash received.</p>
      {reportQ.isPending ? <p role="status">Loading sales report…</p> : reportQ.isError ? <Card className="p-5" hover={false}><p role="alert">Could not load your sales report.</p><Button onClick={() => reportQ.refetch()} size="sm">Try again</Button></Card> : report && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Orders received', String(report.total_orders), 'Includes cancelled orders'],
            ['Delivered order value', money(value('delivered')), `${count('delivered')} orders delivered`],
            ['Still to deliver', money(Number(value('pending')) + Number(value('confirmed')) + Number(value('shipped'))), `${count('pending') + count('confirmed') + count('shipped')} orders`],
            ['Returned order value', money(value('returned')), `${count('returned')} returns · ${count('cancelled')} cancellations`],
          ].map(([label, amount, hint]) => <Card key={label} className="p-4" hover={false}><p className="text-sm text-stone-600">{label}</p><p className="text-xl font-semibold mt-2 break-words">{amount}</p><p className="text-xs text-stone-500 mt-1">{hint}</p></Card>)}
        </div>
        {compare && <p className="text-sm text-stone-600" role="status">{previousQ.isPending ? 'Loading previous period…' : previousQ.isError ? 'Could not load the previous period.' : previousQ.data ? `Previous period (${previous.startDate} to ${previous.endDate}): ${previousQ.data.total_orders} orders received · ${money(previousQ.data.status_values.delivered ?? '0')} delivered order value.` : ''}</p>}
        {report.total_orders === 0 && <Card className="p-5" hover={false}><h2 className="font-semibold">No orders in these dates</h2><p className="text-sm text-stone-600 mt-1">Choose a wider period to review earlier sales.</p></Card>}
        <Card className="p-5" hover={false}>
          <h2 className="font-semibold mb-1">Where are these orders now?</h2><p className="text-sm text-stone-500 mb-4">Use the links to open all orders with that status, across every date.</p>
          <div className="divide-y divide-stone-100">{statuses.map(([status, label, hint]) => <div key={status} className="py-3 flex flex-wrap justify-between gap-2"><div><Link className="font-medium text-teal-700 hover:underline" href={`/dashboard/orders?status=${status}`}>{label} →</Link><p className="text-xs text-stone-500 mt-1">{hint}</p></div><div className="text-right text-sm"><p>{count(status)} orders</p><p className="text-stone-500">{money(value(status))}</p></div></div>)}</div>
        </Card>
        <Card className="p-5" hover={false}>
          <div className="flex justify-between flex-wrap gap-3 mb-4"><div><h2 className="font-semibold">Daily order value</h2><p className="text-xs text-stone-500 mt-1">Excludes cancellations. Includes orders still to deliver and returns.</p></div><Button size="sm" onClick={exportDaily}>Download daily CSV</Button></div>
          <LineChart data={report.daily.map(d => ({ x: d.date, y: Number(d.revenue_bdt) }))} compareData={compare ? previousQ.data?.daily.map(d => ({ x: d.date, y: Number(d.revenue_bdt) })) : undefined} formatY={n => formatCompactBDT(n, locale)} formatX={d => formatShortDate(d, locale)} currentLabel="Selected dates" compareLabel="Previous period" />
        </Card>
        <Card className="p-5" hover={false}><h2 className="font-semibold">Most ordered products</h2><p className="text-sm text-stone-500 mt-1 mb-4">Top 10 by quantity in the selected dates. Review stock before promoting these products. Excludes cancelled orders; includes returns and undelivered orders.</p>
          {report.products.length === 0 ? <p className="text-sm text-stone-500">No products ordered in this period.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="text-stone-500"><th className="py-2">Product</th><th className="p-2 text-right">Units ordered</th><th className="p-2 text-right">Product value after coupons</th></tr></thead><tbody>{report.products.map(p => <tr key={p.product_id} className="border-t border-stone-100"><td className="py-3"><Link className="text-teal-700 hover:underline" href={`/dashboard/products/${p.product_id}`}>{p.product_name}</Link></td><td className="p-2 text-right">{p.total_quantity}</td><td className="p-2 text-right whitespace-nowrap">{money(p.total_revenue_bdt)}</td></tr>)}</tbody></table></div>}
        </Card>
        <p className="text-sm text-stone-600">Want to check what remains after buying products and running ads? <Link href="/dashboard/marketing" className="text-teal-700 underline">Open profit &amp; ad costs</Link>.</p>
      </>}
    </div>
  );
}
