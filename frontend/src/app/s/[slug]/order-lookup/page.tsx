"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStorefront } from "../StorefrontShell";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { IcArrowLeft, IcDownload } from "@/components/icons/Icons";
import { LeaveReviewForm } from "@/components/storefront/LeaveReviewForm";
import { lookupOrder, buyerCancelOrder } from "@/lib/storefrontApi";
import { ApiRequestError } from "@/lib/api";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { Order } from "@/lib/storefrontApi";
import { useI18n } from "@/hooks/useI18n";
import {
  EditAdvancePayment,
  EditDeliveryDetails,
} from "./EditableSections";

export default function StorefrontOrderLookupPage() {
  return (
    <Suspense>
      <StorefrontOrderLookup />
    </Suspense>
  );
}

function StorefrontOrderLookup() {
  const { shop } = useStorefront();
  const { locale } = useI18n();
  const params = useSearchParams();
  const initialRef = params.get("ref") ?? "";
  const initialPhone = params.get("phone") ?? "";
  const [ref, setRef] = useState(initialRef);
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const runLookup = async (refValue: string, phoneValue: string) => {
    setLoading(true);
    setError(null);
    try {
      const o = await lookupOrder(shop.slug, refValue, phoneValue);
      setOrder(o);
    } catch (err) {
      setOrder(null);
      setError(
        err instanceof ApiRequestError ? err.message : "Could not find order",
      );
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    runLookup(ref.trim(), phone.trim());
  };

  // Auto-submit when both ref + phone arrive via query params (deep-link from
  // marketplace order-lookup). Only runs once per pair to avoid loops.
  const autoLookedUp = useRef(false);
  useEffect(() => {
    if (autoLookedUp.current) return;
    if (initialRef && initialPhone) {
      autoLookedUp.current = true;
      runLookup(initialRef.trim(), initialPhone.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRef, initialPhone]);

  const cancel = async () => {
    if (!order || !cancelReason.trim()) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await buyerCancelOrder(
        shop.slug,
        order.id,
        phone.trim(),
        cancelReason.trim(),
      );
      setOrder(updated);
      setCancelReason("");
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not cancel order",
      );
    } finally {
      setCancelling(false);
    }
  };

  const area = order
    ? [order.delivery_district, order.delivery_division]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <section className="max-w-[640px] mx-auto px-4 py-10 pb-12">
      <Link
        href={`/s/${shop.slug}`}
        className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-3"
      >
        <IcArrowLeft size={14} /> Back
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-1">
        {locale === "bn" ? "অর্ডার ট্র্যাক করুন" : "Track your order"}
      </h1>
      <p className="text-stone-500 mb-5">
        {locale === "bn"
          ? "অর্ডার রেফারেন্স ও ফোন নম্বর দিন।"
          : "Enter your order reference and phone number."}
      </p>

      <Card className="p-5" hover={false}>
        <form onSubmit={submit} className="grid gap-3.5">
          <Input
            label={locale === "bn" ? "অর্ডার রেফারেন্স" : "Order reference"}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="Order id"
            required
          />
          <Input
            label={locale === "bn" ? "ফোন নম্বর" : "Phone number"}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01712 345 678"
            required
          />
          <Button type="submit" variant="primary" disabled={loading}>
            {loading
              ? "Searching…"
              : locale === "bn"
                ? "ট্র্যাক করুন"
                : "Track order"}
          </Button>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>
      </Card>

      {order && (
        <>
          <div className="mt-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight">
                {order.id.slice(0, 8)}
              </h2>
              <p className="text-stone-500 text-[13px] mt-0.5">
                {locale === "bn" ? "প্লেস হয়েছে" : "Placed"}{" "}
                {formatDateTime(order.created_at, locale)} · {shop.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/shops/by-slug/${shop.slug}/orders/${order.id}/invoice.pdf?phone=${encodeURIComponent(phone.trim())}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="neutral" size="sm">
                  <IcDownload size={13} />
                  {locale === "bn" ? "ইনভয়েস" : "Invoice"}
                </Button>
              </a>
              <Badge tone={statusTone(order.status)}>{order.status}</Badge>
            </div>
          </div>

          <Card className="p-5 mt-4" hover={false}>
            <OrderTimeline
              status={order.status}
              createdAt={order.created_at}
              updatedAt={order.updated_at}
              locale={locale}
            />
          </Card>

          <Card className="p-5 mt-4" hover={false}>
            <h3 className="text-sm font-semibold mb-3">
              {locale === "bn" ? "আইটেম" : "Items"}
            </h3>
            <div className="grid gap-1.5 text-sm text-stone-600 mb-3">
              {order.items.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>
                    {it.product_name_snapshot} × {it.quantity}
                  </span>
                  <span>{formatBDT(it.line_total_bdt, locale)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-200 pt-3 text-sm grid gap-1">
              <div className="flex justify-between text-stone-500">
                <span>{locale === "bn" ? "উপমোট" : "Subtotal"}</span>
                <span>{formatBDT(order.subtotal_bdt, locale)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>{locale === "bn" ? "ডেলিভারি" : "Delivery"}</span>
                <span>{formatBDT(order.delivery_charge_bdt, locale)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base mt-1">
                <span>{locale === "bn" ? "মোট" : "Total"}</span>
                <span>{formatBDT(order.total_bdt, locale)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 mt-4" hover={false}>
            <h3 className="text-sm font-semibold mb-2.5">
              {locale === "bn" ? "ডেলিভারি বিবরণ" : "Delivery details"}
            </h3>
            <div className="text-[13px] text-stone-600 leading-relaxed">
              <div className="font-medium text-stone-900">
                {order.customer_name}
              </div>
              <div>{order.customer_phone}</div>
              <div>
                {order.delivery_address}
                {area ? `, ${area}` : ""}
              </div>
            </div>
          </Card>

          {order.status === "delivered" && (
            <Card className="p-5 mt-4" hover={false}>
              <h3 className="text-sm font-semibold mb-3">
                {locale === "bn" ? "রিভিউ লিখুন" : "Leave a review"}
              </h3>
              <p className="text-[13px] text-stone-500 mb-3">
                {locale === "bn"
                  ? "প্রতিটি পণ্যের জন্য আলাদা রিভিউ দিতে পারেন।"
                  : "You can leave one review per product in this order."}
              </p>
              <div className="grid gap-3">
                {order.items.map((it) => (
                  <LeaveReviewForm
                    key={it.id}
                    orderItemId={it.id}
                    productName={it.product_name_snapshot}
                    customerPhone={phone.trim()}
                  />
                ))}
              </div>
            </Card>
          )}

          {order.status === "pending" && !order.advance_payment_received && (
            <div className="mt-4 px-4 py-3 rounded-md bg-blue-50 border border-blue-200 text-[13px] text-blue-900">
              {locale === "bn"
                ? "বিক্রেতা কনফার্ম করার আগ পর্যন্ত আপনি ডেলিভারি বিবরণ ও পেমেন্ট প্রমাণ পরিবর্তন করতে পারবেন।"
                : "You can update your delivery details and payment proof until the seller confirms this order."}
            </div>
          )}

          {order.status === "pending" && !order.advance_payment_received && (
            <EditDeliveryDetails
              shopSlug={shop.slug}
              order={order}
              customerPhone={phone.trim()}
              locale={locale === "bn" ? "bn" : "en"}
              onSaved={setOrder}
            />
          )}

          {order.advance_payment_required &&
            order.status === "pending" &&
            !order.advance_payment_received && (
              <EditAdvancePayment
                shopSlug={shop.slug}
                order={order}
                customerPhone={phone.trim()}
                locale={locale === "bn" ? "bn" : "en"}
                onSaved={setOrder}
              />
            )}

          {(order.status === "pending" || order.status === "confirmed") && (
            <Card className="p-5 mt-4" hover={false}>
              <h3 className="text-sm font-semibold mb-2">
                {locale === "bn" ? "এই অর্ডার বাতিল করুন" : "Cancel this order"}
              </h3>
              <Input
                label=""
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={
                  locale === "bn" ? "বাতিলের কারণ" : "Reason for cancelling"
                }
              />
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="mt-2"
                onClick={cancel}
                disabled={!cancelReason.trim() || cancelling}
              >
                {cancelling
                  ? locale === "bn"
                    ? "বাতিল হচ্ছে…"
                    : "Cancelling…"
                  : locale === "bn"
                    ? "অর্ডার বাতিল করুন"
                    : "Cancel order"}
              </Button>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

interface TimelineProps {
  status: string;
  createdAt: string;
  updatedAt: string;
  locale: "en" | "bn";
}

const orderSteps: { key: string; en: string; bn: string }[] = [
  { key: "pending", en: "Placed", bn: "প্লেস হয়েছে" },
  { key: "confirmed", en: "Confirmed", bn: "কনফার্ম হয়েছে" },
  { key: "shipped", en: "Shipped", bn: "শিপ হয়েছে" },
  { key: "delivered", en: "Delivered", bn: "ডেলিভার হয়েছে" },
];
const stepIndex = (status: string) =>
  orderSteps.findIndex((s) => s.key === status);

function OrderTimeline({
  status,
  createdAt,
  updatedAt,
  locale,
}: TimelineProps) {
  const cancelled = status === "cancelled";
  const currentIdx = cancelled ? -1 : stepIndex(status);

  return (
    <div className="grid gap-3.5">
      {orderSteps.map((s, i) => {
        const done = !cancelled && i < currentIdx;
        const active = !cancelled && i === currentIdx;
        const muted = cancelled || i > currentIdx;
        // Backend doesn't expose per-step timestamps yet (see to_implement_api.md).
        // Show created_at on the first step and updated_at on the active one.
        const date =
          i === 0
            ? formatDateTime(createdAt, locale)
            : active
              ? formatDateTime(updatedAt, locale)
              : "";
        return (
          <div key={s.key} className="flex gap-3.5 items-start">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full grid place-items-center text-[12px] font-semibold leading-none ${
                  done
                    ? "bg-teal-600 text-white"
                    : active
                      ? "bg-teal-50 text-teal-700 ring-2 ring-teal-600"
                      : "bg-stone-100 text-stone-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              {i < orderSteps.length - 1 && (
                <div
                  className={`w-[2px] flex-1 min-h-6 mt-1 ${
                    done ? "bg-teal-600" : "bg-stone-200"
                  }`}
                />
              )}
            </div>
            <div className="pb-2">
              <div
                className={`text-sm font-medium ${muted ? "text-stone-400" : "text-stone-900"}`}
              >
                {locale === "bn" ? s.bn : s.en}
              </div>
              {date ? (
                <div className="text-xs text-stone-500 mt-0.5">{date}</div>
              ) : (
                !cancelled &&
                i > currentIdx && (
                  <div className="text-xs text-stone-400 mt-0.5">
                    {locale === "bn" ? "অপেক্ষমাণ" : "Pending"}
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
      {cancelled && (
        <div className="text-xs text-red-600 font-medium pt-1 border-t border-stone-100">
          {locale === "bn" ? "অর্ডার বাতিল হয়েছে" : "Order cancelled"} ·{" "}
          {formatDateTime(updatedAt, locale)}
        </div>
      )}
    </div>
  );
}
