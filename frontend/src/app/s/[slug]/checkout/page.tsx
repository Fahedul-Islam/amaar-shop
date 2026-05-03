"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStorefront } from "../StorefrontShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { IcArrowLeft } from "@/components/icons/Icons";
import { formatBDT } from "@/lib/format";
import { placeOrder } from "@/lib/storefrontApi";
import { ApiRequestError } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import { BD_DIVISIONS, BD_DISTRICTS, type Division } from "@/lib/bdGeo";

export default function CheckoutPage() {
  const { shop, delivery, cart } = useStorefront();
  const { locale, t } = useI18n();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [division, setDivision] = useState<Division | "">("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deliveryZones = delivery?.delivery_zones ?? [];

  // Resolve fee: matched zone → its fee; otherwise default delivery_charge.
  const deliveryCharge = useMemo(() => {
    if (!delivery) return 0;
    let fee = parseFloat(delivery.delivery_charge);
    if (division) {
      const zone = deliveryZones.find((z) => z.division === division);
      if (zone) {
        const zf = parseFloat(zone.delivery_charge);
        if (Number.isFinite(zf)) fee = zf;
      }
    }
    if (delivery.free_delivery_threshold) {
      const th = parseFloat(delivery.free_delivery_threshold);
      if (cart.subtotal >= th) return 0;
    }
    return Number.isFinite(fee) ? fee : 0;
  }, [delivery, deliveryZones, division, cart.subtotal]);

  const total = cart.subtotal + deliveryCharge;

  const disabled =
    cart.items.length === 0 ||
    !name.trim() ||
    !phone.trim() ||
    !address.trim() ||
    !division ||
    !district ||
    (delivery?.advance_payment_required && !ack);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await placeOrder(shop.slug, {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_address: address.trim(),
        delivery_division: division,
        delivery_district: district,
        note: note.trim() || undefined,
        items: cart.items.map((it) => ({
          product_id: it.productId,
          quantity: it.quantity,
        })),
      });
      cart.clearCart();
      router.push(
        `/s/${shop.slug}/order-confirmed/${order.id}?phone=${encodeURIComponent(phone.trim())}`,
      );
    } catch (err) {
      if (err instanceof ApiRequestError)
        setError(t(`errors.${err.code}`, err.message));
      else setError(t("errors.unknown"));
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">
          {locale === "bn" ? "আপনার কার্ট খালি" : "Your cart is empty"}
        </h1>
        <Link href={`/s/${shop.slug}`} className="text-teal-600">
          ← Back to shop
        </Link>
      </div>
    );
  }

  return (
    <section className="max-w-[1000px] mx-auto px-4 py-6 pb-16">
      <Link
        href={`/s/${shop.slug}`}
        className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-4"
      >
        <IcArrowLeft size={14} />{" "}
        {locale === "bn" ? "ফিরে যান" : "Back to shopping"}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-5">
        {locale === "bn" ? "চেকআউট" : "Checkout"}
      </h1>

      <form
        onSubmit={submit}
        className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="grid gap-5">
          {/* Contact details */}
          <Card className="p-5" hover={false}>
            <h2 className="text-base font-semibold mb-3.5">
              {locale === "bn" ? "যোগাযোগ" : "Contact details"}
            </h2>
            <div className="grid gap-3">
              <Input
                label={locale === "bn" ? "পুরো নাম" : "Full name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rifat Ahmed"
                required
              />
              <Input
                label={locale === "bn" ? "ফোন নম্বর" : "Phone number"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01712 345 678"
                required
              />
            </div>
          </Card>

          {/* Delivery area */}
          <Card className="p-5" hover={false}>
            <h2 className="text-base font-semibold">
              {locale === "bn" ? "ডেলিভারি এলাকা" : "Delivery area"}
            </h2>
            <p className="text-sm text-stone-500 mt-1 mb-3.5">
              {locale === "bn"
                ? "আপনার বিভাগ ও জেলা নির্বাচন করুন"
                : "Select your division and district"}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  {locale === "bn" ? "বিভাগ" : "Division"}
                </label>
                <select
                  value={division}
                  onChange={(e) => {
                    setDivision(e.target.value as Division);
                    setDistrict("");
                  }}
                  className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white"
                  required
                >
                  <option value="">
                    {locale === "bn" ? "বিভাগ বাছাই করুন…" : "Select division…"}
                  </option>
                  {BD_DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  {locale === "bn" ? "জেলা" : "District"}
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white disabled:bg-stone-50 disabled:text-stone-400"
                  disabled={!division}
                  required
                >
                  <option value="">
                    {locale === "bn" ? "জেলা বাছাই করুন…" : "Select district…"}
                  </option>
                  {division &&
                    BD_DISTRICTS[division].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <Textarea
                label={
                  locale === "bn"
                    ? "বিস্তারিত ঠিকানা (বাড়ি, রোড, ল্যান্ডমার্ক)"
                    : "Detailed address (house, road, landmark)"
                }
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={
                  locale === "bn"
                    ? "বাড়ি ৪২, রোড ১২, ধানমন্ডি"
                    : "House 42, Road 12, Dhanmondi"
                }
                required
              />
            </div>

            {/* Fee preview */}
            {division && (
              <div className="mt-3 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
                {locale === "bn" ? "ডেলিভারি চার্জ" : "Delivery charge"}:{" "}
                <span className="font-semibold text-stone-900">
                  {deliveryCharge === 0
                    ? locale === "bn"
                      ? "ফ্রি"
                      : "Free"
                    : formatBDT(deliveryCharge, locale)}
                </span>
                {!deliveryZones.some((z) => z.division === division) && (
                  <span className="ml-2 text-stone-500">
                    ({locale === "bn" ? "ডিফল্ট রেট" : "default rate"})
                  </span>
                )}
              </div>
            )}
          </Card>

          {/* Note */}
          <Card className="p-5" hover={false}>
            <Textarea
              label={locale === "bn" ? "নোট (ঐচ্ছিক)" : "Note (optional)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                locale === "bn"
                  ? "বিশেষ নির্দেশনা…"
                  : "Any special instructions…"
              }
            />
          </Card>

          {/* Advance payment */}
          {delivery?.advance_payment_required && (
            <Card className="p-5" hover={false}>
              <h2 className="text-base font-semibold mb-2">
                {locale === "bn" ? "অগ্রিম পেমেন্ট" : "Advance payment"}
              </h2>
              <p className="text-sm text-stone-600 mb-3 whitespace-pre-line">
                {delivery.advance_payment_instructions}
              </p>
              <label className="flex items-start gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="accent-teal-600 mt-1"
                />
                {locale === "bn"
                  ? "আমি বুঝেছি যে অগ্রিম পেমেন্ট প্রয়োজন।"
                  : "I understand advance payment is required."}
              </label>
            </Card>
          )}
        </div>

        {/* Order summary */}
        <div>
          <Card className="p-5 md:sticky md:top-20" hover={false}>
            <h2 className="text-base font-semibold mb-3.5">
              {locale === "bn" ? "অর্ডার সারাংশ" : "Order summary"}
            </h2>
            <div className="grid gap-2.5 mb-3.5">
              {cart.items.map((it) => (
                <div key={it.productId} className="flex gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug line-clamp-1">
                      {it.name}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Qty {it.quantity}
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {formatBDT(parseFloat(it.price) * it.quantity, locale)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-200 pt-3 grid gap-1.5">
              <div className="flex justify-between text-sm text-stone-600">
                <span>{locale === "bn" ? "উপমোট" : "Subtotal"}</span>
                <span>{formatBDT(cart.subtotal, locale)}</span>
              </div>
              <div className="flex justify-between text-sm text-stone-600">
                <span>{locale === "bn" ? "ডেলিভারি" : "Delivery"}</span>
                <span>
                  {deliveryCharge === 0
                    ? locale === "bn"
                      ? "ফ্রি"
                      : "Free"
                    : formatBDT(deliveryCharge, locale)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold mt-1.5">
                <span>{locale === "bn" ? "মোট পরিশোধ" : "Total"}</span>
                <span>{formatBDT(total, locale)}</span>
              </div>
            </div>
            {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-4"
              disabled={disabled || submitting}
            >
              {submitting
                ? locale === "bn"
                  ? "অর্ডার হচ্ছে…"
                  : "Placing order…"
                : locale === "bn"
                  ? "অর্ডার কনফার্ম করুন"
                  : "Place order"}
            </Button>
          </Card>
        </div>
      </form>
    </section>
  );
}
