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
import AdvancePaymentSection, {
  emptyProof,
  type AdvanceProofState,
} from "./AdvancePaymentSection";

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
  const [proof, setProof] = useState<AdvanceProofState>(emptyProof);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    division?: string;
    district?: string;
    address?: string;
  }>({});
  const deliveryZones = delivery?.delivery_zones ?? [];

  // Matches the backend regex: BD numbers like 01XXXXXXXXX (also accepts +880/880 prefix).
  const validatePhone = (p: string) => {
    const trimmed = p.replace(/[\s-]/g, "");
    return /^(?:\+?880|0)1[3-9]\d{8}$/.test(trimmed);
  };

  const fieldMessages = {
    name_required:
      locale === "bn" ? "অনুগ্রহ করে আপনার নাম লিখুন।" : "Please enter your full name.",
    name_too_short: locale === "bn" ? "নামটি খুব ছোট।" : "Name is too short.",
    phone_required:
      locale === "bn" ? "অনুগ্রহ করে ফোন নম্বর লিখুন।" : "Please enter your phone number.",
    phone_invalid:
      locale === "bn"
        ? "ফোন নম্বরটি সঠিক নয়। যেমন 01712345678।"
        : "Phone number is invalid. Use a Bangladeshi number like 01712345678.",
    division_required:
      locale === "bn" ? "অনুগ্রহ করে বিভাগ বাছাই করুন।" : "Please select your division.",
    district_required:
      locale === "bn" ? "অনুগ্রহ করে জেলা বাছাই করুন।" : "Please select your district.",
    address_required:
      locale === "bn"
        ? "অনুগ্রহ করে একটি বৈধ ডেলিভারি ঠিকানা লিখুন।"
        : "Please enter a valid delivery address.",
    address_too_short:
      locale === "bn"
        ? "ঠিকানাটি খুব ছোট — বাড়ি, রোড ও এলাকা লিখুন।"
        : "Address looks too short — include house, road, and area.",
  } as const;

  const validate = () => {
    const next: typeof fieldErrors = {};
    if (!name.trim()) next.name = fieldMessages.name_required;
    else if (name.trim().length < 2) next.name = fieldMessages.name_too_short;
    if (!phone.trim()) next.phone = fieldMessages.phone_required;
    else if (!validatePhone(phone)) next.phone = fieldMessages.phone_invalid;
    if (!division) next.division = fieldMessages.division_required;
    if (!district) next.district = fieldMessages.district_required;
    if (!address.trim()) next.address = fieldMessages.address_required;
    else if (address.trim().length < 8)
      next.address = fieldMessages.address_too_short;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  // Resolve fee: matched zone → its fee; otherwise default delivery_charge.
  // Free delivery threshold wins regardless of zone.
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

  const matchedZone = division
    ? deliveryZones.find((z) => z.division === division)
    : undefined;
  const freeFromThreshold =
    !!delivery?.free_delivery_threshold &&
    cart.subtotal >=
      parseFloat(delivery.free_delivery_threshold ?? "0");

  const total = cart.subtotal + deliveryCharge;

  // Only disable the submit button for things validate() can't tell the user
  // about with an inline message — empty cart or missing advance-payment ack.
  // Per-field problems are surfaced as inline errors when the user submits.
  const proofComplete =
    !!proof.methodId &&
    proof.txnRef.trim().length > 0 &&
    !!proof.receiptUrl &&
    proof.acknowledged;

  const disabled =
    cart.items.length === 0 ||
    (delivery?.advance_payment_required && !proofComplete);

  // Map server-side per-field codes back onto the right inline field.
  const fieldFromCode: Record<string, keyof typeof fieldErrors> = {
    name_required: "name",
    name_too_short: "name",
    phone_required: "phone",
    phone_invalid: "phone",
    address_required: "address",
    address_too_short: "address",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
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
        ...(delivery?.advance_payment_required
          ? {
              advance_payment_method_id: proof.methodId,
              advance_payment_txn_ref: proof.txnRef.trim(),
              advance_payment_receipt: proof.receiptUrl,
            }
          : {}),
      });
      cart.clearCart();
      router.push(
        `/s/${shop.slug}/order-confirmed/${order.id}?phone=${encodeURIComponent(phone.trim())}`,
      );
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const field = fieldFromCode[err.code];
        if (field) {
          // Prefer the localized message we already have for this code.
          const msg =
            (fieldMessages as Record<string, string>)[err.code] ?? err.message;
          setFieldErrors((prev) => ({ ...prev, [field]: msg }));
        } else {
          setError(t(`errors.${err.code}`, err.message));
        }
      } else setError(t("errors.unknown"));
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
              <div>
                <Input
                  label={locale === "bn" ? "পুরো নাম" : "Full name"}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name)
                      setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder="Rifat Ahmed"
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <FieldError>{fieldErrors.name}</FieldError>
                )}
              </div>
              <div>
                <Input
                  label={locale === "bn" ? "ফোন নম্বর" : "Phone number"}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone)
                      setFieldErrors((p) => ({ ...p, phone: undefined }));
                  }}
                  placeholder="01712 345 678"
                  inputMode="tel"
                  aria-invalid={!!fieldErrors.phone}
                />
                {fieldErrors.phone && (
                  <FieldError>{fieldErrors.phone}</FieldError>
                )}
              </div>
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
                    if (fieldErrors.division)
                      setFieldErrors((p) => ({ ...p, division: undefined }));
                  }}
                  className={`w-full h-10 px-3 border rounded-md text-sm bg-white ${
                    fieldErrors.division
                      ? "border-red-400"
                      : "border-stone-300"
                  }`}
                  aria-invalid={!!fieldErrors.division}
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
                {fieldErrors.division && (
                  <FieldError>{fieldErrors.division}</FieldError>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  {locale === "bn" ? "জেলা" : "District"}
                </label>
                <select
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    if (fieldErrors.district)
                      setFieldErrors((p) => ({ ...p, district: undefined }));
                  }}
                  className={`w-full h-10 px-3 border rounded-md text-sm bg-white disabled:bg-stone-50 disabled:text-stone-400 ${
                    fieldErrors.district
                      ? "border-red-400"
                      : "border-stone-300"
                  }`}
                  disabled={!division}
                  aria-invalid={!!fieldErrors.district}
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
                {fieldErrors.district && (
                  <FieldError>{fieldErrors.district}</FieldError>
                )}
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
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (fieldErrors.address)
                    setFieldErrors((p) => ({ ...p, address: undefined }));
                }}
                placeholder={
                  locale === "bn"
                    ? "বাড়ি ৪২, রোড ১২, ধানমন্ডি"
                    : "House 42, Road 12, Dhanmondi"
                }
                aria-invalid={!!fieldErrors.address}
              />
              {fieldErrors.address && (
                <FieldError>{fieldErrors.address}</FieldError>
              )}
            </div>

            {/* Fee preview — shown immediately so the customer knows the cost
                before filling everything out. Updates when division changes. */}
            {delivery && (
              <div className="mt-3 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
                {locale === "bn" ? "ডেলিভারি চার্জ" : "Delivery charge"}:{" "}
                <span className="font-semibold text-stone-900">
                  {deliveryCharge === 0
                    ? locale === "bn"
                      ? "ফ্রি"
                      : "Free"
                    : formatBDT(deliveryCharge, locale)}
                </span>
                <span className="ml-2 text-stone-500">
                  {freeFromThreshold
                    ? locale === "bn"
                      ? "(অর্ডার সীমা পূরণ হয়েছে)"
                      : "(qualifies for free delivery)"
                    : matchedZone
                      ? `(${division})`
                      : !division
                        ? locale === "bn"
                          ? "(ডিফল্ট রেট — এলাকা বাছাই করলে আপডেট হবে)"
                          : "(default rate — updates when you pick an area)"
                        : locale === "bn"
                          ? "(ডিফল্ট রেট)"
                          : "(default rate)"}
                </span>
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
            <AdvancePaymentSection
              shopSlug={shop.slug}
              locale={locale === "bn" ? "bn" : "en"}
              instructions={delivery.advance_payment_instructions}
              value={proof}
              onChange={setProof}
            />
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

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-red-600 mt-1.5" role="alert">
      {children}
    </p>
  );
}
