'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge, statusTone } from '@/components/ui/Badge';
import { listOrders } from '@/lib/orderApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

const tabs = ['All', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function OrdersPage() {
  const { locale } = useI18n();
  const [tab, setTab] = useState('All');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', tab],
    queryFn: () => listOrders({ status: tab === 'All' ? undefined : tab, page_size: 100 }),
  });

  return (
    <div className="px-6 md:px-8 py-6 md:py-7">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Orders</h1>
      <p className="text-stone-500 mt-1 mb-4">Manage incoming orders across all zones.</p>

      <div className="flex gap-1.5 mb-4 overflow-auto no-scrollbar">
        {tabs.map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors capitalize ${
                on ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden" hover={false}>
        {isLoading ? (
          <div className="p-8 text-center text-stone-500 text-sm">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-stone-500 text-sm">No orders in this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-left">
                  <Th>Order</Th><Th>Buyer</Th><Th>Items</Th><Th>Total</Th><Th>Zone</Th><Th>Status</Th><Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-stone-100 hover:bg-stone-50">
                    <Td>
                      <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-stone-700 hover:text-teal-600">
                        {o.id.slice(0, 8)}
                      </Link>
                    </Td>
                    <Td>
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-[11px] text-stone-500">{o.customer_phone}</div>
                    </Td>
                    <Td>{o.items.length}</Td>
                    <Td className="font-semibold">{formatBDT(o.total_bdt, locale)}</Td>
                    <Td className="text-stone-600">{o.delivery_area}</Td>
                    <Td><Badge tone={statusTone(o.status)}>{o.status}</Badge></Td>
                    <Td className="text-stone-500">{formatDateTime(o.created_at, locale)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>{children}</td>;
}
