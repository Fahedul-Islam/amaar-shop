"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrder,
  updateOrderStatus,
  markAdvanceReceived,
  prettyOrderStatus,
} from "@/lib/orderApi";
import {
  listPaymentMethods,
  numberTypeLabel,
  providerLabel,
  type PaymentMethod,
} from "@/lib/paymentMethodApi";
import { formatBDT, formatDateTime } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { ApiRequestError } from "@/lib/api";

// nextStatus mirrors the seller-facing actions allowed from each state.
// shipped → delivered or returned (with confirmed as undo).
const nextStatus: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

// One-step undo so accidental clicks aren't fatal.
const prevStatus: Record<string, string> = {
  confirmed: "pending",
  shipped: "confirmed",
  delivered: "shipped",
  returned: "shipped",
  cancelled: "pending",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  });

  // Seller's payment-method list — used to resolve which method the buyer
  // used on this order. We need it because the order only stores the FK.
  const { data: methods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: listPaymentMethods,
  });

  const usedMethod = useMemo(() => {
    if (!order?.advance_payment_method_id || !methods) return null;
    return methods.find((m) => m.id === order.advance_payment_method_id) ?? null;
  }, [order, methods]);

  const advancePaid = !!(
    order?.advance_payment_required && order.advance_payment_received
  );
  const advancePending = !!(
    order?.advance_payment_required && !order.advance_payment_received
  );
  const proofSubmitted = !!(
    order?.advance_payment_required && order.advance_payment_receipt
  );

  const updateStatus = async (status: string) => {
    if (!order) return;
    setError(null);
    try {
      await updateOrderStatus(
        order.id,
        status,
        status === "cancelled" ? cancelReason : undefined,
      );
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-recent"] });
      qc.invalidateQueries({ queryKey: ["stats-today"] });
      qc.invalidateQueries({ queryKey: ["top-products"] });
      qc.invalidateQueries({ queryKey: ["stats-range"] });
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not update status",
      );
    }
  };

  const markPayment = async (received: boolean) => {
    if (!order) return;
    setError(null);
    try {
      await markAdvanceReceived(order.id, received);
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not update advance payment",
      );
    }
  };

  function copy(value: string, key: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    });
  }

  if (isLoading) {
    return <div className="p-8 text-stone-500">Loading…</div>;
  }
  if (!order) {
    return <div className="p-8 text-stone-500">Order not found.</div>;
  }

  const shortId = order.id.slice(0, 8);
  const area = [order.delivery_district, order.delivery_division]
    .filter(Boolean)
    .join(", ");
  const actions = nextStatus[order.status] ?? [];
  const undoTo = prevStatus[order.status];
  const cancelled = order.status === "cancelled";
  const returned = order.status === "returned";

  // Money math — when an advance is paid, the buyer paid the delivery fee
  // up front and owes the subtotal on delivery.
  const advanceAmount = order.advance_payment_required
    ? order.delivery_charge_bdt
    : "0.00";
  const balanceDue = order.advance_payment_required
    ? order.subtotal_bdt
    : order.total_bdt;

  return (
    <div className="min-h-screen bg-stone-50 -m-6 md:-m-8 flex flex-col">
      {/* ── Top bar (breadcrumb + invoice action) ───────────────── */}
      <div className="bg-white border-b border-stone-200 px-6 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 text-[13.5px] text-stone-500">
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <IcChevLeft size={14} />
            Back to orders
          </Link>
          <span className="text-stone-300">·</span>
          <span>Order detail</span>
        </div>
        <a
          href={`/api/shops/me/orders/${order.id}/invoice.pdf`}
          target="_blank"
          rel="noreferrer"
          className="h-[38px] px-3.5 inline-flex items-center gap-2 border border-stone-300 rounded-md text-[13px] font-medium text-stone-900 bg-white hover:bg-stone-50 hover:border-stone-400 transition-colors"
        >
          <IcDownload size={15} />
          Invoice PDF
        </a>
      </div>

      {/* ── Order hero ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200 px-6 md:px-8 pt-7 pb-6">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="font-mono text-[28px] font-bold tracking-[-0.01em] text-stone-900 leading-none">
            #{shortId}
          </span>
          <button
            type="button"
            onClick={() => copy(order.id, "id")}
            title="Copy order ID"
            className="w-[30px] h-[30px] grid place-items-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition-colors"
          >
            {copied === "id" ? <IcCheck size={14} /> : <IcCopy size={14} />}
          </button>
          <StatusBadge status={order.status} />
          {advancePending && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[12.5px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Advance pending
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2 text-[13.5px] text-stone-500 flex-wrap">
          <IcCalendar size={14} className="text-stone-400" />
          Placed{" "}
          <strong className="text-stone-700 font-medium">
            {formatDateTime(order.created_at, locale)}
          </strong>
          <span className="text-stone-300">·</span>
          by{" "}
          <strong className="text-stone-700 font-medium">
            {order.customer_name}
          </strong>
          <span className="text-stone-300">·</span>
          via <strong className="text-stone-700 font-medium">Storefront</strong>
        </div>

        {/* Status timeline */}
        <Timeline
          status={order.status}
          createdAt={order.created_at}
          updatedAt={order.updated_at}
          locale={locale}
        />
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex-1 px-6 md:px-8 py-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start pb-32">
        {error && (
          <div className="lg:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
            {error}
          </div>
        )}

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Items + summary */}
          <section className="bg-white border border-stone-200 rounded-[14px]">
            <CardHead
              icon={<IcPackage size={14} />}
              title="Items"
              meta={`${order.items.length} item${order.items.length === 1 ? "" : "s"} · ${order.items.reduce((n, it) => n + it.quantity, 0)} unit${order.items.reduce((n, it) => n + it.quantity, 0) === 1 ? "" : "s"}`}
            />
            <div className="px-5 pt-2 pb-4">
              {order.items.map((it, idx) => (
                <div
                  key={it.id}
                  className={`grid grid-cols-[64px_minmax(0,1fr)_auto] gap-3.5 items-center py-3 ${
                    idx < order.items.length - 1
                      ? "border-b border-stone-100"
                      : ""
                  }`}
                >
                  <div
                    className="w-16 h-16 rounded-[10px] grid place-items-center text-white font-bold text-[15px] flex-shrink-0"
                    style={{
                      background: thumbBg(it.product_name_snapshot),
                    }}
                  >
                    {productInitials(it.product_name_snapshot)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold text-stone-900 leading-tight">
                      {it.product_name_snapshot}
                    </div>
                    <div className="text-[12.5px] text-stone-500 mt-0.5">
                      Qty {it.quantity} ·{" "}
                      {formatBDT(it.unit_price_snapshot_bdt, locale)} each
                    </div>
                  </div>
                  <div className="text-[14.5px] font-semibold text-stone-900 text-right">
                    {formatBDT(it.line_total_bdt, locale)}
                    <div className="text-[11.5px] font-medium text-stone-500 mt-0.5">
                      {formatBDT(it.unit_price_snapshot_bdt, locale)} each
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-3.5 text-sm">
                <SummaryLine
                  label="Subtotal"
                  value={formatBDT(order.subtotal_bdt, locale)}
                />
                <SummaryLine
                  label={
                    <>
                      Delivery
                      {area && (
                        <span className="text-[12px] text-stone-500 ml-1.5">
                          · {area}
                        </span>
                      )}
                    </>
                  }
                  value={formatBDT(order.delivery_charge_bdt, locale)}
                />
                <div className="flex justify-between pt-3.5 mt-2.5 border-t-2 border-stone-200 text-[18px] font-bold text-stone-900">
                  <span>Total</span>
                  <span>{formatBDT(order.total_bdt, locale)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Payment */}
          {order.advance_payment_required ? (
            <PaymentCard
              order={order}
              method={usedMethod}
              advanceAmount={advanceAmount}
              balanceDue={balanceDue}
              advancePending={advancePending}
              advancePaid={advancePaid}
              proofSubmitted={proofSubmitted}
              copied={copied}
              copy={copy}
              onMarkReceived={markPayment}
              locale={locale}
            />
          ) : (
            <section className="bg-white border border-stone-200 rounded-[14px]">
              <CardHead icon={<IcWallet size={14} />} title="Payment" />
              <div className="px-5 py-4 text-sm text-stone-700">
                Cash on delivery · collect{" "}
                <strong className="text-stone-900 font-semibold">
                  {formatBDT(order.total_bdt, locale)}
                </strong>{" "}
                from buyer at delivery.
              </div>
            </section>
          )}

          {/* Delivery */}
          <section className="bg-white border border-stone-200 rounded-[14px]">
            <CardHead icon={<IcTruck size={14} />} title="Delivery" />
            <div className="px-5 py-2">
              <InfoLine
                icon={<IcMapPin size={16} />}
                label="Ship to"
                value={
                  <>
                    {order.delivery_address}
                    {area ? `, ${area}` : ""}
                  </>
                }
                actions={
                  <button
                    type="button"
                    onClick={() =>
                      copy(
                        `${order.delivery_address}${area ? `, ${area}` : ""}`,
                        "addr",
                      )
                    }
                    title="Copy address"
                    className="w-[30px] h-[30px] grid place-items-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 transition-colors"
                  >
                    {copied === "addr" ? (
                      <IcCheck size={14} />
                    ) : (
                      <IcCopy size={14} />
                    )}
                  </button>
                }
              />
              {order.note && (
                <InfoLine
                  icon={<IcNote size={16} />}
                  label="Note from buyer"
                  value={order.note}
                />
              )}
            </div>
          </section>

          {(cancelled || returned) && order.cancelled_reason && (
            <section className="bg-white border border-stone-200 rounded-[14px]">
              <CardHead
                icon={<IcAlert size={14} />}
                title={cancelled ? "Cancellation reason" : "Return reason"}
              />
              <div className="px-5 py-4 text-sm text-stone-700 whitespace-pre-line">
                {order.cancelled_reason}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5 min-w-0">
          <BuyerCard order={order} />
          <QuickMessages order={order} locale={locale} />
        </div>
      </div>

      {/* ── Sticky action bar ──────────────────────────────────── */}
      {(actions.length > 0 || undoTo) && (
        <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 md:px-8 py-3.5 flex items-center gap-3 flex-wrap z-20 shadow-[0_-4px_24px_-8px_rgba(28,25,23,0.08)]">
          <NextStepHint order={order} advancePending={advancePending} />
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {undoTo && (
              <button
                type="button"
                onClick={() => {
                  if (
                    !confirm(
                      `Undo and revert this order back to "${undoTo}"?`,
                    )
                  )
                    return;
                  updateStatus(undoTo);
                }}
                className="h-[42px] px-4 inline-flex items-center gap-2 border border-stone-300 rounded-[9px] bg-white text-stone-900 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                <IcUndo size={14} />
                Undo · back to {undoTo}
              </button>
            )}
            {actions.includes("cancelled") && (
              <button
                type="button"
                onClick={() => {
                  if (!cancelReason.trim()) {
                    setError(
                      "Please type a cancellation reason in the field below before cancelling.",
                    );
                    return;
                  }
                  updateStatus("cancelled");
                }}
                className="h-[42px] px-4 inline-flex items-center gap-2 border border-coral-100 rounded-[9px] bg-white text-coral-600 text-sm font-medium hover:bg-coral-50 transition-colors"
              >
                <IcX size={14} />
                Cancel order
              </button>
            )}
            {actions
              .filter((s) => s !== "cancelled")
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (s === "confirmed" && advancePending && !proofSubmitted) {
                      setError(
                        "Buyer hasn't submitted advance payment proof yet.",
                      );
                      return;
                    }
                    if (s === "confirmed" && advancePending && proofSubmitted) {
                      setError(
                        "Verify the advance payment first — mark it received in the payment card above.",
                      );
                      return;
                    }
                    updateStatus(s);
                  }}
                  className="h-[42px] px-5 inline-flex items-center gap-2 rounded-[9px] bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
                >
                  <IcCheck size={14} />
                  {actionLabel(s)}
                </button>
              ))}
          </div>
          {actions.includes("cancelled") && (
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Cancellation reason (required if cancelling)"
              className="basis-full mt-2 h-10 px-3 border border-stone-200 rounded-md text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Subcomponents ────────────────────────────────────────────── */

function CardHead({
  icon,
  title,
  meta,
  rightSlot,
  highlighted,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  rightSlot?: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`px-5 py-3.5 border-b border-stone-100 flex items-center justify-between ${
        highlighted ? "bg-amber-50/40 border-b-amber-200" : ""
      }`}
    >
      <h3 className="m-0 text-[15px] font-semibold text-stone-900 inline-flex items-center gap-2.5">
        <span
          className={`w-[26px] h-[26px] rounded-[7px] grid place-items-center ${
            highlighted
              ? "bg-amber-100 text-amber-700"
              : "bg-stone-100 text-stone-700"
          }`}
        >
          {icon}
        </span>
        {title}
      </h3>
      {meta && <span className="text-[12px] text-stone-500">{meta}</span>}
      {rightSlot}
    </div>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between py-1 text-stone-700">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoLine({
  icon,
  label,
  value,
  actions,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-t border-stone-100 first:border-t-0">
      <span className="text-stone-400 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-semibold text-stone-500 uppercase tracking-[0.04em] mb-0.5">
          {label}
        </div>
        <div className="text-[13.5px] text-stone-900 font-medium">{value}</div>
      </div>
      {actions && <div className="flex gap-1.5 ml-auto">{actions}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    pending: {
      label: "Pending",
      cls: "bg-amber-100 text-amber-700",
      dot: "bg-amber-500",
    },
    confirmed: {
      label: "Confirmed",
      cls: "bg-teal-50 text-teal-700",
      dot: "bg-teal-600",
    },
    shipped: {
      label: "With courier",
      cls: "bg-purple-100 text-purple-700",
      dot: "bg-purple-500",
    },
    delivered: {
      label: "Delivered",
      cls: "bg-green-100 text-green-700",
      dot: "bg-green-600",
    },
    cancelled: {
      label: "Cancelled",
      cls: "bg-stone-100 text-stone-600",
      dot: "bg-stone-400",
    },
    returned: {
      label: "Returned",
      cls: "bg-coral-50 text-coral-600",
      dot: "bg-coral-500",
    },
  };
  const m = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${m.cls} text-[12.5px] font-semibold`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const TIMELINE_STEPS: { key: string; label: string }[] = [
  { key: "pending", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "With courier" },
  { key: "delivered", label: "Delivered" },
];

function Timeline({
  status,
  createdAt,
  updatedAt,
  locale,
}: {
  status: string;
  createdAt: string;
  updatedAt: string;
  locale: "en" | "bn";
}) {
  const cancelled = status === "cancelled";
  const returned = status === "returned";
  const currentIdx = TIMELINE_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="mt-6 bg-stone-50 border border-stone-200 rounded-[12px] px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-y-3 relative">
      {TIMELINE_STEPS.map((s, i) => {
        const done = !cancelled && !returned && i < currentIdx;
        const current = !cancelled && !returned && i === currentIdx;
        const idle = cancelled || returned || i > currentIdx;
        return (
          <div
            key={s.key}
            className="relative flex flex-col items-start gap-1.5 pr-2"
          >
            <div
              className={`relative z-10 w-8 h-8 rounded-full border-2 grid place-items-center ${
                done
                  ? "bg-teal-600 border-teal-600 text-white"
                  : current
                    ? "bg-white border-teal-600 text-teal-600 ring-4 ring-teal-100"
                    : "bg-white border-stone-300 text-stone-400"
              }`}
            >
              {done ? <IcCheck size={14} /> : <span>{i + 1}</span>}
              {current && (
                <span className="absolute -inset-1.5 rounded-full border-2 border-teal-500 animate-ping opacity-40" />
              )}
            </div>
            <span
              className={`text-[13px] font-semibold ${idle ? "text-stone-400" : "text-stone-900"}`}
            >
              {s.label}
            </span>
            <span className="text-[11.5px] text-stone-500">
              {i === 0
                ? formatDateTime(createdAt, locale)
                : current
                  ? `Since ${formatDateTime(updatedAt, locale)}`
                  : "Pending"}
            </span>
            {/* connector */}
            {i < TIMELINE_STEPS.length - 1 && (
              <span
                className={`hidden sm:block absolute top-4 left-8 right-[-8px] h-[2px] z-0 ${
                  done ? "bg-teal-600" : "bg-stone-200"
                }`}
              />
            )}
          </div>
        );
      })}
      {(cancelled || returned) && (
        <div
          className={`col-span-full mt-1 pt-3 border-t border-stone-200 text-xs font-medium ${
            cancelled ? "text-coral-600" : "text-amber-700"
          }`}
        >
          {cancelled ? "Order cancelled" : "Order returned"} ·{" "}
          {formatDateTime(updatedAt, locale)}
        </div>
      )}
    </div>
  );
}

/* ── Payment card (highlighted) ───────────────────────────────── */

function PaymentCard({
  order,
  method,
  advanceAmount,
  balanceDue,
  advancePending,
  advancePaid,
  proofSubmitted,
  copied,
  copy,
  onMarkReceived,
  locale,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getOrder>>>;
  method: PaymentMethod | null;
  advanceAmount: string;
  balanceDue: string;
  advancePending: boolean;
  advancePaid: boolean;
  proofSubmitted: boolean;
  copied: string | null;
  copy: (val: string, key: string) => void;
  onMarkReceived: (received: boolean) => void;
  locale: "en" | "bn";
}) {
  const highlighted = !!advancePending;
  const cardCls = highlighted
    ? "bg-gradient-to-b from-amber-50 to-white border-[1.5px] border-amber-200"
    : "bg-white border border-stone-200";

  return (
    <section className={`rounded-[14px] overflow-hidden ${cardCls}`}>
      <CardHead
        icon={<IcWallet size={14} />}
        title="Payment"
        rightSlot={
          highlighted ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11.5px] font-semibold">
              <IcAlert size={12} />
              Needs verification
            </span>
          ) : advancePaid ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11.5px] font-semibold">
              <IcCheck size={12} />
              Verified
            </span>
          ) : undefined
        }
        highlighted={highlighted}
      />

      {/* Money summary */}
      <div className="grid grid-cols-2 gap-3.5 px-5 py-4 bg-white border-b border-stone-100">
        <div>
          <div className="text-[11.5px] font-semibold text-stone-500 uppercase tracking-[0.04em] mb-1">
            Advance {advancePaid ? "received" : "expected"}
          </div>
          <div className="text-[20px] font-bold text-stone-900 tracking-[-0.01em]">
            {formatBDT(advanceAmount, locale)}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            {advancePaid ? (
              <span className="text-green-700 font-medium">
                ● Verified
                {order.advance_payment_submitted_at
                  ? ` · ${formatDateTime(order.advance_payment_submitted_at, locale)}`
                  : ""}
              </span>
            ) : proofSubmitted ? (
              <span className="text-amber-700 font-medium">
                ● Awaiting your verification
              </span>
            ) : (
              "Buyer hasn't submitted proof yet"
            )}
          </div>
        </div>
        <div>
          <div className="text-[11.5px] font-semibold text-stone-500 uppercase tracking-[0.04em] mb-1">
            Balance (COD)
          </div>
          <div className="text-[20px] font-bold text-coral-600 tracking-[-0.01em]">
            {formatBDT(balanceDue, locale)}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            Collect from buyer at delivery
          </div>
        </div>
      </div>

      {/* Method + txn */}
      {proofSubmitted ? (
        <>
          <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-stone-100">
            <div
              className={`w-10 h-10 rounded-[10px] grid place-items-center text-white text-[11px] font-bold flex-shrink-0 ${
                method?.method_type === "bank"
                  ? "bg-blue-600"
                  : "bg-coral-500"
              }`}
              style={
                method?.method_type === "mobile_banking"
                  ? {
                      background:
                        "linear-gradient(135deg, #F472B6, #DB2777)",
                    }
                  : undefined
              }
            >
              {method?.method_type === "bank"
                ? "BANK"
                : method
                  ? providerLabel(method.mb_provider)
                      .slice(0, 2)
                      .toUpperCase()
                  : "MB"}
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-stone-900 truncate">
                {method
                  ? method.method_type === "bank"
                    ? `${method.bank_name}${method.branch ? ` · ${method.branch}` : ""}`
                    : `${providerLabel(method.mb_provider)} · ${numberTypeLabel(method.mb_number_type)}`
                  : "Method (no longer configured)"}
              </div>
              <div className="text-xs text-stone-600 mt-0.5 flex items-center gap-1.5 font-mono">
                Txn{" "}
                <strong className="text-stone-900 font-semibold">
                  {order.advance_payment_txn_ref || "—"}
                </strong>
                {order.advance_payment_txn_ref && (
                  <button
                    type="button"
                    onClick={() =>
                      copy(order.advance_payment_txn_ref ?? "", "txn")
                    }
                    title="Copy transaction ID"
                    className="w-[22px] h-[22px] grid place-items-center rounded-[5px] bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    {copied === "txn" ? (
                      <IcCheck size={11} />
                    ) : (
                      <IcCopy size={11} />
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {order.advance_payment_receipt && (
                <a
                  href={order.advance_payment_receipt}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded-md bg-white border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
                >
                  View receipt
                </a>
              )}
              {advancePending ? (
                <button
                  type="button"
                  onClick={() => onMarkReceived(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition-colors"
                >
                  <IcCheck size={13} />
                  Mark verified
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Mark advance payment as NOT received? Use this to undo a wrong verification.",
                      )
                    )
                      onMarkReceived(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-stone-700 text-[12.5px] font-medium hover:bg-stone-50 transition-colors"
                >
                  <IcUndo size={12} />
                  Undo
                </button>
              )}
            </div>
          </div>

          {/* Receipt thumb */}
          {order.advance_payment_receipt && (
            <div className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-[52px] h-16 rounded-md border border-stone-200 bg-gradient-to-br from-white to-stone-100 grid place-items-center relative overflow-hidden flex-shrink-0">
                <IcImage size={20} className="text-stone-400 relative z-10" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-stone-900 truncate">
                  payment-receipt-{order.id.slice(0, 8)}
                  {receiptExt(order.advance_payment_receipt)}
                </div>
                <div className="text-[11.5px] text-stone-500 mt-0.5">
                  Submitted by buyer
                  {order.advance_payment_submitted_at
                    ? ` · ${formatDateTime(order.advance_payment_submitted_at, locale)}`
                    : ""}
                </div>
              </div>
              <a
                href={order.advance_payment_receipt}
                download
                target="_blank"
                rel="noreferrer"
                className="h-[34px] px-3 inline-flex items-center gap-1.5 border border-stone-300 bg-white rounded-md text-stone-900 text-[12.5px] font-medium hover:bg-stone-50 transition-colors"
              >
                <IcDownload size={13} />
                Download
              </a>
            </div>
          )}
        </>
      ) : (
        <div className="px-5 py-4 text-sm text-amber-800 bg-amber-50 border-t border-amber-100">
          Buyer hasn't submitted advance-payment proof yet. They can update it
          from their order tracking link.
        </div>
      )}
    </section>
  );
}

/* ── Right-column cards ───────────────────────────────────────── */

function BuyerCard({
  order,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getOrder>>>;
}) {
  const initials = order.customer_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const phoneDigits = order.customer_phone.replace(/\D/g, "");
  const waPhone = phoneDigits.startsWith("0")
    ? `880${phoneDigits.slice(1)}`
    : phoneDigits;

  return (
    <section className="bg-white border border-stone-200 rounded-[14px]">
      <CardHead icon={<IcUser size={14} />} title="Buyer" />
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 pb-3.5">
          <div
            className="w-11 h-11 rounded-full grid place-items-center text-white font-bold text-base flex-shrink-0"
            style={{ background: avatarBg(order.customer_name) }}
          >
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-stone-900 truncate">
              {order.customer_name}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              Customer
            </div>
          </div>
        </div>
        <InfoLine
          icon={<IcPhone size={16} />}
          label="Phone"
          value={order.customer_phone}
          actions={
            <>
              <a
                href={`tel:${order.customer_phone}`}
                title="Call"
                className="w-[30px] h-[30px] grid place-items-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 transition-colors"
              >
                <IcPhone size={14} />
              </a>
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
                className="w-[30px] h-[30px] grid place-items-center rounded-md bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
              >
                <IcWhatsapp size={14} />
              </a>
            </>
          }
        />
      </div>
    </section>
  );
}

function QuickMessages({
  order,
  locale,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getOrder>>>;
  locale: "en" | "bn";
}) {
  const shortId = order.id.slice(0, 8);
  const total = `Tk ${order.total_bdt}`;

  const templates = pickTemplates(
    order.status,
    order.advance_payment_required,
    order.advance_payment_received,
    { name: order.customer_name, shortId, total },
  );

  const phoneDigits = order.customer_phone.replace(/\D/g, "");
  const waPhone = phoneDigits.startsWith("0")
    ? `880${phoneDigits.slice(1)}`
    : phoneDigits;

  if (templates.length === 0) return null;

  return (
    <section className="bg-white border border-stone-200 rounded-[14px]">
      <CardHead icon={<IcMessage size={14} />} title="Quick messages" />
      <div className="px-5 py-4">
        <div className="flex flex-col gap-2.5">
          {templates.map((t, i) => (
            <div
              key={i}
              className="border border-stone-200 rounded-[10px] px-3.5 py-3 hover:border-stone-300 transition-colors"
            >
              <div className="text-[13px] font-semibold text-stone-900 mb-1.5">
                {t.label}
              </div>
              <div
                className="text-[12.5px] text-stone-600 leading-[1.5] mb-2.5 max-h-[58px] overflow-hidden"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(180deg, #000 60%, transparent)",
                }}
              >
                {t.body}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <a
                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent(t.body)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[28px] px-2.5 inline-flex items-center gap-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                >
                  <IcWhatsapp size={11} />
                  WhatsApp
                </a>
                <a
                  href={`sms:${order.customer_phone}?body=${encodeURIComponent(t.body)}`}
                  className="h-[28px] px-2.5 inline-flex items-center rounded-md border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
                >
                  SMS
                </a>
                <a
                  href={`tel:${order.customer_phone}`}
                  className="h-[28px] px-2.5 inline-flex items-center rounded-md text-teal-700 bg-teal-50 hover:bg-teal-100 text-xs font-medium transition-colors"
                >
                  Call
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(t.body);
                    } catch {
                      /* no-op */
                    }
                  }}
                  className="h-[28px] px-2.5 inline-flex items-center rounded-md text-stone-600 hover:bg-stone-100 text-xs font-medium transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2.5 px-3 py-2.5 bg-stone-50 rounded-md text-[12px] text-stone-600 flex items-center gap-2">
          <IcInfo size={14} className="text-teal-600 flex-shrink-0" />
          {locale === "bn"
            ? "WhatsApp এ পাঠালে দ্রুত উত্তর পাবেন।"
            : "WhatsApp usually gets the fastest reply."}
        </div>
      </div>
    </section>
  );
}

/* ── Action-bar hint ──────────────────────────────────────────── */

function NextStepHint({
  order,
  advancePending,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getOrder>>>;
  advancePending: boolean;
}) {
  let hint = "";
  if (order.status === "pending") {
    hint = advancePending
      ? "Verify the buyer's advance payment, then confirm the order."
      : "Confirm the order to start fulfillment.";
  } else if (order.status === "confirmed") {
    hint = "Hand over to the courier when the package is ready.";
  } else if (order.status === "shipped") {
    hint = "Mark as delivered once the buyer confirms receipt.";
  } else if (order.status === "delivered") {
    hint = "All done — buyer can leave a review now.";
  } else if (order.status === "cancelled") {
    hint = "This order is cancelled.";
  }
  if (!hint) return null;
  return (
    <div className="text-[13px] text-stone-600">
      <strong className="text-stone-900 font-semibold">Next step:</strong>{" "}
      {hint}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function actionLabel(s: string): string {
  switch (s) {
    case "confirmed":
      return "Confirm order";
    case "shipped":
      return "Hand to courier";
    case "delivered":
      return "Mark as delivered";
    default:
      return prettyOrderStatus(s);
  }
}

// pickTemplates is preserved verbatim from the previous version — these
// are the canned message bodies sellers can fire off in one tap.
function pickTemplates(
  status: string,
  advanceRequired: boolean,
  advanceReceived: boolean,
  vars: { name: string; shortId: string; total: string },
): { label: string; body: string }[] {
  const { name, shortId, total } = vars;
  const out: { label: string; body: string }[] = [];

  if (status === "pending") {
    out.push({
      label: "Confirm order",
      body: `Hello ${name}, this is regarding your order ${shortId} (${total}). Please confirm so we can pack and ship it. Thank you!`,
    });
    if (advanceRequired && !advanceReceived) {
      out.push({
        label: "Request advance payment",
        body: `Hello ${name}, please send the advance payment for order ${shortId} (${total}) to confirm shipment. Reply here once paid. Thank you!`,
      });
    }
  } else if (status === "confirmed") {
    out.push({
      label: "Order confirmed",
      body: `Hello ${name}, your order ${shortId} (${total}) is confirmed. We will hand it over to the courier soon and share an update. Thank you!`,
    });
  } else if (status === "shipped") {
    out.push({
      label: "Out for delivery",
      body: `Hello ${name}, your order ${shortId} (${total}) is now with the courier. Please keep ${total} ready for cash on delivery. The rider may call before arriving. Thank you!`,
    });
    out.push({
      label: "Couldn't reach you",
      body: `Hello ${name}, the courier is trying to deliver order ${shortId} but couldn't reach you. Please share a good time to deliver, or call us back. Thank you!`,
    });
  } else if (status === "delivered") {
    out.push({
      label: "Thank you · ask for review",
      body: `Hello ${name}, thank you for your order ${shortId}! If you liked the product, please share a quick review on our shop. Looking forward to your next order!`,
    });
  } else if (status === "cancelled") {
    out.push({
      label: "Apologise · offer to re-order",
      body: `Hello ${name}, sorry your order ${shortId} was cancelled. If you'd like to place it again, just reply here and we'll arrange it for you. Thank you for your patience!`,
    });
  }

  return out;
}

function thumbBg(name: string) {
  // Hash → pick from a small palette so each product gets a stable colour.
  const palette = [
    "linear-gradient(135deg, #DBEAFE, #6366F1)",
    "linear-gradient(135deg, #FEE4E2, #DC2626)",
    "linear-gradient(135deg, #DCFCE7, #16A34A)",
    "linear-gradient(135deg, #FEF3C7, #D97706)",
    "linear-gradient(135deg, #EDE9FE, #6D28D9)",
    "linear-gradient(135deg, #CCFBF1, #0F766E)",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function avatarBg(name: string) {
  const palette = [
    "linear-gradient(135deg, #FCA5A5, #DC2626)",
    "linear-gradient(135deg, #93C5FD, #1D4ED8)",
    "linear-gradient(135deg, #86EFAC, #15803D)",
    "linear-gradient(135deg, #FCD34D, #B45309)",
    "linear-gradient(135deg, #C4B5FD, #6D28D9)",
    "linear-gradient(135deg, #5EEAD4, #0F766E)",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function productInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function receiptExt(url: string): string {
  const m = url.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : "";
}

/* ── Inline icons (Lucide-shaped, currentColor) ──────────────── */

function Icon({
  size = 16,
  children,
  className,
  strokeWidth = 1.8,
}: {
  size?: number;
  children: React.ReactNode;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

const IcChevLeft = (p: { size?: number }) => (
  <Icon {...p}>
    <polyline points="15 18 9 12 15 6" />
  </Icon>
);
const IcCheck = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2.4}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const IcCopy = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);
const IcDownload = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Icon>
);
const IcCalendar = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Icon>
);
const IcPackage = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </Icon>
);
const IcWallet = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </Icon>
);
const IcTruck = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </Icon>
);
const IcMapPin = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);
const IcUser = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
  </Icon>
);
const IcPhone = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Icon>
);
const IcMessage = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);
const IcInfo = (p: { size?: number; className?: string }) => (
  <Icon {...p} strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Icon>
);
const IcAlert = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </Icon>
);
const IcImage = (p: { size?: number; className?: string }) => (
  <Icon {...p} strokeWidth={1.6}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </Icon>
);
const IcUndo = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);
const IcX = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);
const IcNote = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </Icon>
);
const IcWhatsapp = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
  </svg>
);
