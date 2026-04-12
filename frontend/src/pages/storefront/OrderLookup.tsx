import { useState } from 'react';
import { Link } from 'react-router-dom';
import { lookupOrder } from '@/lib/storefrontApi';
import type { Order } from '@/lib/storefrontApi';
import { useStorefront } from './StorefrontLayout';

export default function OrderLookup() {
  const { slug } = useStorefront();

  const [orderID, setOrderID] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);

    if (!orderID.trim()) { setError('Order ID is required'); return; }
    if (!phone.trim()) { setError('Phone number is required'); return; }

    setLoading(true);
    try {
      const result = await lookupOrder(slug, orderID.trim(), phone.trim());
      setOrder(result);
    } catch (err: any) {
      setError(err?.message || 'Order not found. Please check your Order ID and phone number.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link to={`/s/${slug}`} className="hover:text-primary-600">Shop</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-800">Order Lookup</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-800 mb-6">Look Up Your Order</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order ID *</label>
          <input
            type="text"
            value={orderID}
            onChange={(e) => setOrderID(e.target.value)}
            placeholder="Enter your order ID"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60"
        >
          {loading ? 'Looking up...' : 'Look Up Order'}
        </button>
      </form>

      {order && <OrderResult order={order} slug={slug} />}
    </div>
  );
}

function OrderResult({ order, slug }: { order: Order; slug: string }) {
  return (
    <div className="space-y-4">
      {/* Order ID + status */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-500">Order ID</p>
            <p className="font-mono font-bold text-primary-700">{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-xs text-gray-400">
          Placed on {new Date(order.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Items</h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.product_name_snapshot}{' '}
                <span className="text-gray-400">x{item.quantity}</span>
              </span>
              <span className="text-gray-800 font-medium">{'\u09F3'}{item.line_total_bdt}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-800">{'\u09F3'}{order.subtotal_bdt}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Delivery</span>
            <span className="text-gray-800">
              {parseFloat(order.delivery_charge_bdt) === 0 ? 'Free' : `${'\u09F3'}${order.delivery_charge_bdt}`}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold pt-1">
            <span className="text-gray-800">Total</span>
            <span className="text-primary-700">{'\u09F3'}{order.total_bdt}</span>
          </div>
        </div>
      </div>

      {/* Delivery info */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Delivery Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Area</span>
            <span className="text-gray-800">{order.delivery_area}</span>
          </div>
          <div>
            <span className="text-gray-500">Address</span>
            <p className="text-gray-800 mt-0.5">{order.delivery_address}</p>
          </div>
        </div>
      </div>

      <Link
        to={`/s/${slug}`}
        className="block text-center bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
      >
        Continue Shopping
      </Link>
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
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
