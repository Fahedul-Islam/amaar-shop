'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { IcArrowLeft, IcUndo } from '@/components/icons/Icons';
import { getOrder, updateOrderStatus, markAdvanceReceived, prettyOrderStatus } from '@/lib/orderApi';
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

// Previous status for one-step undo of an accidental click.
const prevStatus: Record<string, string> = {
  confirmed: 'pending',
  shipped: 'confirmed',
  delivered: 'shipped',
  returned: 'shipped',
  cancelled: 'pending',
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
      // The dashboard home and analytics page have their own keyed views of
      // the same data — invalidate them too so a pending → delivered move is
      // reflected everywhere on the next render.
      qc.invalidateQueries({ queryKey: ['orders-recent'] });
      qc.invalidateQueries({ queryKey: ['stats-today'] });
      qc.invalidateQueries({ queryKey: ['top-products'] });
      qc.invalidateQueries({ queryKey: ['stats-range'] });
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
  const undoTo = prevStatus[order.status];

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-5xl">
      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-3.5">
        <IcArrowLeft size={14} /> Back to orders
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold tracking-tight font-mono">{order.id.slice(0, 8)}</h1>
        <Badge tone={statusTone(order.status)}>{prettyOrderStatus(order.status)}</Badge>
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

          {(actions.length > 0 || undoTo) && (
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
                  {actionLabel(s)}
                </Button>
              ))}
              {undoTo && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!confirm(`Undo and revert this order back to "${undoTo}"?`)) return;
                    updateStatus(undoTo);
                  }}
                >
                  <IcUndo size={14} /> Undo (back to {undoTo})
                </Button>
              )}
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

          <ContactBuyerCard order={order} locale={locale} />

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

// actionLabel renders the next-status button copy as an action verb the
// seller can act on, instead of the bare enum name.
function actionLabel(s: string): string {
  switch (s) {
    case 'confirmed': return 'Confirm order';
    case 'shipped': return 'Hand to courier';
    case 'delivered': return 'Mark delivered';
    case 'cancelled': return 'Cancel order';
    default: return `Mark ${s}`;
  }
}

// ContactBuyerCard surfaces ready-made messages keyed to the order's status,
// so a busy seller can confirm/update a buyer in one tap instead of typing.
// Templates are lightly opinionated: friendly, short, and include the order
// short-ID so the buyer immediately knows which order is being discussed.
function ContactBuyerCard({
  order,
  locale,
}: {
  order: {
    id: string;
    customer_name: string;
    customer_phone: string;
    status: string;
    total_bdt: string;
    advance_payment_required: boolean;
    advance_payment_received: boolean;
  };
  locale: 'en' | 'bn';
}) {
  const shortId = order.id.slice(0, 8);
  const total = `Tk ${order.total_bdt}`;
  const name = order.customer_name;

  const templates = pickTemplates(order.status, order.advance_payment_required, order.advance_payment_received, {
    name,
    shortId,
    total,
  });

  const phoneDigits = order.customer_phone.replace(/\D/g, '');
  // Bangladesh: WhatsApp expects E.164. The local trunk-zero (01...) is
  // replaced with 880 so wa.me/... resolves to the right account.
  const waPhone = phoneDigits.startsWith('0') ? `880${phoneDigits.slice(1)}` : phoneDigits;

  if (templates.length === 0) return null;

  return (
    <Card className="p-5" hover={false}>
      <h3 className="text-sm font-semibold mb-1">Message buyer</h3>
      <p className="text-[11px] text-stone-500 mb-3">
        One-tap WhatsApp or SMS with a ready-made message for this order.
      </p>
      <div className="flex flex-col gap-2">
        {templates.map((t, i) => (
          <div key={i} className="border border-stone-200 rounded-md p-2.5 bg-stone-50/40">
            <div className="text-xs font-medium text-stone-700 mb-1">{t.label}</div>
            <div className="text-[11px] text-stone-500 mb-2 whitespace-pre-line line-clamp-3">
              {t.body}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(t.body)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700"
              >
                WhatsApp
              </a>
              <a
                href={`sms:${order.customer_phone}?body=${encodeURIComponent(t.body)}`}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
              >
                SMS
              </a>
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-teal-700 bg-teal-50 hover:bg-teal-100"
              >
                Call
              </a>
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(t.body); } catch { /* clipboard may be blocked */ }
                }}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-stone-600 hover:bg-stone-100"
                title="Copy message"
              >
                Copy
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-stone-400 mt-2">
        {locale === 'bn' ? 'WhatsApp এ পাঠালে দ্রুত উত্তর পাবেন।' : 'WhatsApp usually gets replies fastest.'}
      </p>
    </Card>
  );
}

function pickTemplates(
  status: string,
  advanceRequired: boolean,
  advanceReceived: boolean,
  vars: { name: string; shortId: string; total: string },
): { label: string; body: string }[] {
  const { name, shortId, total } = vars;
  const out: { label: string; body: string }[] = [];

  if (status === 'pending') {
    out.push({
      label: 'Confirm order',
      body: `Hello ${name}, this is regarding your order ${shortId} (${total}). Please confirm so we can pack and ship it. Thank you!`,
    });
    if (advanceRequired && !advanceReceived) {
      out.push({
        label: 'Request advance payment',
        body: `Hello ${name}, please send the advance payment for order ${shortId} (${total}) to confirm shipment. Reply here once paid. Thank you!`,
      });
    }
    out.push({
      label: 'Ask for delivery details',
      body: `Hello ${name}, regarding order ${shortId}: could you confirm the delivery address and a phone number we can call before delivery? Thank you!`,
    });
  } else if (status === 'confirmed') {
    out.push({
      label: 'Order confirmed',
      body: `Hello ${name}, your order ${shortId} (${total}) is confirmed. We will hand it over to the courier soon and share an update. Thank you!`,
    });
    if (advanceRequired && !advanceReceived) {
      out.push({
        label: 'Reminder · advance payment',
        body: `Hello ${name}, gentle reminder to send the advance payment for order ${shortId} (${total}). We will ship as soon as it is received. Thank you!`,
      });
    }
  } else if (status === 'shipped') {
    out.push({
      label: 'Out for delivery',
      body: `Hello ${name}, your order ${shortId} (${total}) is now with the courier. Please keep ${total} ready for cash on delivery. The rider may call before arriving. Thank you!`,
    });
    out.push({
      label: 'Couldn\'t reach you',
      body: `Hello ${name}, the courier is trying to deliver order ${shortId} but couldn't reach you. Please share a good time to deliver, or call us back. Thank you!`,
    });
  } else if (status === 'delivered') {
    out.push({
      label: 'Thank you · ask for review',
      body: `Hello ${name}, thank you for your order ${shortId}! If you liked the product, please share a quick review on our shop. Looking forward to your next order!`,
    });
  } else if (status === 'cancelled') {
    out.push({
      label: 'Apologise · offer to re-order',
      body: `Hello ${name}, sorry your order ${shortId} was cancelled. If you'd like to place it again, just reply here and we'll arrange it for you. Thank you for your patience!`,
    });
  }

  return out;
}
