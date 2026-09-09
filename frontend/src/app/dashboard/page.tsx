'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { IcChevR, IcPlus } from '@/components/icons/Icons';
import { getDashboardSummary } from '@/lib/analyticsApi';
import { listOrders, prettyOrderStatus } from '@/lib/orderApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import { useShop } from '@/hooks/useShop';
import { useI18n } from '@/hooks/useI18n';

export default function DashboardHomePage() {
  const { shop } = useShop();
  const { locale } = useI18n();

  const summaryQ = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
  const ordersQ = useQuery({ queryKey: ['orders-recent'], queryFn: () => listOrders({ page_size: 5 }) });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const s = summaryQ.data;
  const hasTasks = !!s && (s.pending_orders_count > 0 || s.awaiting_advance_count > 0 || s.out_of_stock_count > 0 || s.low_stock_count > 0 || s.unanswered_reviews_count > 0);

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-6xl">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">
            {greeting}{shop ? `, ${shop.name}` : ''}
          </h1>
          <p className="text-stone-500 mt-1">
            Review orders, keep products in stock, and check your sales.
          </p>
        </div>
        <Link href="/dashboard/products/new">
          <Button variant="primary"><IcPlus size={16} /> Add product</Button>
        </Link>
      </div>

      {/* Today's tasks — actionable items */}
      <section className="mb-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Needs attention
        </h2>
        {summaryQ.isLoading && <p className="text-sm text-stone-500">Loading your overview…</p>}
        {summaryQ.isError && <p role="alert" className="text-sm text-red-700">Could not load your overview. <button onClick={() => summaryQ.refetch()} className="underline">Try again</button></p>}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {s && (s.pending_orders_count > 0 || s.awaiting_advance_count > 0) && (
            <Link href={s.awaiting_advance_count > 0 ? '/dashboard/orders' : '/dashboard/orders?status=pending'} className="block group">
              <Card className="p-4 group-hover:border-teal-600 transition-colors" hover={false}>
                <div className="flex justify-between items-center gap-3"><h3 className="font-medium text-sm">Review orders</h3><span className="text-xs text-teal-700">Review →</span></div>
                <p className="mt-2 text-sm text-stone-600">{s.pending_orders_count} awaiting confirmation · {s.awaiting_advance_count} payments to check</p>
              </Card>
            </Link>
          )}
          <ActionCard
            href="/dashboard/products?stock=out"
            count={s?.out_of_stock_count}
            urgent={(s?.out_of_stock_count ?? 0) > 0}
            title="Out of stock"
            description="Products buyers can't order"
            cta="Restock"
            hideIfZero
          />
          <ActionCard
            href="/dashboard/products?stock=low"
            count={s?.low_stock_count}
            warn={(s?.low_stock_count ?? 0) > 0}
            title="Running low (≤ 5)"
            description="Reorder before they run out"
            cta="Review"
            hideIfZero
          />
          <ActionCard
            href="/dashboard/reviews"
            count={s?.unanswered_reviews_count}
            warn={(s?.unanswered_reviews_count ?? 0) > 0}
            title="New reviews to reply"
            description="Customers who left feedback"
            cta="Reply"
            hideIfZero
          />
          {!hasTasks && s && (
            <p className="text-sm text-stone-500 sm:col-span-2 py-3">No orders, stock issues, or reviews need your attention.</p>
          )}
        </div>
      </section>

      {/* Today's money */}
      <section className="mb-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Sales snapshot
        </h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <MoneyCard
            title="Today's sales"
            primary={s ? formatBDT(s.today_revenue_bdt, locale) : '—'}
            secondary={s ? `from ${s.today_orders} order${s.today_orders === 1 ? '' : 's'}` : ''}
            accent="text-stone-900"
            tooltip="Revenue from orders placed today, excluding cancelled."
          />
          <MoneyCard
            title="Cash on the way"
            primary={s ? formatBDT(s.in_transit_amount_bdt, locale) : '—'}
            secondary={s ? `${s.in_transit_orders} order${s.in_transit_orders === 1 ? '' : 's'} with courier` : ''}
            accent="text-amber-700"
            tooltip="Total of all shipped orders not yet delivered. The courier will pay you when they're delivered."
          />
          <MoneyCard
            title="Delivered · last 7 days"
            primary={s ? formatBDT(s.delivered_week_bdt, locale) : '—'}
            secondary={s ? `${s.delivered_week_orders} order${s.delivered_week_orders === 1 ? '' : 's'} completed` : ''}
            accent="text-emerald-700"
            tooltip="Orders delivered in the last 7 days. Use this to reconcile cash receipts from couriers."
          />
        </div>
      </section>

      <div className="space-y-5">
        {/* Recent orders */}
        <Card className="p-0 overflow-hidden" hover={false}>
          <div className="px-5 py-3.5 border-b border-stone-200 flex items-center">
            <h2 className="text-base font-semibold">Recent orders</h2>
            <Link href="/dashboard/orders" className="ml-auto text-teal-600 text-sm font-medium">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-left">
                  <Th>Order</Th><Th>Buyer</Th><Th>Total</Th><Th>Status</Th><Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {ordersQ.isLoading && <tr><td colSpan={5} className="px-4 py-6 text-stone-500">Loading orders…</td></tr>}
                {ordersQ.isError && <tr><td colSpan={5} className="px-4 py-6 text-red-700">Could not load orders. <button onClick={() => ordersQ.refetch()} className="underline">Try again</button></td></tr>}
                {(ordersQ.data ?? []).map((o) => (
                  <tr key={o.id} className="border-t border-stone-100">
                    <Td>
                      <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-stone-700 hover:text-teal-600">
                        {o.id.slice(0, 8)}
                      </Link>
                    </Td>
                    <Td>{o.customer_name}</Td>
                    <Td className="font-medium">{formatBDT(o.total_bdt, locale)}</Td>
                    <Td><Badge tone={statusTone(o.status)}>{prettyOrderStatus(o.status)}</Badge></Td>
                    <Td className="text-stone-500">{formatDateTime(o.created_at, locale)}</Td>
                  </tr>
                ))}
                {!ordersQ.isLoading && !ordersQ.isError && (ordersQ.data?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                      No orders yet. Once customers check out, they&rsquo;ll show up here.
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

function ActionCard({
  href,
  count,
  title,
  description,
  cta,
  urgent = false,
  warn = false,
  hideIfZero = false,
}: {
  href: string;
  count: number | undefined;
  title: string;
  description: string;
  cta: string;
  urgent?: boolean;
  warn?: boolean;
  hideIfZero?: boolean;
}) {
  if (hideIfZero && (count ?? 0) === 0) return null;
  return (
    <Link href={href} className="block group">
      <Card className="p-4 group-hover:border-teal-600 transition-colors" hover={false}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${urgent ? 'text-red-700' : warn ? 'text-amber-700' : 'text-stone-900'}`}>
                {count ?? '—'}
              </span>
              <span className="text-sm font-medium text-stone-700">{title}</span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">{description}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-teal-700 font-medium opacity-60 group-hover:opacity-100 mt-1">
            {cta} <IcChevR size={12} />
          </span>
        </div>
      </Card>
    </Link>
  );
}

function MoneyCard({
  title,
  primary,
  secondary,
  accent,
  tooltip,
}: {
  title: string;
  primary: string;
  secondary: string;
  accent: string;
  tooltip: string;
}) {
  return (
    <Card className="p-4" hover={false}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">{title}</div>
        <span className="text-stone-300 text-xs cursor-help" title={tooltip}>ⓘ</span>
      </div>
      <div className={`text-2xl font-bold tracking-tight ${accent}`}>{primary}</div>
      {secondary && <div className="text-xs text-stone-500 mt-0.5">{secondary}</div>}
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>{children}</td>;
}
