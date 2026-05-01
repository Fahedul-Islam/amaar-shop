'use client';
import { useCallback, useEffect, useState } from 'react';
import { listShops, setShopSuspended, type AdminShopRow } from '@/lib/adminApi';
import { formatBDT, formatNumber, formatDate } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, ShopMark, StatusBadge, Tab,
  Pagination, Spinner, EmptyState,
} from '../ui';
import { Button } from '@/components/ui/Button';
import { IcSearch } from '@/components/icons/Icons';

type TabKey = 'all' | 'active' | 'suspended';

const TAB_TO_STATUS: Record<TabKey, string> = {
  all: '',
  active: 'active',
  suspended: 'suspended',
};

const PAGE_SIZE = 25;

export default function AdminShopsPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<AdminShopRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, active: 0, suspended: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [main, allCount, activeCount, suspendedCount] = await Promise.all([
        listShops({ status: TAB_TO_STATUS[tab], q, page, page_size: PAGE_SIZE }),
        listShops({ status: '', page: 1, page_size: 1 }),
        listShops({ status: 'active', page: 1, page_size: 1 }),
        listShops({ status: 'suspended', page: 1, page_size: 1 }),
      ]);
      setRows(main.data);
      setTotal(main.pagination.total);
      setCounts({
        all: allCount.pagination.total,
        active: activeCount.pagination.total,
        suspended: suspendedCount.pagination.total,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shops');
    } finally {
      setLoading(false);
    }
  }, [tab, page, q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleSuspend = async (shop: AdminShopRow) => {
    const next = !shop.is_suspended;
    const action = next ? 'suspend' : 'unsuspend';
    if (!confirm(`Are you sure you want to ${action} "${shop.name}"?`)) return;
    setBusyId(shop.id);
    try {
      await setShopSuspended(shop.id, next);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  return (
    <>
      <PageHeader
        title="Shops"
        crumbs={['Home', 'Marketplace', 'Shops']}
      />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        <SectionCard padBody={false}>
          <div className="flex items-center border-b border-stone-200 px-4 pt-1 flex-wrap">
            <Tab label="All shops" badge={counts.all} active={tab === 'all'} onClick={() => { setTab('all'); setPage(1); }} />
            <Tab label="Active" badge={counts.active} active={tab === 'active'} onClick={() => { setTab('active'); setPage(1); }} />
            <Tab label="Suspended" badge={counts.suspended} active={tab === 'suspended'} onClick={() => { setTab('suspended'); setPage(1); }} />
            <form onSubmit={onSearchSubmit} className="ml-auto flex items-center my-2">
              <div className="flex items-center gap-2 px-2.5 h-8 bg-stone-100 rounded-md text-stone-500">
                <IcSearch size={13} />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search shops…"
                  className="bg-transparent border-0 outline-none text-xs w-44 text-stone-900"
                />
              </div>
            </form>
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState message="No shops match your filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Products</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Orders</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Revenue</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Created</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <ShopMark name={s.name} />
                          <div>
                            <div className="font-medium text-stone-900">{s.name}</div>
                            <div className="text-xs text-stone-500">{s.owner_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={s.is_suspended ? 'suspended' : 'active'}>
                          {s.is_suspended ? 'Suspended' : 'Active'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(s.product_count)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(s.order_count)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {Number(s.revenue_bdt) > 0 ? formatBDT(s.revenue_bdt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={s.is_suspended ? 'neutral' : 'danger'}
                          disabled={busyId === s.id}
                          onClick={() => toggleSuspend(s)}
                        >
                          {busyId === s.id ? '…' : s.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </Button>
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
