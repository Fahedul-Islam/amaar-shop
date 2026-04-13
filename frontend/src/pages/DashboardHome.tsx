import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShop } from '@/hooks/useShop';
import { getTodayStats, getTopProducts, getRangeStats } from '@/lib/analyticsApi';
import { listOrders } from '@/lib/orderApi';
import type { TodayStats, TopProduct, DayStat } from '@/lib/analyticsApi';
import type { Order } from '@/lib/orderApi';

export default function DashboardHome() {
  const { t } = useTranslation();
  const { shop } = useShop();

  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [weekRevenue, setWeekRevenue] = useState<string>('0.00');
  const [monthRevenue, setMonthRevenue] = useState<string>('0.00');
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 29);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    Promise.allSettled([
      getTodayStats(),
      getRangeStats(fmt(weekAgo), fmt(now)),
      getRangeStats(fmt(monthAgo), fmt(now)),
      listOrders({ status: 'pending', page_size: 5 }),
      getTopProducts(),
    ]).then(([todayRes, weekRes, monthRes, pendingRes, topRes]) => {
      if (todayRes.status === 'fulfilled') setTodayStats(todayRes.value);
      if (weekRes.status === 'fulfilled') {
        const total = (weekRes.value as DayStat[]).reduce((sum, d) => sum + parseFloat(d.revenue_bdt || '0'), 0);
        setWeekRevenue(total.toFixed(2));
      }
      if (monthRes.status === 'fulfilled') {
        const total = (monthRes.value as DayStat[]).reduce((sum, d) => sum + parseFloat(d.revenue_bdt || '0'), 0);
        setMonthRevenue(total.toFixed(2));
      }
      if (pendingRes.status === 'fulfilled') setPendingOrders(pendingRes.value as Order[]);
      if (topRes.status === 'fulfilled') setTopProducts(topRes.value as TopProduct[]);
      setLoading(false);
    });
  }, [shop]);

  if (!shop) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('dashboard')}</h2>
        <Link
          to="/dashboard/analytics"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {t('analytics.view_analytics')} &rarr;
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t('analytics.orders_today')}
          value={String(todayStats?.total_orders ?? 0)}
          color="blue"
        />
        <StatCard
          label={t('analytics.pending')}
          value={String(todayStats?.pending_orders ?? 0)}
          color="yellow"
        />
        <StatCard
          label={t('analytics.revenue_today')}
          value={`\u09F3${todayStats?.revenue_bdt ?? '0.00'}`}
          color="green"
        />
        <StatCard
          label={t('analytics.revenue_week')}
          value={`\u09F3${weekRevenue}`}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Orders Quick List */}
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">{t('analytics.pending_orders')}</h3>
            <Link
              to="/dashboard/orders?status=pending"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              {t('analytics.view_all')}
            </Link>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="text-sm text-gray-400">{t('analytics.no_pending')}</p>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{order.customer_name}</p>
                    <p className="text-xs text-gray-500">{order.customer_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary-700">{'\u09F3'}{order.total_bdt}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 Products This Month */}
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">{t('analytics.top_products')}</h3>
            <span className="text-xs text-gray-400">{t('analytics.this_month')}</span>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">{t('analytics.no_data')}</p>
          ) : (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((p, i) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.product_name}</p>
                    <p className="text-xs text-gray-500">{p.total_quantity} {t('analytics.sold')}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{'\u09F3'}{p.total_revenue_bdt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Summary Row */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('analytics.revenue_week')}</p>
          <p className="text-2xl font-bold text-gray-900">{'\u09F3'}{weekRevenue}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('analytics.revenue_month')}</p>
          <p className="text-2xl font-bold text-gray-900">{'\u09F3'}{monthRevenue}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-80 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
