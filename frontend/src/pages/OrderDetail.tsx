import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrder, updateOrderStatus, markAdvanceReceived } from '@/lib/orderApi';
import type { Order } from '@/lib/orderApi';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirm Order', color: 'bg-blue-600 hover:bg-blue-700' },
  shipped: { label: 'Mark Shipped', color: 'bg-indigo-600 hover:bg-indigo-700' },
  delivered: { label: 'Mark Delivered', color: 'bg-green-600 hover:bg-green-700' },
  returned: { label: 'Mark Returned', color: 'bg-gray-600 hover:bg-gray-700' },
  cancelled: { label: 'Cancel Order', color: 'bg-red-600 hover:bg-red-700' },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOrder(id)
      .then(setOrder)
      .catch((err) => setError(err?.message || 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;

    if (newStatus === 'cancelled') {
      setShowCancelForm(true);
      return;
    }

    setActionLoading(newStatus);
    setError('');
    try {
      const updated = await updateOrderStatus(order.id, newStatus);
      setOrder(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !cancelReason.trim()) return;

    setActionLoading('cancelled');
    setError('');
    try {
      const updated = await updateOrderStatus(order.id, 'cancelled', cancelReason.trim());
      setOrder(updated);
      setShowCancelForm(false);
      setCancelReason('');
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel order');
    } finally {
      setActionLoading('');
    }
  };

  const handleMarkAdvance = async () => {
    if (!order) return;
    setActionLoading('advance');
    setError('');
    try {
      const updated = await markAdvanceReceived(order.id);
      setOrder(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to mark advance received');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{error || 'Order not found'}</p>
        <Link to="/dashboard/orders" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
          Back to orders
        </Link>
      </div>
    );
  }

  const nextStatuses = VALID_TRANSITIONS[order.status] || [];

  return (
    <div>
      <Link to="/dashboard/orders" className="text-sm text-gray-500 hover:text-primary-600 mb-4 inline-block">
        &larr; Back to orders
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Order <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(order.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <StatusBadge status={order.status} large />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>
      )}

      {/* Action buttons */}
      {nextStatuses.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => {
              const action = ACTION_LABELS[status];
              return (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  disabled={!!actionLoading}
                  className={`px-4 py-2 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-60 ${action.color}`}
                >
                  {actionLoading === status ? 'Updating...' : action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel form */}
      {showCancelForm && (
        <form onSubmit={handleCancel} className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-red-800 mb-2">Cancel Order</h3>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (required)"
            rows={2}
            className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-2"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!cancelReason.trim() || !!actionLoading}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {actionLoading === 'cancelled' ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCancelForm(false); setCancelReason(''); }}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Never mind
            </button>
          </div>
        </form>
      )}

      {/* Advance payment */}
      {order.advance_payment_required && (
        <div className={`rounded-lg shadow-sm p-4 mb-4 ${order.advance_payment_received ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Advance Payment</h2>
              <p className={`text-sm mt-0.5 ${order.advance_payment_received ? 'text-green-700' : 'text-amber-700'}`}>
                {order.advance_payment_received ? 'Received' : 'Not yet received'}
              </p>
            </div>
            {!order.advance_payment_received && order.status !== 'cancelled' && (
              <button
                onClick={handleMarkAdvance}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
              >
                {actionLoading === 'advance' ? 'Marking...' : 'Mark Received'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer info */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Customer</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="text-gray-800">{order.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <a href={`tel:${order.customer_phone}`} className="text-primary-600 font-medium">{order.customer_phone}</a>
            </div>
          </div>
        </div>

        {/* Delivery info */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Delivery</h2>
          <div className="space-y-2 text-sm">
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
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Items</h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.product_name_snapshot}{' '}
                <span className="text-gray-400">x{item.quantity}</span>
                <span className="text-gray-400 ml-1">@ {'\u09F3'}{item.unit_price_snapshot_bdt}</span>
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
            <span className="text-gray-600">Delivery Charge</span>
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

      {/* Cancellation reason */}
      {order.status === 'cancelled' && order.cancelled_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <h2 className="text-sm font-semibold text-red-800 mb-1">Cancellation Reason</h2>
          <p className="text-sm text-red-700">{order.cancelled_reason}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, large }: { status: string; large?: boolean }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800',
  };
  const sizeClasses = large ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-block rounded-full font-medium capitalize ${sizeClasses} ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
