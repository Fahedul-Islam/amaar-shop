import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listOrders } from '@/lib/orderApi';
import type { Order } from '@/lib/orderApi';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
];

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const statusFilter = searchParams.get('status') || '';
  const phoneFilter = searchParams.get('phone') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [phoneInput, setPhoneInput] = useState(phoneFilter);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listOrders({
        page,
        page_size: 20,
        status: statusFilter || undefined,
        phone: phoneFilter || undefined,
      });
      setOrders(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, phoneFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Reset to page 1 when filters change.
    if (!('page' in updates)) next.delete('page');
    setSearchParams(next);
  };

  const handlePhoneSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ phone: phoneInput.trim() });
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">Orders</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => updateParams({ status: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <form onSubmit={handlePhoneSearch} className="flex gap-2 flex-1">
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Search by phone number"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
          >
            Search
          </button>
          {phoneFilter && (
            <button
              type="button"
              onClick={() => { setPhoneInput(''); updateParams({ phone: '' }); }}
              className="px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 sm:hidden">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/dashboard/orders/${order.id}`}
                className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-primary-700">
                    {order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="text-sm text-gray-600 mb-1">{order.customer_name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{order.customer_phone}</span>
                  <span className="text-sm font-semibold text-gray-800">{'\u09F3'}{order.total_bdt}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(order.created_at).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/dashboard/orders/${order.id}`} className="font-mono text-primary-700 hover:underline font-medium">
                        {order.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{order.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600">{order.customer_phone}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{'\u09F3'}{order.total_bdt}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-6">
            {page > 1 && (
              <button
                onClick={() => updateParams({ page: String(page - 1) })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Previous
              </button>
            )}
            {orders.length >= 20 && (
              <button
                onClick={() => updateParams({ page: String(page + 1) })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Next
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
