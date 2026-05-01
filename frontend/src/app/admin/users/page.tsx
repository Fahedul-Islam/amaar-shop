'use client';
import { useCallback, useEffect, useState } from 'react';
import { listUsers, type AdminUserRow } from '@/lib/adminApi';
import { formatBDT, formatNumber, formatDate } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, StatusBadge, Tab,
  Pagination, Spinner, EmptyState,
} from '../ui';
import { IcSearch } from '@/components/icons/Icons';

type TabKey = 'all' | 'owner' | 'admin' | 'customer';

const TAB_TO_ROLE: Record<TabKey, string> = {
  all: '',
  owner: 'owner',
  admin: 'admin',
  customer: 'customer',
};

const PAGE_SIZE = 25;

function userRoleLabel(u: AdminUserRow): string {
  if (u.is_admin) return 'admin';
  if (u.is_owner) return 'owner';
  return 'customer';
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, owner: 0, admin: 0, customer: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [main, allCount, ownerCount, adminCount, customerCount] = await Promise.all([
        listUsers({ role: TAB_TO_ROLE[tab], q, page, page_size: PAGE_SIZE }),
        listUsers({ role: '', page: 1, page_size: 1 }),
        listUsers({ role: 'owner', page: 1, page_size: 1 }),
        listUsers({ role: 'admin', page: 1, page_size: 1 }),
        listUsers({ role: 'customer', page: 1, page_size: 1 }),
      ]);
      setRows(main.data);
      setTotal(main.pagination.total);
      setCounts({
        all: allCount.pagination.total,
        owner: ownerCount.pagination.total,
        admin: adminCount.pagination.total,
        customer: customerCount.pagination.total,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
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
      <PageHeader title="Users" crumbs={['Home', 'Marketplace', 'Users']} />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        <SectionCard padBody={false}>
          <div className="flex items-center border-b border-stone-200 px-4 pt-1 flex-wrap">
            <Tab label="All users" badge={counts.all} active={tab === 'all'} onClick={() => { setTab('all'); setPage(1); }} />
            <Tab label="Shop owners" badge={counts.owner} active={tab === 'owner'} onClick={() => { setTab('owner'); setPage(1); }} />
            <Tab label="Admins" badge={counts.admin} active={tab === 'admin'} onClick={() => { setTab('admin'); setPage(1); }} />
            <Tab label="Customers" badge={counts.customer} active={tab === 'customer'} onClick={() => { setTab('customer'); setPage(1); }} />
            <form onSubmit={onSearchSubmit} className="ml-auto flex items-center my-2">
              <div className="flex items-center gap-2 px-2.5 h-8 bg-stone-100 rounded-md text-stone-500">
                <IcSearch size={13} />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Email…"
                  className="bg-transparent border-0 outline-none text-xs w-44 text-stone-900"
                />
              </div>
            </form>
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState message="No users match your filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">User</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Role</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Orders</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-right">Revenue</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const role = userRoleLabel(u);
                    return (
                      <tr key={u.id} className="border-t border-stone-100 hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 grid place-items-center font-semibold text-xs">
                              {u.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-stone-900">{u.email}</div>
                              <div className="text-xs text-stone-500 font-mono">{u.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={role}>{role}</StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          {u.shop_name ? (
                            <span className="text-stone-700">{u.shop_name}</span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {u.order_count > 0 ? formatNumber(u.order_count) : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {Number(u.spent_bdt) > 0 ? formatBDT(u.spent_bdt) : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {u.created_at ? formatDate(u.created_at) : '—'}
                        </td>
                      </tr>
                    );
                  })}
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
