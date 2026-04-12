import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDeliverySettings, placeOrder } from '@/lib/storefrontApi';
import type { PublicDeliverySettings } from '@/lib/shopApi';
import { useStorefront } from './StorefrontLayout';

export default function Checkout() {
  const { shop, slug, cart } = useStorefront();

  const [ds, setDs] = useState<PublicDeliverySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');

  // Form state.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [advanceAck, setAdvanceAck] = useState(false);

  useEffect(() => {
    getDeliverySettings(slug)
      .then((s) => {
        setDs(s);
        if (s.delivery_areas.length === 1) {
          setArea(s.delivery_areas[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // COD disabled — can't take orders.
  if (ds && !ds.cod_enabled) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Not currently taking orders</h2>
        <p className="text-gray-500 mb-4">This shop is not accepting orders at this time.</p>
        {shop.contact_phone && (
          <p className="text-sm text-gray-600">
            Contact: <a href={`tel:${shop.contact_phone}`} className="text-primary-600 font-medium">{shop.contact_phone}</a>
          </p>
        )}
      </div>
    );
  }

  // Empty cart.
  if (cart.items.length === 0 && !orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <Link to={`/s/${slug}`} className="text-primary-600 hover:underline text-sm">
          Continue shopping
        </Link>
      </div>
    );
  }

  // Order placed — success screen.
  if (orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Order placed!</h2>
        <p className="text-gray-600 mb-1">Your order <span className="font-mono text-sm">{orderId.slice(0, 8)}</span> has been received.</p>
        <p className="text-gray-500 text-sm mb-6">We will contact you at your provided phone number.</p>
        <Link
          to={`/s/${slug}`}
          className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  // Calculate delivery charge.
  const deliveryCharge = (() => {
    if (!ds) return 0;
    const charge = parseFloat(ds.delivery_charge) || 0;
    if (ds.free_delivery_threshold) {
      const threshold = parseFloat(ds.free_delivery_threshold);
      if (threshold > 0 && cart.subtotal >= threshold) return 0;
    }
    return charge;
  })();
  const total = cart.subtotal + deliveryCharge;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required'); return; }
    if (!phone.trim()) { setError('Phone number is required'); return; }
    if (!address.trim()) { setError('Delivery address is required'); return; }
    if (!area) { setError('Please select a delivery area'); return; }
    if (ds?.advance_payment_required && !advanceAck) {
      setError('Please acknowledge advance payment instructions');
      return;
    }

    setSubmitting(true);
    try {
      const order = await placeOrder(slug, {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_address: address.trim(),
        delivery_area: area,
        note: note.trim() || undefined,
        items: cart.items.map((it) => ({
          product_id: it.productId,
          quantity: it.quantity,
        })),
      });
      setOrderPlaced(true);
      setOrderId(order.id);
      cart.clearCart();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link to={`/s/${slug}`} className="hover:text-primary-600">Shop</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-800">Checkout</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-800 mb-6">Checkout</h1>

      {/* Cart summary */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Summary</h2>
        <div className="space-y-2">
          {cart.items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.name} <span className="text-gray-400">x{item.quantity}</span>
              </span>
              <span className="text-gray-800 font-medium">
                {'\u09F3'}{(parseFloat(item.price) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-800">{'\u09F3'}{cart.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Delivery</span>
            <span className="text-gray-800">
              {deliveryCharge === 0 ? 'Free' : `${'\u09F3'}${deliveryCharge.toFixed(2)}`}
            </span>
          </div>
          {ds?.free_delivery_threshold && deliveryCharge > 0 && (
            <p className="text-xs text-green-600">
              Free delivery on orders above {'\u09F3'}{ds.free_delivery_threshold}
            </p>
          )}
          <div className="flex justify-between text-base font-bold pt-1">
            <span className="text-gray-800">Total</span>
            <span className="text-primary-700">{'\u09F3'}{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Advance payment notice */}
      {ds?.advance_payment_required && ds.advance_payment_instructions && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
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

      {/* Checkout form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Delivery Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Area *</label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Select area</option>
              {ds?.delivery_areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House, road, area details"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any special instructions"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>

        {/* Advance payment acknowledgement */}
        {ds?.advance_payment_required && (
          <label className="flex items-start gap-2 bg-white rounded-lg shadow-sm p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={advanceAck}
              onChange={(e) => setAdvanceAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              I understand that advance payment is required and will follow the payment instructions above.
            </span>
          </label>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Placing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
}
