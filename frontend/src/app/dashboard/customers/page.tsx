'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { SegmentBadge } from '@/components/ui/SegmentBadge';
import { IcChevR, IcSearch, IcUser } from '@/components/icons/Icons';
import {
  type CustomerSegment,
  type CustomerSort,
  getCustomerAnalytics,
  listCustomers,
} from '@/lib/customerApi';
import { formatBDT, formatDate } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

const SEGMENT_TABS: { key: 'all' | CustomerSegment; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'vip', label: 'VIP' },
  { key: 'returning', label: 'Returning' },
  { key: 'new', label: 'New' },
  { key: 'inactive', label: 'Inactive' },
];

const SORT_OPTIONS: { key: CustomerSort; label: string }[] = [
  { key: 'recent', label: 'Most recent' },
  { key: 'spent', label: 'Highest value' },
  { key: 'orders', label: 'Most orders' },
  { key: 'name', label: 'Name A–Z' },
];

export default function CustomersPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const [tab, setTab] = useState<'all' | CustomerSegment>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<CustomerSort>('recent');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const analyticsQ = useQuery({
    queryKey: ['customer-analytics'],
    queryFn: getCustomerAnalytics,
  });
  const listQ = useQuery({
    queryKey: ['customers', tab, debouncedSearch, sort],
    queryFn: () =>
      listCustomers({
        segment: tab === 'all' ? undefined : tab,
        search: debouncedSearch || undefined,
        sort,
        limit: 100,
      }),
  });

  const a = analyticsQ.data;
  const customers = listQ.data?.items ?? [];

  return (
    <div className="px-6 md:px-8 py-6 md:py-7">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Customers</h1>
      <p className="text-stone-500 mt-1 mb-5">All buyers from your shop, grouped by phone number.</p>

      <div className="grid gap-3.5 mb-6 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        <SummaryStat
          label="Total customers"
          value={a ? String(a.total_customers) : '—'}
          accent="text-stone-900"
          subtitle={a ? `${a.repeat_purchase_rate}% return rate` : ''}
        />
        <SummaryStat
          label="VIP"
          value={a ? String(a.vip_count) : '—'}
          accent="text-amber-700"
          subtitle="Top spenders"
        />
        <SummaryStat
          label="Returning"
          value={a ? String(a.returning_count) : '—'}
          accent="text-teal-700"
          subtitle="Bought 2+ times"
        />
        <SummaryStat
          label="New"
          value={a ? String(a.new_count) : '—'}
          accent="text-sky-700"
          subtitle="Last 30 days"
        />
        <SummaryStat
          label="Inactive"
          value={a ? String(a.inactive_count) : '—'}
          accent="text-stone-500"
          subtitle="Re-engage them"
        />
        <SummaryStat
          label="Avg lifetime value"
          value={a ? formatBDT(a.avg_lifetime_bdt, locale) : '—'}
          accent="text-stone-900"
          subtitle="Per customer"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {SEGMENT_TABS.map((t) => {
          const on = tab === t.key;
          const count =
            t.key === 'all'
              ? a?.total_customers
              : t.key === 'vip'
                ? a?.vip_count
                : t.key === 'returning'
                  ? a?.returning_count
                  : t.key === 'new'
                    ? a?.new_count
                    : a?.inactive_count;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                on ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t.label}
              {count != null && (
                <span className={`ml-1.5 ${on ? 'text-teal-100' : 'text-stone-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <IcSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as CustomerSort)}
          className="h-9 px-3 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      <Card className="p-0 overflow-hidden" hover={false}>
        {listQ.isLoading ? (
          <div className="p-8 text-center text-stone-500 text-sm">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center text-stone-500">
            <IcUser size={28} className="mx-auto mb-2 text-stone-300" />
            <div className="text-sm font-medium text-stone-700 mb-1">
              {debouncedSearch ? 'No matches' : 'No customers yet'}
            </div>
            <div className="text-xs">
              {debouncedSearch
                ? 'Try a different name or phone number.'
                : 'Once buyers place orders, they\'ll appear here.'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-left">
                  <Th>Customer</Th>
                  <Th>Segment</Th>
                  <Th>Orders</Th>
                  <Th>Total spent</Th>
                  <Th>Avg order</Th>
                  <Th>Last order</Th>
                  <Th>{''}</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.normalized_phone}
                    onClick={() =>
                      router.push(`/dashboard/customers/${encodeURIComponent(c.normalized_phone)}`)
                    }
                    className="border-t border-stone-100 cursor-pointer hover:bg-teal-50/60 group"
                  >
                    <Td>
                      <div className="font-medium text-stone-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 grid place-items-center text-xs font-semibold">
                          {c.name.charAt(0).toUpperCase() || '?'}
                        </span>
                        <span>
                          <span className="block">{c.name}</span>
                          <span className="block text-[11px] text-stone-500">{c.display_phone}</span>
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <SegmentBadge segment={c.segment} size="sm" />
                    </Td>
                    <Td className="font-medium">{c.total_orders}</Td>
                    <Td className="font-semibold">{formatBDT(c.total_spent_bdt, locale)}</Td>
                    <Td className="text-stone-600">{formatBDT(c.avg_order_bdt, locale)}</Td>
                    <Td className="text-stone-500">
                      {c.last_order_at ? formatDate(c.last_order_at, locale) : '—'}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-colors whitespace-nowrap">
                        View <IcChevR size={12} />
                      </span>
                    </Td>
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

function SummaryStat({
  label,
  value,
  accent,
  subtitle,
}: {
  label: string;
  value: string;
  accent: string;
  subtitle: string;
}) {
  return (
    <Card className="p-4" hover={false}>
      <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold tracking-tight mt-1.5 ${accent}`}>{value}</div>
      {subtitle && <div className="text-[11px] text-stone-500 mt-0.5">{subtitle}</div>}
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>{children}</td>;
}
