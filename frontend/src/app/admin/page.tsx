'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOverview, type AdminOverview } from '@/lib/adminApi';
import { formatBDT, formatNumber, formatDate } from '@/lib/format';
import { PageHeader, PageBody, StatTile, SectionCard, ShopMark, StatusBadge, Spinner, EmptyState } from './ui';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load overview'));
  }, []);

  return (
    <>
      <PageHeader title="Platform overview" crumbs={['Home']} />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        {!data && !error && <Spinner />}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <StatTile
                label="GMV · 30d"
                value={formatBDT(data.stats.gmv_30d)}
                sub="all-time: " accent="#0D9488"
              />
              <StatTile
                label="Orders · today"
                value={formatNumber(data.stats.orders_today)}
                sub={`${formatNumber(data.stats.pending_orders)} pending`}
              />
              <StatTile
                label="Active shops"
                value={formatNumber(data.stats.active_shops)}
                sub={`${formatNumber(data.stats.suspended_shops)} suspended`}
              />
              <StatTile
                label="Total users"
                value={formatNumber(data.stats.total_users)}
                sub={`${formatNumber(data.stats.new_shops_7d)} new shops · 7d`}
              />
              <StatTile
                label="Live products"
                value={formatNumber(data.stats.total_products)}
                sub={`across ${formatNumber(data.stats.total_shops)} shops`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard
                title="Top shops · 30d"
                action={
                  <Link href="/admin/shops" className="text-teal-600 text-sm font-medium hover:text-teal-700">
                    View all →
                  </Link>
                }
                padBody={false}
              >
                {data.top_shops.length === 0 ? (
                  <EmptyState message="No shops yet." />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 text-left">
                        <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider">Shop</th>
                        <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-right">Orders</th>
                        <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_shops.map((s, i) => (
                        <tr key={s.id} className="border-t border-stone-100">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-4 text-stone-400 text-xs tabular-nums">{i + 1}</span>
                              <ShopMark name={s.name} size={28} />
                              <Link
                                href={`/admin/shops`}
                                className="font-medium text-stone-900 hover:text-teal-700"
                              >
                                {s.name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatNumber(s.order_count)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {s.revenue_bdt && Number(s.revenue_bdt) > 0 ? formatBDT(s.revenue_bdt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </SectionCard>

              <SectionCard title="New shops · this week">
                {data.recent_shops.length === 0 ? (
                  <EmptyState message="No recent shops." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.recent_shops.map((s) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <ShopMark name={s.name} size={36} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-900 truncate">{s.name}</div>
                          <div className="text-xs text-stone-500 truncate">
                            {s.owner_email} · {formatDate(s.created_at)}
                          </div>
                        </div>
                        <StatusBadge tone={s.is_suspended ? 'suspended' : 'active'}>
                          {s.is_suspended ? 'Suspended' : 'Active'}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
