"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  cancelReservation,
  CartReservation,
  clearStoredReservation,
  ensureReservation,
  msUntilExpiry,
  pickUpReservation,
} from "@/lib/cartReservationApi";
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

  // ── Reservation phase machine ──────────────────────────────────
  // 'form'    — buyer is filling in name / phone / address. No stock
  //             is held yet, so opening checkout costs nothing.
  // 'payment' — buyer clicked "Pay delivery fee", we created a
  //             reservation, the timer is ticking, and the advance-
  //             payment proof section is visible. Stock is held.
  //
  // The reservation is created on the explicit "Pay delivery fee"
  // click, never on mount, so the cart icon and visible stock only
  // change once the buyer has actually committed to paying.
  const [phase, setPhase] = useState<"form" | "payment">("form");
  const [reservation, setReservation] = useState<CartReservation | null>(null);
  const [reservationError, setReservationError] = useState<{
    code: string;
    msg: string;
  } | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Stable fingerprint of cart contents so we can detect changes
  // (e.g. buyer left, edited their cart, came back) without churning.
  const cartFingerprint = useMemo(
    () =>
      cart.items
        .slice()
        .sort((a, b) => a.productId.localeCompare(b.productId))
        .map((it) => `${it.productId}:${it.quantity}`)
        .join(","),
    [cart.items],
  );
  const cartReservationItems = useMemo(
    () =>
      cart.items.map((it) => ({
        product_id: it.productId,
        quantity: it.quantity,
      })),
    [cart.items],
  );
  const cartItemsRef = useRef(cartReservationItems);
  cartItemsRef.current = cartReservationItems;

  // Mount / cart-change pickup: only RESUME an existing matching
  // hold (the buyer returning to a payment they started earlier).
  // Never auto-create — that's what the "Pay delivery fee" button
  // is for. If the stored hold is dead or doesn't match the cart,
  // pickUpReservation cancels it server-side and clears local state.
  useEffect(() => {
    let cancelled = false;
    if (cart.items.length === 0) {
      setReservation(null);
      setPhase("form");
      return;
    }
    pickUpReservation(shop.slug, cartItemsRef.current)
      .then((existing) => {
        if (cancelled) return;
        if (existing) {
          setReservation(existing);
          setPhase("payment");
        } else {
          setReservation(null);
          setPhase("form");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setReservation(null);
        setPhase("form");
      });
    return () => {
      cancelled = true;
    };
  }, [shop.slug, cartFingerprint, cart.items.length]);

  // Tick the countdown every second so the UI reflects the remaining
  // window. When time is up we flip secondsRemaining to 0 and rely on
  // `expired` (derived) to lock the Place Order button.
  useEffect(() => {
    if (!reservation) {
      setSecondsRemaining(0);
      return;
    }
    function tick() {
      setSecondsRemaining(
        Math.max(0, Math.ceil(msUntilExpiry(reservation!.expires_at) / 1000)),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [reservation]);

  const expired =
    !!reservation &&
    secondsRemaining === 0 &&
    reservation.status !== "consumed";

  // "Pay delivery fee" — the explicit transition from form to payment.
  // We validate the buyer-info form first (so they don't lock stock
  // for an order they can't place), then create the hold.
  async function startPayment() {
    if (!validate()) return;
    setReservationLoading(true);
    setReservationError(null);
    try {
      const fresh = await ensureReservation(shop.slug, cartItemsRef.current);
      setReservation(fresh);
      setPhase("payment");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setReservationError({ code: err.code, msg: err.message });
      } else {
        setReservationError({
          code: "unknown",
          msg: "Could not hold your cart — please try again.",
        });
      }
    } finally {
      setReservationLoading(false);
    }
  }

  // "Edit details" / "Restart hold" — release the current hold so
  // its stock goes back to other buyers immediately, and drop back
  // to the form so the buyer can change anything they want.
  async function backToForm() {
    if (reservation?.id) {
      try {
        await cancelReservation(shop.slug, reservation.id);
      } catch {
        /* already non-active or vanished — fine */
      }
    }
    clearStoredReservation(shop.slug);
    setReservation(null);
    setProof(emptyProof);
    setPhase("form");
    setReservationError(null);
  }

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

  // Place Order is only enabled when:
  //   - cart isn't empty
  //   - if the shop requires advance: we're past the form phase, the
  //     buyer has filled in their proof, the timer hasn't run out, and
  //     a reservation actually exists.
  //   - if the shop doesn't require advance: nothing extra, the
  //     legacy stock-decrement-at-place path handles it.
  const advanceRequired = !!delivery?.advance_payment_required;
  const disabled =
    cart.items.length === 0 ||
    (advanceRequired &&
      (phase !== "payment" || !proofComplete || expired || !reservation));

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
        reservation_id: reservation?.id,
        ...(delivery?.advance_payment_required
          ? {
              advance_payment_method_id: proof.methodId,
              advance_payment_txn_ref: proof.txnRef.trim(),
              advance_payment_receipt: proof.receiptUrl,
            }
          : {}),
      });
      // Order placed — the reservation is now consumed. Clear local
      // state so a refresh of the cart doesn't try to re-use an
      // already-consumed hold.
      clearStoredReservation(shop.slug);
      cart.clearCart();
      router.push(
        `/s/${shop.slug}/order-confirmed/${order.id}?phone=${encodeURIComponent(phone.trim())}`,
      );
    } catch (err) {
      if (err instanceof ApiRequestError) {
        // The reservation went stale between rendering the form and
        // submitting (sweeper expired it, or another tab consumed it).
        // Drop the dead hold and let the user click "Restart hold" to
        // grab a new one.
        if (
          err.code === "reservation_expired" ||
          err.code === "reservation_consumed" ||
          err.code === "reservation_not_found"
        ) {
          // Hold went stale between rendering the form and submitting
          // — drop everything and bounce the buyer back to the form
          // so they can re-click "Pay delivery fee".
          clearStoredReservation(shop.slug);
          setReservation(null);
          setProof(emptyProof);
          setPhase("form");
          setReservationError({ code: err.code, msg: err.message });
        } else {
          const field = fieldFromCode[err.code];
          if (field) {
            // Prefer the localized message we already have for this code.
            const msg =
              (fieldMessages as Record<string, string>)[err.code] ?? err.message;
            setFieldErrors((prev) => ({ ...prev, [field]: msg }));
          } else {
            setError(t(`errors.${err.code}`, err.message));
          }
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

      {/* Reservation banner only shows once we're in the payment phase
          (or there's a hard error to surface). In the form phase we're
          deliberately silent — no countdown until the buyer commits. */}
      {(phase === "payment" || reservationError) && (
        <ReservationStatus
          loading={reservationLoading}
          reservation={reservation}
          secondsRemaining={secondsRemaining}
          expired={expired}
          error={reservationError}
          locale={locale}
          onRestart={backToForm}
        />
      )}

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

          {/* Advance payment section is hidden until the buyer clicks
              "Pay delivery fee" — that's the moment we create the
              reservation, and the moment they actually need to start
              paying. Showing it earlier would be confusing because
              the timer wouldn't yet be running. */}
          {advanceRequired && phase === "payment" && (
            <AdvancePaymentSection
              shopSlug={shop.slug}
              locale={locale === "bn" ? "bn" : "en"}
              instructions={delivery?.advance_payment_instructions}
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

            {/* Bottom action — three modes:
                 1. Shop doesn't require advance: a single "Place order"
                    button submits the form (legacy stock path; no
                    reservation needed).
                 2. Shop requires advance, phase=form: show "Pay
                    delivery fee" — clicking validates the form,
                    creates the reservation, and flips to payment.
                 3. Shop requires advance, phase=payment: show "Place
                    order" + a smaller "Edit details" link to back out. */}
            {!advanceRequired ? (
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
            ) : phase === "form" ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full mt-4"
                  onClick={startPayment}
                  disabled={
                    cart.items.length === 0 || reservationLoading
                  }
                >
                  {reservationLoading
                    ? locale === "bn"
                      ? "হোল্ড করা হচ্ছে…"
                      : "Holding your cart…"
                    : locale === "bn"
                      ? "ডেলিভারি ফি পেমেন্ট করুন"
                      : "Pay delivery fee"}
                </Button>
                <p className="text-[12px] text-stone-500 mt-2 leading-snug">
                  {locale === "bn"
                    ? "ডেলিভারি ফি পেমেন্ট করার পর ১৫ মিনিটের জন্য আপনার পণ্য হোল্ড থাকবে।"
                    : "Once you tap pay, we'll hold your items for 15 minutes while you complete the delivery fee."}
                </p>
              </>
            ) : (
              <>
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
                <button
                  type="button"
                  onClick={backToForm}
                  className="w-full mt-2 text-[13px] font-medium text-stone-600 hover:text-stone-900 underline-offset-4 hover:underline"
                >
                  {locale === "bn"
                    ? "← তথ্য পরিবর্তন করুন (হোল্ড বাতিল হবে)"
                    : "← Edit details (releases hold)"}
                </button>
              </>
            )}
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

/* ── Reservation banner ──────────────────────────────────────────
   Renders one of four states above the form:
   1. Loading   — placing the hold (just landed on checkout)
   2. Active    — countdown clock with how much time the buyer has left
   3. Expired   — soft block + "Restart hold" button
   4. Error     — something went wrong (e.g. insufficient stock at hold time)
*/
function ReservationStatus({
  loading,
  reservation,
  secondsRemaining,
  expired,
  error,
  locale,
  onRestart,
}: {
  loading: boolean;
  reservation: CartReservation | null;
  secondsRemaining: number;
  expired: boolean;
  error: { code: string; msg: string } | null;
  locale: "en" | "bn";
  onRestart: () => void;
}) {
  if (loading && !reservation) {
    return (
      <div className="mb-5 px-4 py-3 rounded-md bg-stone-100 border border-stone-200 text-sm text-stone-700">
        {locale === "bn"
          ? "আপনার কার্ট হোল্ড করা হচ্ছে…"
          : "Holding your cart…"}
      </div>
    );
  }
  if (error) {
    return (
      <div className="mb-5 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-3">
        <span className="flex-1">{translatedReservationError(error, locale)}</span>
        <button
          type="button"
          onClick={onRestart}
          className="text-sm font-semibold text-red-700 hover:underline whitespace-nowrap"
        >
          {locale === "bn" ? "আবার চেষ্টা করুন" : "Try again"}
        </button>
      </div>
    );
  }
  if (expired) {
    return (
      <div className="mb-5 px-4 py-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-center gap-3">
        <span className="flex-1">
          {locale === "bn"
            ? "আপনার হোল্ড শেষ হয়ে গেছে — অর্ডার দেওয়ার জন্য নতুন করে শুরু করুন।"
            : "Your hold has expired — please restart to place the order."}
        </span>
        <button
          type="button"
          onClick={onRestart}
          className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
        >
          {locale === "bn" ? "আবার শুরু করুন" : "Restart hold"}
        </button>
      </div>
    );
  }
  if (!reservation) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const urgent = secondsRemaining > 0 && secondsRemaining <= 60;

  return (
    <div
      className={`mb-5 px-4 py-3 rounded-md border text-sm flex items-center gap-3 ${
        urgent
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-teal-50 border-teal-200 text-teal-900"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span className="flex-1">
        {locale === "bn" ? (
          <>
            আপনার কার্ট{" "}
            <strong className="font-mono">
              {mm}:{ss}
            </strong>{" "}
            পর্যন্ত হোল্ড আছে। সময়মতো অর্ডার সম্পন্ন করুন।
          </>
        ) : (
          <>
            We're holding your cart for{" "}
            <strong className="font-mono">
              {mm}:{ss}
            </strong>{" "}
            — finish checkout before the timer runs out.
          </>
        )}
      </span>
    </div>
  );
}

function translatedReservationError(
  error: { code: string; msg: string },
  locale: "en" | "bn",
): string {
  switch (error.code) {
    case "insufficient_stock":
      return locale === "bn"
        ? "এই পরিমাণ স্টকে নেই — কম পরিমাণে চেষ্টা করুন।"
        : "Not enough stock for one or more items — try a smaller quantity.";
    case "reservation_expired":
      return locale === "bn"
        ? "আপনার হোল্ড শেষ হয়েছে।"
        : "Your hold expired.";
    case "reservation_consumed":
      return locale === "bn"
        ? "এই হোল্ডে ইতিমধ্যে অর্ডার করা হয়েছে।"
        : "This hold has already been used.";
    case "reservation_not_found":
      return locale === "bn"
        ? "হোল্ড পাওয়া যায়নি।"
        : "Hold not found — please restart.";
    default:
      return error.msg;
  }
}
