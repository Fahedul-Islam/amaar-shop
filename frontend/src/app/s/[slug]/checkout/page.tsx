"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStorefront } from "../StorefrontShell";
import { formatBDT } from "@/lib/format";
import { placeOrder } from "@/lib/storefrontApi";
import { ApiRequestError } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import { BD_DIVISIONS, BD_DISTRICTS, type Division } from "@/lib/bdGeo";
import {
  clearBuyerDetails,
  hasStoredDetails,
  loadBuyerDetails,
  saveBuyerDetails,
} from "@/lib/buyerDetails";
import {
  cancelReservation,
  CartReservation,
  clearStoredReservation,
  ensureReservation,
  msUntilExpiry,
  pickUpReservation,
} from "@/lib/cartReservationApi";
import {
  PaymentMethod,
  getPublicPaymentMethods,
  numberTypeLabel,
  providerLabel,
  uploadReceipt,
} from "@/lib/paymentMethodApi";

// Reservation duration mirrors the backend constant. Used by the
// progress-bar % calculation so the bar matches the timer 1:1.
const HOLD_DURATION_SEC = 15 * 60;

export default function CheckoutPage() {
  const { shop, delivery, cart } = useStorefront();
  const { locale, t } = useI18n();
  const router = useRouter();

  // Prefilled from the buyer's own device when they've ordered before, so a
  // repeat purchase is a review-and-confirm instead of five fields of typing.
  // Lazy initialisers keep this to a single read and avoid a flash of empty
  // inputs.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [division, setDivision] = useState<Division | "">("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Restored after mount rather than during render: the server has no access
  // to localStorage, so seeding initial state directly would make the server
  // and client markup disagree.
  useEffect(() => {
    const saved = loadBuyerDetails();
    if (!hasStoredDetails(saved)) return;
    setName(saved.name);
    setPhone(saved.phone);
    setDivision(saved.division);
    setDistrict(saved.district);
    setAddress(saved.address);
    setPrefilled(true);
  }, []);

  const forgetMe = () => {
    clearBuyerDetails();
    setName("");
    setPhone("");
    setDivision("");
    setDistrict("");
    setAddress("");
    setPrefilled(false);
  };
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
  const [phase, setPhase] = useState<"form" | "payment">("form");
  const [reservation, setReservation] = useState<CartReservation | null>(null);
  const [reservationError, setReservationError] = useState<{
    code: string;
    msg: string;
  } | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // ── Proof state (advance payment) ──────────────────────────────
  const [methodId, setMethodId] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState(false);

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

  // ── Load payment methods once ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getPublicPaymentMethods(shop.slug)
      .then((m) => {
        if (cancelled) return;
        setMethods(m);
        if (m.length === 1 && !methodId) setMethodId(m[0].id);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.slug]);

  // ── Mount pickup: resume an existing matching hold, never auto-create ──
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

  // ── Countdown tick ────────────────────────────────────────────
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

  // ── Validation ────────────────────────────────────────────────
  const validatePhone = (p: string) => {
    const trimmed = p.replace(/[\s-]/g, "");
    return /^(?:\+?880|0)1[3-9]\d{8}$/.test(trimmed);
  };

  const fieldMessages = useMemo(
    () =>
      ({
        name_required:
          locale === "bn"
            ? "অনুগ্রহ করে আপনার নাম লিখুন।"
            : "Please enter your full name.",
        name_too_short:
          locale === "bn" ? "নামটি খুব ছোট।" : "Name is too short.",
        phone_required:
          locale === "bn"
            ? "অনুগ্রহ করে ফোন নম্বর লিখুন।"
            : "Please enter your phone number.",
        phone_invalid:
          locale === "bn"
            ? "ফোন নম্বরটি সঠিক নয়। যেমন 01712345678।"
            : "Phone number is invalid. Use a Bangladeshi number like 01712345678.",
        division_required:
          locale === "bn"
            ? "অনুগ্রহ করে বিভাগ বাছাই করুন।"
            : "Please select your division.",
        district_required:
          locale === "bn"
            ? "অনুগ্রহ করে জেলা বাছাই করুন।"
            : "Please select your district.",
        address_required:
          locale === "bn"
            ? "অনুগ্রহ করে একটি বৈধ ডেলিভারি ঠিকানা লিখুন।"
            : "Please enter a valid delivery address.",
        address_too_short:
          locale === "bn"
            ? "ঠিকানাটি খুব ছোট — বাড়ি, রোড ও এলাকা লিখুন।"
            : "Address looks too short — include house, road, and area.",
      }) as const,
    [locale],
  );

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

  // ── Derived completion + fees ─────────────────────────────────
  const detailsFilled = !!name.trim() && validatePhone(phone);
  const deliveryFilled =
    !!division && !!district && address.trim().length >= 8;

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
    cart.subtotal >= parseFloat(delivery.free_delivery_threshold ?? "0");
  const total = cart.subtotal + deliveryCharge;

  const advanceRequired = !!delivery?.advance_payment_required;
  const proofComplete =
    !!methodId && txnRef.trim().length > 0 && !!receiptUrl && confirmed;
  const disabled =
    cart.items.length === 0 ||
    (advanceRequired &&
      (phase !== "payment" || !proofComplete || expired || !reservation));

  const selectedMethod = methods.find((m) => m.id === methodId);

  const fieldFromCode: Record<string, keyof typeof fieldErrors> = {
    name_required: "name",
    name_too_short: "name",
    phone_required: "phone",
    phone_invalid: "phone",
    address_required: "address",
    address_too_short: "address",
  };

  // ── Phase transitions ─────────────────────────────────────────
  async function startPayment() {
    if (!validate()) return;
    if (methods.length === 0) {
      setReservationError({
        code: "no_methods",
        msg:
          locale === "bn"
            ? "এই দোকানে এখনো কোনো পেমেন্ট মাধ্যম যোগ করা হয়নি।"
            : "This shop hasn't published any payment methods yet.",
      });
      return;
    }
    setReservationLoading(true);
    setReservationError(null);
    try {
      const fresh = await ensureReservation(shop.slug, cartItemsRef.current);
      setReservation(fresh);
      setPhase("payment");
      if (!methodId && methods.length > 0) setMethodId(methods[0].id);
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

  async function backToForm() {
    if (reservation?.id) {
      try {
        await cancelReservation(shop.slug, reservation.id);
      } catch {
        /* ignore */
      }
    }
    clearStoredReservation(shop.slug);
    setReservation(null);
    setTxnRef("");
    setReceiptUrl("");
    setReceiptName("");
    setConfirmed(false);
    setPhase("form");
    setReservationError(null);
  }

  // ── Submit ─────────────────────────────────────────────────────
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
        ...(advanceRequired
          ? {
              advance_payment_method_id: methodId,
              advance_payment_txn_ref: txnRef.trim(),
              advance_payment_receipt: receiptUrl,
            }
          : {}),
      });
      // Remember for next time only once the order actually succeeded.
      saveBuyerDetails({
        name: name.trim(),
        phone: phone.trim(),
        division,
        district,
        address: address.trim(),
      });
      clearStoredReservation(shop.slug);
      cart.clearCart();
      router.push(
        `/s/${shop.slug}/order-confirmed/${order.id}?phone=${encodeURIComponent(phone.trim())}`,
      );
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (
          err.code === "reservation_expired" ||
          err.code === "reservation_consumed" ||
          err.code === "reservation_not_found"
        ) {
          clearStoredReservation(shop.slug);
          setReservation(null);
          setTxnRef("");
          setReceiptUrl("");
          setReceiptName("");
          setConfirmed(false);
          setPhase("form");
          setReservationError({ code: err.code, msg: err.message });
        } else {
          const field = fieldFromCode[err.code];
          if (field) {
            const msg =
              (fieldMessages as Record<string, string>)[err.code] ??
              err.message;
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

  // ── Receipt upload handler ────────────────────────────────────
  async function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadError(null);
    if (f.size > 5 * 1024 * 1024) {
      setUploadError(
        locale === "bn"
          ? "ফাইল ৫ MB-এর কম হতে হবে।"
          : "File must be 5 MB or smaller.",
      );
      return;
    }
    setUploading(true);
    try {
      const url = await uploadReceipt(shop.slug, f);
      setReceiptUrl(url);
      setReceiptName(f.name);
    } catch {
      setUploadError(
        locale === "bn"
          ? "আপলোড ব্যর্থ।"
          : "Upload failed — please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function copyNumber(value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 1400);
    });
  }

  // ── Empty cart ────────────────────────────────────────────────
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

  // ── Step 1/2/3 logic for the progress bar ─────────────────────
  let currentStep: 1 | 2 | 3 = 1;
  if (detailsFilled && !deliveryFilled) currentStep = 2;
  else if (detailsFilled && deliveryFilled) currentStep = 3;

  const totalPayNow = advanceRequired ? deliveryCharge : total;
  const codAmount = advanceRequired ? cart.subtotal : 0;

  return (
    <section className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-20">
      {/* Back link */}
      <Link
        href={`/s/${shop.slug}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-600 hover:text-stone-900 mb-4"
      >
        <IcChevLeft size={14} />
        {locale === "bn" ? "ফিরে যান" : "Back to shopping"}
      </Link>

      {/* Page head */}
      <div className="mb-2">
        <h1 className="text-[28px] sm:text-[30px] font-bold tracking-[-0.02em] leading-tight">
          {locale === "bn"
            ? "প্রায় শেষ — চলুন অর্ডার পাঠাই"
            : "Almost there — let's get your order on the way"}
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          {locale === "bn"
            ? "এক মিনিটেই হয়ে যাবে। শিপ হলে আপনাকে SMS পাঠানো হবে।"
            : "It only takes a minute. We'll text you once it ships."}
        </p>
      </div>

      {/* Hold timer (payment phase only) */}
      {phase === "payment" && reservation && !expired && (
        <HoldTimer
          secondsRemaining={secondsRemaining}
          locale={locale === "bn" ? "bn" : "en"}
        />
      )}
      {expired && (
        <div className="mt-5 mb-5 px-4 py-3 rounded-[12px] bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-center gap-3">
          <span className="flex-1">
            {locale === "bn"
              ? "আপনার হোল্ড শেষ হয়ে গেছে — অর্ডার দেওয়ার জন্য তথ্য পরিবর্তন করে আবার শুরু করুন।"
              : "Your hold has expired — edit the form and tap pay again to restart."}
          </span>
          <button
            type="button"
            onClick={backToForm}
            className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            {locale === "bn" ? "আবার শুরু করুন" : "Restart"}
          </button>
        </div>
      )}
      {reservationError && !expired && (
        <div className="mt-5 mb-5 px-4 py-3 rounded-[12px] bg-red-50 border border-red-200 text-sm text-red-800">
          {translateReservationError(reservationError, locale)}
        </div>
      )}

      {/* Steps */}
      {advanceRequired && (
        <Steps currentStep={currentStep} locale={locale === "bn" ? "bn" : "en"} />
      )}

      <form
        onSubmit={submit}
        className="grid gap-[22px] lg:grid-cols-[minmax(0,1fr)_380px] items-start"
      >
        {/* ── LEFT: form sections ────────────────────────── */}
        <div>
          {/* Section 1: Contact details */}
          <Section
            num={1}
            title={locale === "bn" ? "যোগাযোগ" : "Contact details"}
            description={
              locale === "bn"
                ? "যাতে আমরা আপনাকে অর্ডার নিয়ে SMS বা কল দিতে পারি।"
                : "So we can text or call you about the order."
            }
            filled={detailsFilled}
            filledLabel={locale === "bn" ? "পূর্ণ" : "Filled"}
          >
            {prefilled && (
              <div className="flex items-center gap-2 flex-wrap mb-3.5 px-3.5 py-2.5 rounded-[10px] bg-teal-50 border border-teal-100">
                <span className="text-[13px] text-teal-900">
                  {locale === "bn"
                    ? "আপনার আগের তথ্য বসানো হয়েছে — দেখে নিন।"
                    : "We filled in your details from last time — check them below."}
                </span>
                <button
                  type="button"
                  onClick={forgetMe}
                  className="ml-auto text-[12.5px] font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800"
                >
                  {locale === "bn" ? "আপনি নন? মুছুন" : "Not you? Clear"}
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field
                label={locale === "bn" ? "পুরো নাম" : "Full name"}
                required
                error={fieldErrors.name}
              >
                <InputWithIcon
                  icon={<IcUser size={16} />}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name)
                      setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder={
                    locale === "bn" ? "আপনার পুরো নাম" : "As on your ID"
                  }
                  invalid={!!fieldErrors.name}
                />
              </Field>
              <Field
                label={locale === "bn" ? "ফোন নম্বর" : "Phone number"}
                required
                error={fieldErrors.phone}
              >
                <InputWithLead
                  lead="+880"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone)
                      setFieldErrors((p) => ({ ...p, phone: undefined }));
                  }}
                  placeholder="1712 345 678"
                  inputMode="tel"
                  invalid={!!fieldErrors.phone}
                />
              </Field>
            </div>
          </Section>

          {/* Section 2: Delivery */}
          <Section
            num={2}
            title={locale === "bn" ? "ডেলিভারি ঠিকানা" : "Delivery address"}
            description={
              locale === "bn"
                ? "অর্ডার কোথায় পাঠাবো? এলাকা বাছাই করলে চার্জ আপডেট হবে।"
                : "Where should we send your order? Charge updates as you choose."
            }
            filled={deliveryFilled}
            filledLabel={locale === "bn" ? "পূর্ণ" : "Filled"}
          >
            <Field
              label={locale === "bn" ? "এলাকা বাছাই করুন" : "Choose your area"}
              required
              error={fieldErrors.division || fieldErrors.district}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Select
                  value={division}
                  onChange={(e) => {
                    setDivision(e.target.value as Division);
                    setDistrict("");
                    if (fieldErrors.division)
                      setFieldErrors((p) => ({ ...p, division: undefined }));
                  }}
                  invalid={!!fieldErrors.division}
                >
                  <option value="">
                    {locale === "bn" ? "বিভাগ" : "Division"}
                  </option>
                  {BD_DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
                <Select
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    if (fieldErrors.district)
                      setFieldErrors((p) => ({ ...p, district: undefined }));
                  }}
                  disabled={!division}
                  invalid={!!fieldErrors.district}
                >
                  <option value="">
                    {locale === "bn" ? "জেলা" : "District"}
                  </option>
                  {division &&
                    BD_DISTRICTS[division].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </Select>
              </div>
            </Field>

            <Field
              label={locale === "bn" ? "বিস্তারিত ঠিকানা" : "Detailed address"}
              required
              error={fieldErrors.address}
            >
              <Textarea
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (fieldErrors.address)
                    setFieldErrors((p) => ({ ...p, address: undefined }));
                }}
                placeholder={
                  locale === "bn"
                    ? "বাড়ি, রোড, এলাকা, ল্যান্ডমার্ক"
                    : "House, road, area, landmark"
                }
                invalid={!!fieldErrors.address}
              />
            </Field>

            {/* Live rate card — appears as soon as a division is picked */}
            {division && (
              <RateCard
                division={division}
                district={district}
                fee={deliveryCharge}
                free={freeFromThreshold}
                matched={!!matchedZone}
                locale={locale === "bn" ? "bn" : "en"}
              />
            )}

            <div className="mt-4">
              <Field
                label={locale === "bn" ? "অর্ডার নোট" : "Order note"}
                optional
                optionalLabel={locale === "bn" ? "ঐচ্ছিক" : "Optional"}
              >
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    locale === "bn"
                      ? "যেমন: ডেলিভারির আগে কল করুন"
                      : "e.g. Call before delivery, leave at reception"
                  }
                  minHeight={64}
                />
              </Field>
            </div>
          </Section>

          {/* Section 3: Payment — only when advance required AND in payment phase */}
          {advanceRequired && phase === "payment" && (
            <PaymentSection
              deliveryCharge={deliveryCharge}
              cashAtDelivery={codAmount}
              methods={methods}
              methodsLoading={methodsLoading}
              selectedMethod={selectedMethod}
              onSelectMethod={setMethodId}
              txnRef={txnRef}
              onTxnRefChange={setTxnRef}
              receiptUrl={receiptUrl}
              receiptName={receiptName}
              uploading={uploading}
              uploadError={uploadError}
              onFile={handleReceiptFile}
              onRemoveReceipt={() => {
                setReceiptUrl("");
                setReceiptName("");
              }}
              confirmed={confirmed}
              onConfirm={setConfirmed}
              copied={copiedNumber}
              onCopyNumber={copyNumber}
              locale={locale === "bn" ? "bn" : "en"}
              instructions={delivery?.advance_payment_instructions}
            />
          )}
        </div>

        {/* ── RIGHT: Sticky summary ──────────────────────────── */}
        <aside className="lg:sticky lg:top-20">
          <div className="bg-white border border-stone-200 rounded-[14px] overflow-hidden">
            <div className="px-[22px] py-[18px] border-b border-stone-100">
              <h3 className="m-0 text-base font-bold tracking-[-0.01em]">
                {locale === "bn" ? "আপনার অর্ডার" : "Your order"}
              </h3>
              <div className="text-[12.5px] text-stone-500 mt-0.5">
                {cart.items.length}{" "}
                {locale === "bn" ? "টি আইটেম" : cart.items.length === 1 ? "item" : "items"}{" "}
                {locale === "bn" ? "—" : "from"} {shop.name}
              </div>
            </div>

            <ul className="m-0 p-0 list-none">
              {cart.items.map((it) => (
                <li
                  key={it.productId}
                  className="flex items-start gap-3 px-[22px] py-3.5 border-b border-stone-100 last:border-b-0"
                >
                  <div
                    className="relative w-14 h-14 rounded-[10px] grid place-items-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: thumbBg(it.name) }}
                  >
                    {productInitials(it.name)}
                    <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-stone-900 text-white text-[11px] font-bold">
                      {it.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900 truncate">
                      {it.name}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {advanceRequired
                        ? locale === "bn"
                          ? "ডেলিভারিতে নগদ"
                          : "Cash on delivery"
                        : locale === "bn"
                          ? "নগদ পেমেন্ট"
                          : "Cash on delivery"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-stone-900 whitespace-nowrap">
                    {formatBDT(parseFloat(it.price) * it.quantity, locale)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-[22px] py-3.5 border-t border-stone-100 grid gap-1.5 text-[13.5px]">
              <div className="flex justify-between text-stone-700">
                <span>{locale === "bn" ? "উপমোট" : "Subtotal"}</span>
                <strong className="text-stone-900 font-semibold">
                  {formatBDT(cart.subtotal, locale)}
                </strong>
              </div>
              <div className="flex justify-between text-stone-700">
                <span>
                  {locale === "bn" ? "ডেলিভারি" : "Delivery"}
                  {division && (
                    <span className="text-stone-500 text-xs ml-1.5">
                      · {division}
                    </span>
                  )}
                </span>
                <strong className="text-stone-900 font-semibold">
                  {deliveryCharge === 0
                    ? locale === "bn"
                      ? "ফ্রি"
                      : "Free"
                    : formatBDT(deliveryCharge, locale)}
                </strong>
              </div>
              {advanceRequired && (
                <div className="flex justify-between text-stone-500 text-[12.5px]">
                  <span>
                    {locale === "bn"
                      ? "ডেলিভারিতে দিতে হবে"
                      : "Cash to pay at delivery"}
                  </span>
                  <span>{formatBDT(codAmount, locale)}</span>
                </div>
              )}
            </div>

            <div className="px-[22px] py-3.5 border-t-2 border-stone-200 flex items-baseline justify-between">
              <div>
                <div className="text-[15px] font-bold text-stone-900">
                  {advanceRequired
                    ? locale === "bn"
                      ? "এখন পরিশোধ"
                      : "Pay now"
                    : locale === "bn"
                      ? "মোট"
                      : "Total"}
                </div>
                {advanceRequired && (
                  <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                    {locale === "bn" ? "শুধু ডেলিভারি ফি" : "delivery fee only"}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tracking-[-0.01em] text-stone-900">
                  {formatBDT(totalPayNow, locale)}
                </div>
                {advanceRequired && (
                  <div className="text-[11.5px] text-stone-500 font-medium mt-0.5">
                    {locale === "bn" ? "মোট অর্ডার " : "Total order "}
                    {formatBDT(total, locale)}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="px-[22px] pt-3 -mb-1 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* CTA area */}
            <div className="px-[22px] pt-[18px] pb-[22px]">
              {!advanceRequired ? (
                <PlaceOrderBtn
                  submitting={submitting}
                  disabled={disabled}
                  amount={total}
                  locale={locale === "bn" ? "bn" : "en"}
                />
              ) : phase === "form" ? (
                <>
                  <button
                    type="button"
                    onClick={startPayment}
                    disabled={
                      cart.items.length === 0 ||
                      reservationLoading ||
                      methodsLoading
                    }
                    className="w-full h-[52px] rounded-[12px] bg-teal-600 hover:bg-teal-700 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none text-white text-[15.5px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(20,184,166,0.5)] transition-colors"
                  >
                    <IcLock size={16} />
                    {reservationLoading
                      ? locale === "bn"
                        ? "হোল্ড করা হচ্ছে…"
                        : "Holding your cart…"
                      : `${locale === "bn" ? "ডেলিভারি ফি পেমেন্ট করুন · " : "Pay delivery fee · "}${formatBDT(deliveryCharge, locale)}`}
                  </button>
                  <p className="text-[12px] text-stone-500 mt-3 leading-snug text-center">
                    {locale === "bn"
                      ? "ক্লিকের পর ১৫ মিনিটের জন্য আপনার আইটেম হোল্ড থাকবে।"
                      : "We'll hold your items for 15 minutes once you tap pay."}
                  </p>
                </>
              ) : (
                <>
                  <PlaceOrderBtn
                    submitting={submitting}
                    disabled={disabled}
                    amount={deliveryCharge}
                    locale={locale === "bn" ? "bn" : "en"}
                  />
                  <button
                    type="button"
                    onClick={backToForm}
                    className="block w-full text-center mt-3 text-[12.5px] font-medium text-stone-600 hover:text-stone-900 underline-offset-4 hover:underline"
                  >
                    {locale === "bn"
                      ? "← কার্ট পরিবর্তন করুন (হোল্ড বাতিল হবে)"
                      : "← Edit cart (releases hold)"}
                  </button>
                </>
              )}
            </div>

            {/* Trust row */}
            <div className="grid grid-cols-3 gap-0 px-[22px] py-3.5 border-t border-stone-100 bg-stone-50">
              <TrustItem
                icon={<IcLock size={20} />}
                label={
                  locale === "bn" ? "সুরক্ষিত ও গোপনীয়" : "Secure & private"
                }
              />
              <TrustItem
                icon={<IcClock size={20} />}
                label={
                  locale === "bn" ? "১–২ দিনে ডেলিভারি" : "1–2 day delivery"
                }
              />
              <TrustItem
                icon={<IcUndo size={20} />}
                label={locale === "bn" ? "সহজ রিটার্ন" : "Easy returns"}
              />
            </div>
          </div>
        </aside>
      </form>
    </section>
  );
}

/* ── Steps ────────────────────────────────────────────────────── */

function Steps({
  currentStep,
  locale,
}: {
  currentStep: 1 | 2 | 3;
  locale: "en" | "bn";
}) {
  const steps: { n: 1 | 2 | 3; title: string }[] = [
    { n: 1, title: locale === "bn" ? "আপনার তথ্য" : "Your details" },
    { n: 2, title: locale === "bn" ? "ডেলিভারি" : "Delivery" },
    { n: 3, title: locale === "bn" ? "পেমেন্ট" : "Payment" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 p-1.5 mb-[22px] bg-white border border-stone-200 rounded-[14px]">
      {steps.map((s) => {
        const done = currentStep > s.n;
        const current = currentStep === s.n;
        return (
          <div
            key={s.n}
            className={`flex items-center gap-3 px-4 py-3 rounded-[10px] ${
              current ? "bg-teal-50" : ""
            }`}
          >
            <div
              className={`w-[30px] h-[30px] rounded-full grid place-items-center font-bold text-[13px] flex-shrink-0 ${
                done || current
                  ? "bg-teal-600 text-white"
                  : "bg-stone-100 text-stone-500"
              }`}
            >
              {done ? <IcCheck size={14} /> : s.n}
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] uppercase tracking-[0.04em] text-stone-500 font-semibold leading-none">
                {locale === "bn" ? `ধাপ ${s.n}` : `Step ${s.n}`}
              </div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  done || current ? "text-stone-900" : "text-stone-700"
                }`}
              >
                {s.title}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Hold timer ───────────────────────────────────────────────── */

function HoldTimer({
  secondsRemaining,
  locale,
}: {
  secondsRemaining: number;
  locale: "en" | "bn";
}) {
  const mm = String(Math.floor(secondsRemaining / 60)).padStart(2, "0");
  const ss = String(secondsRemaining % 60).padStart(2, "0");
  const pct = Math.max(
    0,
    Math.min(100, (secondsRemaining / HOLD_DURATION_SEC) * 100),
  );
  const urgent = secondsRemaining > 0 && secondsRemaining <= 60;
  return (
    <div
      className={`flex items-center gap-3.5 px-[18px] py-3 my-[22px] rounded-[12px] border ${
        urgent
          ? "bg-gradient-to-b from-amber-50 to-orange-50 border-amber-200"
          : "bg-gradient-to-b from-emerald-50 to-cyan-50 border-teal-200"
      }`}
    >
      <div
        className={`w-[38px] h-[38px] rounded-[10px] grid place-items-center bg-white flex-shrink-0 shadow-[0_0_0_4px_rgba(20,184,166,0.12)] ${
          urgent ? "text-amber-700" : "text-teal-700"
        }`}
      >
        <IcClock size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13.5px] font-semibold ${urgent ? "text-amber-900" : "text-teal-900"}`}
        >
          {locale === "bn" ? (
            <>
              আপনার কার্ট হোল্ড আছে আর{" "}
              <b className="font-mono text-[14px]">
                {mm}:{ss}
              </b>
            </>
          ) : (
            <>
              We're holding your cart for{" "}
              <b className="font-mono text-[14px]">
                {mm}:{ss}
              </b>
            </>
          )}
        </div>
        <div
          className={`text-[12.5px] mt-0.5 ${urgent ? "text-amber-700" : "text-teal-700"}`}
        >
          {locale === "bn"
            ? "সময় শেষ হওয়ার আগে চেকআউট সম্পন্ন করুন।"
            : "Finish checkout before the timer runs out — items go back on sale after that."}
        </div>
      </div>
      <div
        className={`hidden sm:block w-[110px] h-1.5 rounded-full overflow-hidden ${urgent ? "bg-amber-200/40" : "bg-teal-200/40"}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ${urgent ? "bg-amber-600" : "bg-teal-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Section card ─────────────────────────────────────────────── */

function Section({
  num,
  title,
  description,
  filled,
  filledLabel,
  amber,
  children,
}: {
  num: number;
  title: string;
  description: string;
  filled?: boolean;
  filledLabel?: string;
  amber?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-stone-200 rounded-[14px] mb-[18px] overflow-hidden">
      <div
        className={`flex items-start gap-3.5 px-6 py-5 border-b border-stone-100 ${
          amber ? "bg-gradient-to-b from-amber-50 to-white border-b-amber-200" : ""
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full grid place-items-center font-bold text-sm flex-shrink-0 mt-px ${
            amber
              ? "bg-amber-100 text-amber-700"
              : "bg-teal-50 text-teal-700"
          }`}
        >
          {num}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-bold tracking-[-0.01em] text-stone-900 leading-tight">
            {title}
          </div>
          <div className="text-[13px] text-stone-600 mt-0.5">{description}</div>
        </div>
        {filled && filledLabel && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11.5px] font-semibold flex-shrink-0">
            <IcCheck size={11} />
            {filledLabel}
          </span>
        )}
      </div>
      <div className="px-6 pt-[18px] pb-[22px]">{children}</div>
    </section>
  );
}

/* ── Form primitives ──────────────────────────────────────────── */

function Field({
  label,
  required,
  optional,
  optionalLabel,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  optionalLabel?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 last:mb-0">
      <label className="block text-[13.5px] font-semibold text-stone-900 mb-1.5 tracking-[-0.005em]">
        {label}
        {required && <span className="text-coral-500 ml-0.5">*</span>}
        {optional && optionalLabel && (
          <span className="ml-2 inline-flex items-center bg-stone-100 text-stone-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
            {optionalLabel}
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1.5" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function inputCls(invalid?: boolean) {
  return `w-full h-[46px] px-3.5 bg-white border-[1.5px] rounded-[10px] text-[14.5px] text-stone-900 placeholder-stone-400 hover:border-stone-300 focus:outline-none focus:border-teal-500 focus:ring-[3px] focus:ring-teal-100 transition-colors ${
    invalid ? "border-red-400" : "border-stone-200"
  }`;
}

function InputWithIcon({
  icon,
  invalid,
  ...rest
}: { icon: React.ReactNode; invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">
        {icon}
      </span>
      <input
        {...rest}
        className={`${inputCls(invalid)} pl-[42px]`}
        aria-invalid={invalid}
      />
    </div>
  );
}

function InputWithLead({
  lead,
  invalid,
  ...rest
}: { lead: string; invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-[13px] pointer-events-none">
        {lead}
      </span>
      <input
        {...rest}
        className={`${inputCls(invalid)} pl-[58px]`}
        aria-invalid={invalid}
      />
    </div>
  );
}

function Select({
  invalid,
  ...rest
}: { invalid?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        aria-invalid={invalid}
        className={`${inputCls(invalid)} pr-10 appearance-none bg-no-repeat disabled:bg-stone-50 disabled:text-stone-400 cursor-pointer`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2378716C' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 14px center",
        }}
      />
    </div>
  );
}

function Textarea({
  invalid,
  minHeight = 84,
  ...rest
}: { invalid?: boolean; minHeight?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid}
      className={`${inputCls(invalid)} h-auto px-3.5 py-3 leading-[1.5] resize-y`}
      style={{ minHeight }}
    />
  );
}

/* ── Live rate card ───────────────────────────────────────────── */

function RateCard({
  division,
  district,
  fee,
  free,
  matched,
  locale,
}: {
  division: string;
  district: string;
  fee: number;
  free: boolean;
  matched: boolean;
  locale: "en" | "bn";
}) {
  return (
    <div className="mt-3.5 grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 bg-teal-50 border border-teal-200 rounded-[10px]">
      <div className="w-[38px] h-[38px] rounded-[9px] bg-white text-teal-700 grid place-items-center">
        <IcTruck size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-teal-900 truncate">
          {locale === "bn" ? "ডেলিভারি " : "Delivery to "}
          {[district, division].filter(Boolean).join(", ")}
        </div>
        <div className="text-xs text-teal-700 mt-0.5">
          {free
            ? locale === "bn"
              ? "ফ্রি ডেলিভারি — অর্ডার সীমা পূরণ"
              : "Free delivery — order qualifies"
            : matched
              ? locale === "bn"
                ? "বিভাগ-নির্দিষ্ট চার্জ"
                : "Zone rate applied"
              : locale === "bn"
                ? "ডিফল্ট রেট"
                : "Standard rate"}
        </div>
      </div>
      <div className="text-lg font-bold text-teal-900 tracking-[-0.01em] whitespace-nowrap">
        {fee === 0
          ? locale === "bn"
            ? "ফ্রি"
            : "Free"
          : formatBDT(fee, locale)}
      </div>
    </div>
  );
}

/* ── Payment section (advance fee proof) ──────────────────────── */

function PaymentSection({
  deliveryCharge,
  cashAtDelivery,
  methods,
  methodsLoading,
  selectedMethod,
  onSelectMethod,
  txnRef,
  onTxnRefChange,
  receiptUrl,
  receiptName,
  uploading,
  uploadError,
  onFile,
  onRemoveReceipt,
  confirmed,
  onConfirm,
  copied,
  onCopyNumber,
  locale,
  instructions,
}: {
  deliveryCharge: number;
  cashAtDelivery: number;
  methods: PaymentMethod[];
  methodsLoading: boolean;
  selectedMethod: PaymentMethod | undefined;
  onSelectMethod: (id: string) => void;
  txnRef: string;
  onTxnRefChange: (v: string) => void;
  receiptUrl: string;
  receiptName: string;
  uploading: boolean;
  uploadError: string | null;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveReceipt: () => void;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  copied: boolean;
  onCopyNumber: (v: string) => void;
  locale: "en" | "bn";
  instructions?: string;
}) {
  // The "send to" number depends on the chosen method.
  const payToNumber =
    selectedMethod?.method_type === "mobile_banking"
      ? selectedMethod.mb_phone ?? ""
      : selectedMethod?.method_type === "bank"
        ? selectedMethod.account_number ?? ""
        : "";
  const payToLabel =
    selectedMethod?.method_type === "mobile_banking"
      ? `${locale === "bn" ? "এর মাধ্যমে " : "via "}${providerLabel(selectedMethod.mb_provider)}`
      : selectedMethod?.method_type === "bank"
        ? `${locale === "bn" ? "ব্যাংক " : "to "}${selectedMethod.bank_name}`
        : "";
  const numberLabel =
    selectedMethod?.method_type === "bank"
      ? locale === "bn"
        ? "অ্যাকাউন্ট"
        : "account"
      : locale === "bn"
        ? "নম্বর"
        : "number";

  return (
    <Section
      num={3}
      amber
      title={
        locale === "bn"
          ? `অগ্রিম ডেলিভারি ফি · ${formatBDT(deliveryCharge, locale)}`
          : `Advance delivery fee · ${formatBDT(deliveryCharge, locale)}`
      }
      description={
        locale === "bn"
          ? `এখন ছোট ডেলিভারি ফি পরিশোধ করুন। বাকি ${formatBDT(cashAtDelivery, locale)} অর্ডার পৌঁছালে নগদ দিবেন।`
          : `Pay the small delivery fee now. You'll pay the rest (${formatBDT(cashAtDelivery, locale)}) cash when the order arrives.`
      }
    >
      {/* Big pay-to amount + number */}
      {selectedMethod && payToNumber && (
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 mb-[18px] bg-white border-[1.5px] border-amber-300 rounded-[12px]">
          <div>
            <div className="text-xs text-stone-600 uppercase tracking-[0.04em] font-semibold">
              {locale === "bn"
                ? "এই পরিমাণ বিক্রেতাকে পাঠান"
                : "Send this amount to the seller"}
            </div>
            <div className="text-[26px] font-bold text-stone-900 tracking-[-0.01em] mt-0.5 font-mono">
              {formatBDT(deliveryCharge, locale)}
              {payToLabel && (
                <span className="text-sm text-stone-500 font-medium ml-2 font-sans">
                  {payToLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="text-xs text-stone-500">
                {locale === "bn" ? `${numberLabel}: ` : `to ${numberLabel}`}
              </span>
              <span className="font-mono text-[13.5px] font-bold text-stone-900 bg-stone-100 px-2.5 py-[3px] rounded-md">
                {payToNumber}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCopyNumber(payToNumber)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-semibold"
          >
            {copied ? <IcCheck size={14} /> : <IcCopy size={14} />}
            {copied
              ? locale === "bn"
                ? "কপি হয়েছে"
                : "Copied"
              : locale === "bn"
                ? "কপি করুন"
                : "Copy number"}
          </button>
        </div>
      )}

      {/* Method tabs */}
      <div className="text-[13px] font-semibold text-stone-900 mb-2.5">
        {locale === "bn"
          ? "কোন মাধ্যমে পাঠাচ্ছেন?"
          : "Which method did you use?"}
      </div>
      {methodsLoading ? (
        <div className="text-sm text-stone-500 mb-[18px]">
          {locale === "bn" ? "লোড হচ্ছে…" : "Loading methods…"}
        </div>
      ) : methods.length === 0 ? (
        <div className="px-3.5 py-3 mb-[18px] bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {locale === "bn"
            ? "এই দোকানে কোনো পেমেন্ট মাধ্যম এখনো যোগ করা হয়নি।"
            : "This shop hasn't published any payment methods yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-[18px]">
          {methods.map((m) => (
            <MethodTab
              key={m.id}
              method={m}
              selected={selectedMethod?.id === m.id}
              onClick={() => onSelectMethod(m.id)}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* How-to hint */}
      {selectedMethod && payToNumber && (
        <div className="flex gap-3 px-4 py-3 mb-[18px] bg-stone-50 border border-stone-200 rounded-[10px] text-[12.5px] text-stone-700 leading-[1.55]">
          <span className="text-teal-600 flex-shrink-0 mt-0.5">
            <IcInfo size={16} />
          </span>
          <div>
            {selectedMethod.method_type === "mobile_banking" ? (
              locale === "bn" ? (
                <>
                  {providerLabel(selectedMethod.mb_provider)} খুলুন →{" "}
                  <b className="text-stone-900">Send Money</b> → নম্বর{" "}
                  <b className="text-stone-900 font-mono">{payToNumber}</b> এবং{" "}
                  <b className="text-stone-900">
                    {formatBDT(deliveryCharge, locale)}
                  </b>{" "}
                  দিয়ে কনফার্ম করুন → এরপর নিচের ট্রানজেকশন আইডি লিখুন।
                </>
              ) : (
                <>
                  Open {providerLabel(selectedMethod.mb_provider)} →{" "}
                  <b className="text-stone-900">Send Money</b> → enter{" "}
                  <b className="font-mono text-stone-900">{payToNumber}</b> and{" "}
                  <b className="text-stone-900">
                    {formatBDT(deliveryCharge, locale)}
                  </b>{" "}
                  → confirm. Then come back and enter your transaction ID below.
                </>
              )
            ) : locale === "bn" ? (
              <>
                {selectedMethod.bank_name} -এ{" "}
                <b className="text-stone-900">
                  {formatBDT(deliveryCharge, locale)}
                </b>{" "}
                পাঠান অ্যাকাউন্ট{" "}
                <b className="font-mono text-stone-900">{payToNumber}</b>-এ। তারপর
                ট্রানজেকশন আইডি নিচে দিন।
              </>
            ) : (
              <>
                Transfer{" "}
                <b className="text-stone-900">
                  {formatBDT(deliveryCharge, locale)}
                </b>{" "}
                to {selectedMethod.bank_name} account{" "}
                <b className="font-mono text-stone-900">{payToNumber}</b>. Then
                enter your transaction ID below.
              </>
            )}
          </div>
        </div>
      )}

      {/* Custom seller instructions */}
      {instructions && (
        <div className="px-4 py-3 mb-[18px] bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900 whitespace-pre-line">
          {instructions}
        </div>
      )}

      {/* Txn ID */}
      <Field
        label={locale === "bn" ? "ট্রানজেকশন আইডি" : "Transaction ID"}
        required
      >
        <InputWithIcon
          icon={<IcZap size={15} />}
          value={txnRef}
          onChange={(e) => onTxnRefChange(e.target.value)}
          placeholder={
            locale === "bn"
              ? "যেমন TX1A2B3C — অ্যাপের Transactions থেকে"
              : "e.g. TX1A2B3C — found in your bKash app under Transactions"
          }
          style={{ fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "0.03em" }}
        />
      </Field>

      {/* Receipt upload */}
      <Field
        label={locale === "bn" ? "পেমেন্ট রসিদ" : "Payment receipt screenshot"}
        optional
        optionalLabel={locale === "bn" ? "সুপারিশকৃত" : "Recommended"}
      >
        {receiptUrl ? (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-[1.5px] border-teal-200 rounded-[12px]">
            <div className="w-11 h-11 rounded-md bg-gradient-to-br from-blue-100 to-indigo-500 text-white grid place-items-center flex-shrink-0">
              <IcImage size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-stone-900 truncate">
                {receiptName ||
                  `receipt${receiptUrl.match(/\.[a-z0-9]+$/i)?.[0] ?? ""}`}
              </div>
              <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                <span className="text-green-700 inline-flex items-center gap-1 font-medium">
                  <IcCheck size={11} />
                  {locale === "bn" ? "আপলোড সম্পন্ন" : "Uploaded"}
                </span>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-stone-500 hover:text-teal-700"
                >
                  · {locale === "bn" ? "দেখুন" : "View"}
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={onRemoveReceipt}
              className="w-[30px] h-[30px] grid place-items-center rounded-md bg-stone-100 hover:bg-coral-50 text-stone-600 hover:text-coral-600 transition-colors"
              title={locale === "bn" ? "সরান" : "Remove"}
            >
              <IcX size={14} />
            </button>
          </div>
        ) : (
          <label
            className={`block rounded-[12px] border-[1.5px] border-dashed bg-stone-50 px-4 py-5 text-center cursor-pointer transition-colors hover:border-teal-500 hover:bg-teal-50 ${
              uploading
                ? "opacity-70 cursor-wait"
                : "border-stone-300"
            }`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onFile}
              disabled={uploading}
            />
            <span className="inline-grid place-items-center w-[42px] h-[42px] rounded-full bg-white text-teal-700 shadow-[0_0_0_4px_rgba(20,184,166,0.08)] mb-2">
              <IcUpload size={18} />
            </span>
            <div className="text-sm font-semibold text-stone-900">
              {uploading
                ? locale === "bn"
                  ? "আপলোড হচ্ছে…"
                  : "Uploading…"
                : locale === "bn"
                  ? "ফাইল বেছে নিন বা টেনে আনুন"
                  : "Tap to choose or drop a file"}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {locale === "bn"
                ? "JPG / PNG / WebP / PDF — সর্বোচ্চ ৫ MB"
                : "JPG / PNG / WebP / PDF — 5 MB max"}
            </div>
          </label>
        )}
        {uploadError && (
          <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>
        )}
      </Field>

      {/* Confirmation */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 mt-4 bg-stone-50 rounded-[10px]">
        <input
          id="confirm-pay"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="w-[18px] h-[18px] accent-teal-600 cursor-pointer"
        />
        <label
          htmlFor="confirm-pay"
          className="text-[13px] text-stone-700 leading-[1.4] cursor-pointer flex-1"
        >
          {locale === "bn"
            ? `আমি নিশ্চিত করছি যে ${formatBDT(deliveryCharge, locale)} ডেলিভারি ফি পাঠিয়েছি এবং উপরের তথ্য সঠিক।`
            : `I confirm I've sent the ${formatBDT(deliveryCharge, locale)} delivery fee and the details above are correct.`}
        </label>
      </div>
    </Section>
  );
}

function MethodTab({
  method,
  selected,
  onClick,
  locale,
}: {
  method: PaymentMethod;
  selected: boolean;
  onClick: () => void;
  locale: "en" | "bn";
}) {
  const initials =
    method.method_type === "mobile_banking"
      ? providerLabel(method.mb_provider).slice(0, 2)
      : "BK";
  const logoCls =
    method.method_type === "bank"
      ? "bg-gradient-to-br from-blue-400 to-indigo-700"
      : method.mb_provider === "nagad"
        ? "bg-gradient-to-br from-orange-400 to-red-600"
        : method.mb_provider === "rocket"
          ? "bg-gradient-to-br from-violet-400 to-violet-700"
          : "bg-gradient-to-br from-pink-400 to-rose-600";
  const subtitle =
    method.method_type === "mobile_banking"
      ? `${numberTypeLabel(method.mb_number_type)} · ${locale === "bn" ? "সেন্ড মানি" : "Send Money"}`
      : method.bank_name ?? "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-3.5 rounded-[12px] border-[1.5px] text-center transition-colors ${
        selected
          ? "border-teal-500 bg-teal-50"
          : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      <div
        className={`w-10 h-10 mx-auto mb-2 rounded-[9px] grid place-items-center text-white font-bold text-[12px] ${logoCls}`}
      >
        {initials}
      </div>
      <div className="text-[13.5px] font-semibold text-stone-900">
        {method.method_type === "mobile_banking"
          ? providerLabel(method.mb_provider)
          : method.bank_name}
      </div>
      <div className="text-[11px] text-stone-500 mt-0.5 truncate">
        {subtitle}
      </div>
      {selected && (
        <span className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full bg-teal-600 grid place-items-center">
          <IcCheck size={11} />
        </span>
      )}
    </button>
  );
}

/* ── Place-order button + trust row ──────────────────────────── */

function PlaceOrderBtn({
  submitting,
  disabled,
  amount,
  locale,
}: {
  submitting: boolean;
  disabled: boolean;
  amount: number;
  locale: "en" | "bn";
}) {
  return (
    <button
      type="submit"
      disabled={disabled || submitting}
      className="w-full h-[52px] rounded-[12px] bg-teal-600 hover:bg-teal-700 disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none text-white text-[15.5px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(20,184,166,0.5)] transition-colors"
    >
      <IcLock size={16} />
      {submitting
        ? locale === "bn"
          ? "অর্ডার হচ্ছে…"
          : "Placing order…"
        : `${locale === "bn" ? "অর্ডার কনফার্ম করুন · " : "Place order · "}${formatBDT(amount, locale)}`}
    </button>
  );
}

function TrustItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center text-[11px] font-semibold text-stone-700">
      <span className="text-teal-600">{icon}</span>
      {label}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function translateReservationError(
  error: { code: string; msg: string },
  locale: "en" | "bn",
): string {
  switch (error.code) {
    case "insufficient_stock":
      return locale === "bn"
        ? "এই পরিমাণ স্টকে নেই — কম পরিমাণে চেষ্টা করুন।"
        : "Not enough stock — try a smaller quantity.";
    case "reservation_expired":
      return locale === "bn"
        ? "আপনার হোল্ড শেষ হয়েছে।"
        : "Your hold has expired.";
    case "reservation_consumed":
      return locale === "bn"
        ? "এই হোল্ডে ইতিমধ্যে অর্ডার দেওয়া হয়েছে।"
        : "This hold has already been used.";
    case "no_methods":
      return error.msg;
    default:
      return error.msg;
  }
}

function productInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function thumbBg(name: string): string {
  const palette = [
    "linear-gradient(135deg, #DBEAFE, #6366F1)",
    "linear-gradient(135deg, #FEE4E2, #DC2626)",
    "linear-gradient(135deg, #DCFCE7, #16A34A)",
    "linear-gradient(135deg, #FEF3C7, #D97706)",
    "linear-gradient(135deg, #EDE9FE, #6D28D9)",
    "linear-gradient(135deg, #CCFBF1, #0F766E)",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/* ── Inline icons (Lucide-style, currentColor) ──────────────── */

function Icon({
  size = 16,
  children,
  strokeWidth = 1.8,
}: {
  size?: number;
  children: React.ReactNode;
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
    >
      {children}
    </svg>
  );
}

const IcChevLeft = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2}>
    <polyline points="15 18 9 12 15 6" />
  </Icon>
);
const IcCheck = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2.6}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const IcCopy = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);
const IcX = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);
const IcLock = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);
const IcClock = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);
const IcUndo = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);
const IcUser = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
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
const IcInfo = (p: { size?: number }) => (
  <Icon {...p} strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Icon>
);
const IcZap = (p: { size?: number }) => (
  <Icon {...p}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </Icon>
);
const IcImage = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </Icon>
);
const IcUpload = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Icon>
);
