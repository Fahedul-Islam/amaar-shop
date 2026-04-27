'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { IcArrowLeft } from '@/components/icons/Icons';
import { getOrder, updateOrderStatus, markAdvanceReceived } from '@/lib/orderApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';
import { ApiRequestError } from '@/lib/api';

const nextStatus: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
  });

  const updateStatus = async (status: string) => {
    if (!order) return;
    setError(null);
    try {
      await updateOrderStatus(order.id, status, status === 'cancelled' ? cancelReason : undefined);
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update status');
    }
  };

  const advance = async () => {
    if (!order) return;
    setError(null);
    try {
      await markAdvanceReceived(order.id);
      qc.invalidateQueries({ queryKey: ['order', id] });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not mark advance received');
    }
  };

  if (isLoading) return <div className="p-8 text-stone-500">Loading…</div>;
  if (!order) return <div className="p-8 text-stone-500">Order not found.</div>;

  const actions = nextStatus[order.status] ?? [];

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-5xl">
      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-3.5">
        <IcArrowLeft size={14} /> Back to orders
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold tracking-tight font-mono">{order.id.slice(0, 8)}</h1>
        <Badge tone={statusTone(order.status)}>{order.status}</Badge>
      </div>
      <p className="text-stone-500 mb-5">Placed {formatDateTime(order.created_at, locale)} · {order.customer_name}</p>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5" hover={false}>
          <h3 className="text-sm font-semibold mb-3.5">Items</h3>
          {order.items.map((it) => (
            <div key={it.id} className="flex gap-3 pb-3 mb-3 border-b border-stone-100 last:border-0 last:mb-0 last:pb-0">
              <div className="flex-1">
                <div className="text-sm font-medium">{it.product_name_snapshot}</div>
                <div className="text-xs text-stone-500">Qty {it.quantity} · {formatBDT(it.unit_price_snapshot_bdt, locale)} each</div>
              </div>
              <div className="font-medium">{formatBDT(it.line_total_bdt, locale)}</div>
            </div>
          ))}
          <div className="grid gap-1.5 text-sm text-stone-600 pt-3 border-t border-stone-200">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(order.subtotal_bdt, locale)}</span></div>
            <div className="flex justify-between"><span>Delivery ({order.delivery_area})</span><span>{formatBDT(order.delivery_charge_bdt, locale)}</span></div>
            <div className="flex justify-between text-base text-stone-900 font-semibold mt-2"><span>Total</span><span>{formatBDT(order.total_bdt, locale)}</span></div>
          </div>

          {actions.length > 0 && (
            <div className="mt-5 flex gap-2 flex-wrap">
              {actions.map((s) => (
                <Button
                  key={s}
                  variant={s === 'cancelled' ? 'danger' : 'primary'}
                  onClick={() => {
                    if (s === 'cancelled' && !cancelReason.trim()) {
                      setError('Please enter a cancellation reason below.');
                      return;
                    }
                    updateStatus(s);
                  }}
                >
                  Mark {s}
                </Button>
              ))}
            </div>
          )}

          {order.status === 'pending' && (
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Cancellation reason (if cancelling)"
              className="w-full h-10 px-3 mt-3 border border-stone-300 rounded-md text-sm"
            />
          )}

          {order.advance_payment_required && !order.advance_payment_received && (
            <div className="mt-4">
              <Button variant="secondary" onClick={advance}>Mark advance payment received</Button>
            </div>
          )}
        </Card>

        <div className="grid gap-4">
          <Card className="p-5" hover={false}>
            <h3 className="text-sm font-semibold mb-2.5">Buyer</h3>
            <div className="text-sm text-stone-600 leading-relaxed">
              <div className="font-medium text-stone-900">{order.customer_name}</div>
              <div>{order.customer_phone}</div>
              <div>{order.delivery_address}{order.delivery_area ? `, ${order.delivery_area}` : ''}</div>
            </div>
          </Card>
          {order.note && (
            <Card className="p-5" hover={false}>
              <h3 className="text-sm font-semibold mb-2.5">Note</h3>
              <div className="text-sm text-stone-600 whitespace-pre-line">{order.note}</div>
            </Card>
          )}
          <Card className="p-5" hover={false}>
            <h3 className="text-sm font-semibold mb-2.5">Payment</h3>
            <div className="text-sm text-stone-600">
              {order.advance_payment_required
                ? order.advance_payment_received
                  ? 'Advance received · COD for balance'
                  : 'Advance pending'
                : 'Cash on delivery'}
            </div>
          </Card>
          {order.cancelled_reason && (
            <Card className="p-5" hover={false}>
              <h3 className="text-sm font-semibold mb-2.5">Cancellation reason</h3>
              <div className="text-sm text-stone-600 whitespace-pre-line">{order.cancelled_reason}</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
