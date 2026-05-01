'use client';
import { useCallback, useEffect, useState } from 'react';
import { listProducts, setProductActive, type AdminProductRow } from '@/lib/adminApi';
import { formatBDT, formatNumber } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, ShopMark, StatusBadge, Tab,
  Pagination, Spinner, EmptyState,
} from '../ui';
import { Button } from '@/components/ui/Button';
import { IcSearch } from '@/components/icons/Icons';

type TabKey = 'all' | 'live' | 'hidden';

const TAB_TO_STATUS: Record<TabKey, string> = {
  all: '',
  live: 'live',
  hidden: 'hidden',
};

const PAGE_SIZE = 25;

export default function AdminProductsPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, live: 0, hidden: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [main, allCount, liveCount, hiddenCount] = await Promise.all([
        listProducts({ status: TAB_TO_STATUS[tab], q, page, page_size: PAGE_SIZE }),
        listProducts({ status: '', page: 1, page_size: 1 }),
        listProducts({ status: 'live', page: 1, page_size: 1 }),
        listProducts({ status: 'hidden', page: 1, page_size: 1 }),
      ]);
      setRows(main.data);
      setTotal(main.pagination.total);
      setCounts({
        all: allCount.pagination.total,
        live: liveCount.pagination.total,
        hidden: hiddenCount.pagination.total,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [tab, page, q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleActive = async (p: AdminProductRow) => {
    const next = !p.is_active;
    setBusyId(p.id);
    try {
      await setProductActive(p.id, next);
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
      <PageHeader title="Product moderation" crumbs={['Home', 'Marketplace', 'Products']} />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        <SectionCard padBody={false}>
          <div className="flex items-center border-b border-stone-200 px-4 pt-1 flex-wrap">
            <Tab label="All" badge={counts.all} active={tab === 'all'} onClick={() => { setTab('all'); setPage(1); }} />
            <Tab label="Live" badge={counts.live} active={tab === 'live'} onClick={() => { setTab('live'); setPage(1); }} />
            <Tab label="Hidden" badge={counts.hidden} active={tab === 'hidden'} onClick={() => { setTab('hidden'); setPage(1); }} />
            <form onSubmit={onSearchSubmit} className="ml-auto flex items-center my-2">
              <div className="flex items-center gap-2 px-2.5 h-8 bg-stone-100 rounded-md text-stone-500">
                <IcSearch size={13} />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Product or shop…"
                  className="bg-transparent border-0 outline-none text-xs w-44 text-stone-900"
                />
              </div>
            </form>
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState message="No products match your filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Product</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Price</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Stock</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-md bg-stone-100 overflow-hidden flex-shrink-0 grid place-items-center text-xs text-stone-400">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-stone-900 line-clamp-1">{p.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShopMark name={p.shop_name} size={22} />
                          <span>{p.shop_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatBDT(p.price_bdt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={p.stock < 10 ? 'text-amber-700' : 'text-stone-900'}>
                          {formatNumber(p.stock)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={p.is_active ? 'live' : 'hidden'}>
                          {p.is_active ? 'Live' : 'Hidden'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={p.is_active ? 'danger' : 'neutral'}
                          disabled={busyId === p.id}
                          onClick={() => toggleActive(p)}
                        >
                          {busyId === p.id ? '…' : p.is_active ? 'Hide' : 'Show'}
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
