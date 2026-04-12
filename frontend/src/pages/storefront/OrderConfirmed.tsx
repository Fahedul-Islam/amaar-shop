import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { lookupOrder } from '@/lib/storefrontApi';
import { getDeliverySettings } from '@/lib/storefrontApi';
import type { Order } from '@/lib/storefrontApi';
import type { PublicDeliverySettings } from '@/lib/shopApi';
import { useStorefront } from './StorefrontLayout';

export default function OrderConfirmed() {
  const { slug } = useStorefront();
  const { orderID } = useParams<{ orderID: string }>();

  // Try to load order from sessionStorage (placed in Checkout)
  const [order, setOrder] = useState<Order | null>(() => {
    try {
      const raw = sessionStorage.getItem(`amaarshop_order_${orderID}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [ds, setDs] = useState<PublicDeliverySettings | null>(null);
  const [loading, setLoading] = useState(!order);

  // If we don't have the order from sessionStorage, try to fetch via phone.
  // The phone is also stored in sessionStorage from checkout.
  useEffect(() => {
    if (!order && orderID) {
      const phone = sessionStorage.getItem(`amaarshop_order_phone_${orderID}`);
      if (phone) {
        lookupOrder(slug, orderID, phone)
          .then(setOrder)
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [slug, orderID, order]);

  useEffect(() => {
    getDeliverySettings(slug)
      .then(setDs)
      .catch(() => {});
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Order not found</h2>
        <p className="text-gray-500 mb-4">
          You can look up your order using your Order ID and phone number.
        </p>
        <Link
          to={`/s/${slug}/order-lookup`}
          className="text-primary-600 hover:underline text-sm font-medium"
        >
          Look up an order
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Success header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">Order Placed!</h1>
        <p className="text-gray-500 text-sm">We will contact you at your phone number.</p>
      </div>

      {/* Order ID prominently */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 text-center">
        <p className="text-sm text-gray-500 mb-1">Order ID</p>
        <p className="text-lg font-mono font-bold text-primary-700 select-all">
          {order.id.slice(0, 8).toUpperCase()}
        </p>
        <p className="text-xs text-gray-400 mt-1 select-all">{order.id}</p>
      </div>

      {/* Screenshot hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-center">
        <p className="text-sm text-blue-700 font-medium">
          Screenshot this page for your records
        </p>
      </div>

      {/* Order items */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Items</h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.product_name_snapshot}{' '}
                <span className="text-gray-400">x{item.quantity}</span>
              </span>
              <span className="text-gray-800 font-medium">
                {'\u09F3'}{item.line_total_bdt}
              </span>
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
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Delivery Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span className="text-gray-800">{order.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Phone</span>
            <span className="text-gray-800">{order.customer_phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Area</span>
            <span className="text-gray-800">{order.delivery_area}</span>
          </div>
          <div>
            <span className="text-gray-500">Address</span>
            <p className="text-gray-800 mt-0.5">{order.delivery_address}</p>
          </div>
          {order.note && (
            <div>
              <span className="text-gray-500">Note</span>
              <p className="text-gray-800 mt-0.5">{order.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Advance payment instructions */}
      {order.advance_payment_required && ds?.advance_payment_instructions && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="font-semibold text-amber-800 text-sm mb-1">Advance Payment Required</h3>
              <p className="text-sm text-amber-700 whitespace-pre-line">{ds.advance_payment_instructions}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status</span>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          to={`/s/${slug}`}
          className="flex-1 text-center bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Continue Shopping
        </Link>
        <Link
          to={`/s/${slug}/order-lookup`}
          className="flex-1 text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Look Up Order
        </Link>
      </div>
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
