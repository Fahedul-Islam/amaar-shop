'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { IcFacebook, IcPlus } from '@/components/icons/Icons';
import { getTodayStats, getTopProducts } from '@/lib/analyticsApi';
import { listOrders } from '@/lib/orderApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import { useShop } from '@/hooks/useShop';
import { useI18n } from '@/hooks/useI18n';

export default function DashboardHomePage() {
  const { shop } = useShop();
  const { locale } = useI18n();

  const todayQ = useQuery({ queryKey: ['stats-today'], queryFn: getTodayStats });
  const ordersQ = useQuery({ queryKey: ['orders-recent'], queryFn: () => listOrders({ page_size: 5 }) });
  const topQ = useQuery({ queryKey: ['top-products'], queryFn: getTopProducts });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-6xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">
            {greeting}{shop ? `, ${shop.name}` : ''}
          </h1>
          <p className="text-stone-500 mt-1">Here&rsquo;s how your shop is doing today.</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button variant="primary"><IcPlus size={16} /> Add product</Button>
        </Link>
      </div>

      <div className="grid gap-3.5 mb-7 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <StatCard
          label={locale === 'bn' ? 'আজকের অর্ডার' : 'Orders · today'}
          value={todayQ.data?.total_orders ?? '—'}
        />
        <StatCard
          label={locale === 'bn' ? 'পেন্ডিং' : 'Pending'}
          value={todayQ.data?.pending_orders ?? '—'}
        />
        <StatCard
          label={locale === 'bn' ? 'আজকের আয়' : 'Revenue · today'}
          value={todayQ.data ? formatBDT(todayQ.data.revenue_bdt, locale) : '—'}
        />
        <StatCard
          label={locale === 'bn' ? 'দোকানের URL' : 'Shop URL'}
          value={shop ? `/s/${shop.slug}` : '—'}
          small
        />
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
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
                        #{o.id.slice(0, 8)}
                      </Link>
                    </Td>
                    <Td>{o.customer_name}</Td>
                    <Td className="font-medium">{formatBDT(o.total_bdt, locale)}</Td>
                    <Td><Badge tone={statusTone(o.status)}>{o.status}</Badge></Td>
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
          <Card className="p-5 bg-gradient-to-b from-teal-50 to-white" hover={false}>
            <div className="flex items-center gap-2 text-teal-700 mb-2">
              <IcFacebook size={18} />
              <span className="text-xs font-medium uppercase tracking-wider">Next step</span>
            </div>
            <h3 className="text-base font-semibold mb-1.5">Connect your Facebook page</h3>
            <p className="text-sm text-stone-600 mb-3 leading-relaxed">
              Turn your page&rsquo;s &ldquo;Shop Now&rdquo; button into a link to your AmaarShop.
            </p>
            <Link href="/dashboard/facebook">
              <Button variant="primary" size="sm">Start guide →</Button>
            </Link>
          </Card>

          <Card className="p-5" hover={false}>
            <h3 className="text-sm font-semibold mb-2.5">Top products · this week</h3>
            {(topQ.data ?? []).slice(0, 3).map((p) => (
              <div key={p.product_id} className="flex gap-2.5 py-2 border-t border-stone-100">
                <div className="flex-1 text-sm">
                  <div className="font-medium text-stone-900">{p.product_name}</div>
                  <div className="text-stone-500 text-xs">{p.total_quantity} sold</div>
                </div>
                <div className="text-sm font-medium">{formatBDT(p.total_revenue_bdt, locale)}</div>
              </div>
            ))}
            {(!topQ.data || topQ.data.length === 0) && (
              <div className="text-sm text-stone-500 py-3">No sales data yet.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <Card className="p-4" hover={false}>
      <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">{label}</div>
      <div className={`${small ? 'text-base font-mono' : 'text-[28px]'} font-bold tracking-tight mt-1.5 text-stone-900 truncate`}>
        {value}
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>{children}</td>;
}
