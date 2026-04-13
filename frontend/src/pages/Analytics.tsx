import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getRangeStats, getTopProducts } from '@/lib/analyticsApi';
import type { DayStat, TopProduct } from '@/lib/analyticsApi';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: formatDate(from), to: formatDate(to) };
}

export default function Analytics() {
  const { t } = useTranslation();
  const defaults = defaultRange();

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [rangeData, setRangeData] = useState<DayStat[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [range, top] = await Promise.all([
        getRangeStats(from, to),
        getTopProducts(),
      ]);
      setRangeData(range);
      setTopProducts(top);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quick range buttons
  const setQuickRange = (days: number) => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - (days - 1));
    setFrom(formatDate(fromDate));
    setTo(formatDate(toDate));
  };

  // Chart data with numeric revenue for Recharts
  const chartData = rangeData.map((d) => ({
    date: d.date.slice(5), // MM-DD
    fullDate: d.date,
    orders: d.orders,
    revenue: parseFloat(d.revenue_bdt || '0'),
  }));

  const totalOrders = rangeData.reduce((sum, d) => sum + d.orders, 0);
  const totalRevenue = rangeData.reduce((sum, d) => sum + parseFloat(d.revenue_bdt || '0'), 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('analytics.title')}</h2>

      {/* Date Range Picker */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('analytics.from')}</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('analytics.to')}</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <QuickButton label={t('analytics.7d')} onClick={() => setQuickRange(7)} />
            <QuickButton label={t('analytics.30d')} onClick={() => setQuickRange(30)} />
            <QuickButton label={t('analytics.90d')} onClick={() => setQuickRange(90)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('analytics.total_orders_range')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('analytics.total_revenue_range')}</p>
              <p className="text-2xl font-bold text-gray-900">{'\u09F3'}{totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {/* Orders & Revenue Line Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-5 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">{t('analytics.orders_revenue')}</h3>
            {chartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('analytics.no_data')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="orders" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number, name: string) =>
                      name === 'revenue' ? [`\u09F3${value.toFixed(2)}`, t('analytics.revenue')] : [value, t('analytics.orders')]
                    }
                    labelFormatter={(label: string) => label}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orders"
                    name={t('analytics.orders')}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={chartData.length <= 31}
                  />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    name={t('analytics.revenue')}
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={chartData.length <= 31}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Products Bar Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">{t('analytics.top_products')} ({t('analytics.this_month')})</h3>
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('analytics.no_data')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, topProducts.length * 45)}>
                <BarChart
                  data={topProducts.map((p) => ({
                    name: p.product_name.length > 20 ? p.product_name.slice(0, 20) + '...' : p.product_name,
                    quantity: p.total_quantity,
                    revenue: parseFloat(p.total_revenue_bdt || '0'),
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number, name: string) =>
                      name === 'revenue' ? [`\u09F3${value.toFixed(2)}`, t('analytics.revenue')] : [value, t('analytics.qty_sold')]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="quantity" name={t('analytics.qty_sold')} fill="#6366f1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="revenue" name={t('analytics.revenue')} fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function QuickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {label}
    </button>
  );
}
