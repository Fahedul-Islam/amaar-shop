'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { IcChevR, IcFacebook, IcPlus } from '@/components/icons/Icons';
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
  const totalActions =
    (s?.pending_orders_count ?? 0) +
    (s?.awaiting_advance_count ?? 0) +
    (s?.out_of_stock_count ?? 0) +
    (s?.low_stock_count ?? 0) +
    (s?.unanswered_reviews_count ?? 0);

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-6xl">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">
            {greeting}{shop ? `, ${shop.name}` : ''}
          </h1>
          <p className="text-stone-500 mt-1">
            {totalActions === 0 && s
              ? "You're all caught up — nothing needs your attention right now."
              : `You have ${totalActions} thing${totalActions === 1 ? '' : 's'} to take care of today.`}
          </p>
        </div>
        <Link href="/dashboard/products/new">
          <Button variant="primary"><IcPlus size={16} /> Add product</Button>
        </Link>
      </div>

      {/* Today's tasks — actionable items */}
      <section className="mb-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Today's tasks
        </h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href="/dashboard/orders?status=pending"
            count={s?.pending_orders_count}
            urgent={(s?.pending_orders_count ?? 0) > 0}
            title="Confirm new orders"
            description="Buyers waiting for you to confirm"
            cta="Review"
            icon="📦"
          />
          <ActionCard
            href="/dashboard/orders"
            count={s?.awaiting_advance_count}
            urgent={(s?.awaiting_advance_count ?? 0) > 0}
            title="Advance payment due"
            description="Orders waiting on customer payment"
            cta="View"
            icon="💸"
            hideIfZero
          />
          <ActionCard
            href="/dashboard/products?stock=out"
            count={s?.out_of_stock_count}
            urgent={(s?.out_of_stock_count ?? 0) > 0}
            title="Out of stock"
            description="Products buyers can't order"
            cta="Restock"
            icon="🚫"
            hideIfZero
          />
          <ActionCard
            href="/dashboard/products?stock=low"
            count={s?.low_stock_count}
            warn={(s?.low_stock_count ?? 0) > 0}
            title="Running low (≤ 5)"
            description="Reorder before they run out"
            cta="Review"
            icon="⚠️"
            hideIfZero
          />
          <ActionCard
            href="/dashboard/reviews"
            count={s?.unanswered_reviews_count}
            warn={(s?.unanswered_reviews_count ?? 0) > 0}
            title="New reviews to reply"
            description="Customers who left feedback"
            cta="Reply"
            icon="⭐"
            hideIfZero
          />
          {totalActions === 0 && s && (
            <Card className="p-5 sm:col-span-2 lg:col-span-3 bg-emerald-50 border-emerald-200" hover={false}>
              <div className="flex items-center gap-3">
                <div className="text-2xl">🎉</div>
                <div>
                  <div className="font-semibold text-emerald-900">All caught up</div>
                  <div className="text-sm text-emerald-700">
                    No pending orders, low stock, or unanswered reviews. Great work!
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Today's money */}
      <section className="mb-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3">
          Money flow
        </h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <MoneyCard
            title="Today's earnings"
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

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
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
                {!ordersQ.isLoading && (ordersQ.data?.length ?? 0) === 0 && (
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

        <div className="flex flex-col gap-4">
          {/* Low-stock list */}
          {s && s.low_stock_products.length > 0 && (
            <Card className="p-5" hover={false}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Reorder these soon</h3>
                <Link href="/dashboard/products" className="text-xs text-teal-600 font-medium">All →</Link>
              </div>
              <div className="flex flex-col gap-1">
                {s.low_stock_products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/products/${p.id}`}
                    className="flex items-center justify-between gap-2 py-2 px-2 -mx-2 rounded-md hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-stone-500">{formatBDT(p.price_bdt, locale)}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      p.stock === 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {p.stock === 0 ? 'Out' : `${p.stock} left`}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Facebook setup nudge */}
          {shop && (
            <Card className="p-5 bg-gradient-to-b from-teal-50 to-white" hover={false}>
              <div className="flex items-center gap-2 text-teal-700 mb-2">
                <IcFacebook size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Tip</span>
              </div>
              <h3 className="text-base font-semibold mb-1.5">Connect your Facebook page</h3>
              <p className="text-sm text-stone-600 mb-3 leading-relaxed">
                Turn your page&rsquo;s &ldquo;Shop Now&rdquo; button into a link to your AmaarShop.
              </p>
              <Link href="/dashboard/facebook">
                <Button variant="primary" size="sm">Start guide →</Button>
              </Link>
            </Card>
          )}
        </div>
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
  icon,
  urgent = false,
  warn = false,
  hideIfZero = false,
}: {
  href: string;
  count: number | undefined;
  title: string;
  description: string;
  cta: string;
  icon: string;
  urgent?: boolean;
  warn?: boolean;
  hideIfZero?: boolean;
}) {
  if (hideIfZero && (count ?? 0) === 0) return null;
  const ring = urgent
    ? 'border-l-4 border-l-red-500'
    : warn
      ? 'border-l-4 border-l-amber-500'
      : 'border-l-4 border-l-stone-200';
  return (
    <Link href={href} className="block group">
      <Card className={`p-4 group-hover:shadow-sm transition-shadow ${ring}`} hover={false}>
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none mt-0.5">{icon}</div>
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
