'use client';
import { useCallback, useEffect, useState } from 'react';
import { listOrders, type AdminOrderRow } from '@/lib/adminApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, ShopMark, StatusBadge, Tab,
  Pagination, Spinner, EmptyState,
} from '../ui';
import { IcSearch } from '@/components/icons/Icons';

type TabKey = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

const TAB_TO_STATUS: Record<TabKey, string> = {
  all: '',
  pending: 'pending',
  confirmed: 'confirmed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

const PAGE_SIZE = 25;

export default function AdminOrdersPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<TabKey, number>>({
    all: 0, pending: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const main = await listOrders({ status: TAB_TO_STATUS[tab], q, page, page_size: PAGE_SIZE });
      setRows(main.data);
      setTotal(main.pagination.total);

      const tabs: TabKey[] = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      const results = await Promise.all(
        tabs.map((t) =>
          listOrders({ status: TAB_TO_STATUS[t], page: 1, page_size: 1 })
            .then((r) => [t, r.pagination.total] as const),
        ),
      );
      setCounts(Object.fromEntries(results) as Record<TabKey, number>);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [tab, page, q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  return (
    <>
      <PageHeader title="Orders" crumbs={['Home', 'Marketplace', 'Orders']} />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        <SectionCard padBody={false}>
          <div className="flex items-center border-b border-stone-200 px-4 pt-1 flex-wrap">
            <Tab label="All" badge={counts.all} active={tab === 'all'} onClick={() => { setTab('all'); setPage(1); }} />
            <Tab label="Pending" badge={counts.pending} active={tab === 'pending'} onClick={() => { setTab('pending'); setPage(1); }} />
            <Tab label="Confirmed" badge={counts.confirmed} active={tab === 'confirmed'} onClick={() => { setTab('confirmed'); setPage(1); }} />
            <Tab label="Shipped" badge={counts.shipped} active={tab === 'shipped'} onClick={() => { setTab('shipped'); setPage(1); }} />
            <Tab label="Delivered" badge={counts.delivered} active={tab === 'delivered'} onClick={() => { setTab('delivered'); setPage(1); }} />
            <Tab label="Cancelled" badge={counts.cancelled} active={tab === 'cancelled'} onClick={() => { setTab('cancelled'); setPage(1); }} />
            <form onSubmit={onSearchSubmit} className="ml-auto flex items-center my-2">
              <div className="flex items-center gap-2 px-2.5 h-8 bg-stone-100 rounded-md text-stone-500">
                <IcSearch size={13} />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Customer, phone, shop…"
                  className="bg-transparent border-0 outline-none text-xs w-52 text-stone-900"
                />
              </div>
            </form>
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState message="No orders match your filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Order</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Buyer</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Ship to</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Total</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3 font-mono text-xs text-stone-700">
                        #{o.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-stone-900">{o.customer_name}</div>
                        <div className="text-xs text-stone-500">{o.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShopMark name={o.shop_name} size={22} />
                          <span>{o.shop_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{o.delivery_area || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatBDT(o.total_bdt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={o.status}>
                          {o.status[0].toUpperCase() + o.status.slice(1)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {o.created_at ? formatDateTime(o.created_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </SectionCard>
      </PageBody>
    </>
  );
}
