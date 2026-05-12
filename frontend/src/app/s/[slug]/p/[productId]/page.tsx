"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useStorefront } from "../../StorefrontShell";
import { ProductImage, hueFromString } from "@/components/ui/ProductImage";
import { getProduct, getProducts, type PublicProduct } from "@/lib/storefrontApi";
import { getProductReviews, type Review } from "@/lib/reviewApi";
import { applyDiscount, formatBDT, formatDateTime } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";

type Tab = "description" | "reviews" | "delivery";

export default function ProductDetailPage() {
  const { shop, delivery, cart, openCart } = useStorefront();
  const { locale } = useI18n();
  const params = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>("description");

  const { data: product, isLoading } = useQuery({
    queryKey: ["sf-product", params.slug, params.productId],
    queryFn: () => getProduct(params.slug, params.productId),
  });

  // Reviews — needed for the rating row at the top AND the reviews tab.
  const reviewsQuery = useQuery({
    queryKey: ["sf-product-reviews", params.productId],
    queryFn: () => getProductReviews(params.productId),
  });

  // Related products from the same shop (excluding the current one).
  const relatedQuery = useQuery({
    queryKey: ["sf-related", params.slug],
    queryFn: () => getProducts(params.slug, { page_size: 8 }),
  });

  // Hooks must run unconditionally — compute review-derived state BEFORE
  // any early returns so the hook count stays stable across renders.
  // The actual product-dependent rendering happens further down.
  const reviews = reviewsQuery.data?.data.reviews ?? [];
  const rating = reviewsQuery.data?.data.rating;
  const reviewCount = rating?.count ?? 0;
  const ratingAvg = rating?.average ?? 0;

  // Build the per-star breakdown for the bar chart from the visible page of
  // reviews. The API doesn't ship aggregated buckets so this is a best-effort
  // sample — accurate enough for a small-shop catalogue where the visible
  // page IS the catalogue.
  const breakdown = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]; // index 0 = 1 star, 4 = 5 stars
    for (const r of reviews) {
      const i = Math.min(4, Math.max(0, Math.round(r.rating) - 1));
      buckets[i]++;
    }
    return buckets;
  }, [reviews]);

  if (isLoading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-8 text-stone-500">
        Loading…
      </div>
    );
  }
  if (!product) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-10 text-center">
        <div className="text-lg font-semibold mb-1">Product not found</div>
        <Link
          href={`/s/${shop.slug}`}
          className="text-teal-600 text-sm"
        >
          ← Back to shop
        </Link>
      </div>
    );
  }

  const productHue = hueFromString(product.id);
  const { effective, original } = applyDiscount(
    product.price_bdt,
    product.discount_type,
    product.discount_value,
  );
  const savingsPct =
    original && Number(original) > 0
      ? Math.round(((Number(original) - Number(effective)) / Number(original)) * 100)
      : 0;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock < 5;
  const isBestseller = reviewCount >= 5;

  const related = (relatedQuery.data?.data ?? [])
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  const addToCart = () => {
    cart.addItem(
      {
        productId: product.id,
        name: product.name,
        price: String(effective),
        image: product.images?.[0]?.url ?? null,
        stock: product.stock,
      },
      qty,
    );
    openCart();
  };
  const buyNow = () => {
    addToCart();
    router.push(`/s/${shop.slug}/checkout`);
  };

  const images = product.images ?? [];
  const hasGallery = images.length > 0;
  const currentImage = hasGallery ? images[imgIdx] : null;
  const nextImage = () =>
    setImgIdx((i) => (images.length ? (i + 1) % images.length : 0));
  const prevImage = () =>
    setImgIdx((i) =>
      images.length ? (i - 1 + images.length) % images.length : 0,
    );

  const shopInitial = shop.name.charAt(0).toUpperCase() || "S";
  const shopAvatarHue = hueFromString(shop.id);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-16">
      {/* Back link */}
      <Link
        href={`/s/${shop.slug}`}
        className="inline-flex items-center gap-1.5 text-stone-600 hover:text-stone-900 text-[13px] font-medium mb-4"
      >
        <IcChevLeft size={14} />
        {locale === "bn" ? "দোকানে ফিরুন" : "Back to shop"}
      </Link>

      <div className="grid gap-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
        {/* ── Gallery (sticky on desktop) ────────────────────── */}
        <div className="lg:sticky lg:top-20 grid grid-cols-[64px_1fr] gap-3.5 max-lg:grid-cols-1">
          {/* Thumbnails: vertical on desktop, horizontal scroll on mobile */}
          {images.length > 1 && (
            <div className="flex flex-col gap-2 max-lg:flex-row max-lg:order-2 max-lg:overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  className={`w-16 h-16 rounded-[10px] p-0.5 bg-white flex-shrink-0 transition-colors ${
                    imgIdx === i
                      ? "border-2 border-teal-600"
                      : "border border-stone-200 hover:border-stone-300"
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <div className="w-full h-full rounded-[8px] overflow-hidden">
                    <ProductImage src={img.url} alt="" ratio="1/1" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Main image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 max-lg:order-1 col-start-2 max-lg:col-start-auto">
            {currentImage ? (
              <ProductImage
                src={currentImage.url}
                alt={product.name}
                ratio="1/1"
                className="w-full h-full"
              />
            ) : (
              <ProductImage hue={productHue} ratio="1/1" className="w-full h-full" />
            )}

            {/* Top-left badges */}
            <div className="absolute top-3.5 left-3.5 flex flex-col gap-1.5 z-10">
              {isBestseller && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                  <IcStar size={11} filled />
                  {locale === "bn" ? "জনপ্রিয়" : "Bestseller"}
                </span>
              )}
              {savingsPct > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-coral-500 text-white text-[11px] font-bold">
                  {locale === "bn" ? `${savingsPct}% ছাড়` : `${savingsPct}% OFF`}
                </span>
              )}
            </div>

            {/* Counter + Zoom */}
            {images.length > 1 && (
              <span className="absolute bottom-3.5 left-3.5 px-2.5 py-1 rounded-full bg-stone-900/70 text-white text-[11.5px] font-medium backdrop-blur-sm">
                {imgIdx + 1} / {images.length}
              </span>
            )}
            {hasGallery && (
              <a
                href={currentImage?.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-stone-900/70 text-white text-xs font-medium backdrop-blur-sm hover:bg-stone-900/85 transition-colors"
              >
                <IcZoom size={13} />
                {locale === "bn" ? "জুম" : "Zoom"}
              </a>
            )}

            {/* Nav arrows */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute top-1/2 -translate-y-1/2 left-3.5 w-10 h-10 rounded-full bg-white/92 hover:bg-white text-stone-900 grid place-items-center shadow-md"
                  aria-label="Previous image"
                >
                  <IcChevLeft size={18} thick />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute top-1/2 -translate-y-1/2 right-3.5 w-10 h-10 rounded-full bg-white/92 hover:bg-white text-stone-900 grid place-items-center shadow-md"
                  aria-label="Next image"
                >
                  <IcChevRight size={18} thick />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Info column ────────────────────────────────────── */}
        <div className="pt-0.5">
          {/* Shop chip */}
          <Link
            href={`/s/${shop.slug}`}
            className="inline-flex items-center gap-2.5 px-3 py-2 rounded-[10px] bg-white border border-stone-200 hover:border-stone-300 mb-3.5 w-fit transition-colors"
          >
            <span
              className="w-7 h-7 rounded-md grid place-items-center text-white text-xs font-bold flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${shopAvatarHue}, 70%, 60%), hsl(${shopAvatarHue}, 60%, 40%))`,
              }}
            >
              {shopInitial}
            </span>
            <div>
              <div className="text-[13px] font-semibold text-stone-900 inline-flex items-center gap-1.5">
                {shop.name}
                {shop.rating_average >= 4 && shop.rating_count >= 3 && (
                  <IcCheck size={12} className="text-teal-600" />
                )}
              </div>
              <div className="text-[11.5px] text-stone-500">
                {shop.rating_count > 0
                  ? `★ ${shop.rating_average.toFixed(1)} · ${shop.rating_count} ${locale === "bn" ? "রিভিউ" : "reviews"}`
                  : locale === "bn"
                    ? "নতুন দোকান"
                    : "New shop"}
              </div>
            </div>
            <IcChevRight
              size={14}
              className="text-stone-400 ml-1"
            />
          </Link>

          <h1 className="m-0 text-[26px] sm:text-[30px] font-extrabold tracking-[-0.02em] leading-[1.2] mb-2">
            {product.name}
          </h1>

          {/* Rating row */}
          <div className="flex items-center gap-2.5 flex-wrap text-[13px] text-stone-600 mb-5">
            <StarRow value={ratingAvg} />
            <span className="font-semibold text-stone-900">
              {reviewCount > 0 ? ratingAvg.toFixed(1) : "—"}
            </span>
            <button
              type="button"
              onClick={() => setTab("reviews")}
              className="text-teal-700 font-semibold hover:underline underline-offset-2"
            >
              ({reviewCount}{" "}
              {locale === "bn"
                ? "রিভিউ"
                : reviewCount === 1
                  ? "review"
                  : "reviews"})
            </button>
            {product.stock > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-stone-300" />
                <span className="inline-flex items-center gap-1 text-stone-700">
                  <strong className="text-stone-900 font-bold">
                    {lowStock
                      ? product.stock
                      : product.stock >= 50
                        ? "50+"
                        : product.stock}
                  </strong>{" "}
                  {locale === "bn" ? "স্টকে" : "in stock"}
                </span>
              </>
            )}
          </div>

          {/* Price block */}
          <div className="bg-white border border-stone-200 rounded-[14px] px-5 py-[18px] mb-4">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="text-[34px] sm:text-[36px] font-extrabold tracking-[-0.02em] text-stone-900 leading-none">
                {formatBDT(effective, locale)}
              </span>
              {original && (
                <span className="text-base text-stone-400 line-through font-medium">
                  {formatBDT(original, locale)}
                </span>
              )}
              {savingsPct > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-coral-50 text-coral-600 text-xs font-bold">
                  {locale === "bn" ? `${savingsPct}% সাশ্রয়` : `SAVE ${savingsPct}%`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[12.5px] text-stone-600">
              <span className="text-green-700">●</span>
              <span>
                {locale === "bn"
                  ? "সব কর সহ · কোনো লুকানো খরচ নেই"
                  : "Inclusive of all taxes · No hidden fees"}
              </span>
            </div>
          </div>

          {/* Actions row */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 mb-3.5">
            <div className="flex items-center h-[52px] rounded-[12px] border-[1.5px] border-stone-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-11 h-full grid place-items-center text-stone-700 text-lg hover:bg-stone-50 disabled:text-stone-300"
                aria-label="Decrease quantity"
                disabled={qty <= 1}
              >
                −
              </button>
              <div className="w-11 text-center text-[15px] font-bold text-stone-900">
                {qty}
              </div>
              <button
                type="button"
                onClick={() =>
                  setQty((q) => Math.min(product.stock || q + 1, q + 1))
                }
                className="w-11 h-full grid place-items-center text-stone-700 text-lg hover:bg-stone-50 disabled:text-stone-300"
                aria-label="Increase quantity"
                disabled={qty >= product.stock}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={addToCart}
              disabled={outOfStock}
              className="h-[52px] rounded-[12px] bg-coral-500 hover:bg-coral-600 disabled:bg-stone-200 disabled:text-stone-500 text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <IcCart size={17} />
              {outOfStock
                ? locale === "bn"
                  ? "স্টক নেই"
                  : "Out of stock"
                : `${locale === "bn" ? "কার্টে যোগ করুন · " : "Add to cart · "}${formatBDT(Number(effective) * qty, locale)}`}
            </button>
          </div>

          <button
            type="button"
            onClick={buyNow}
            disabled={outOfStock}
            className="w-full h-[52px] rounded-[12px] bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:text-stone-500 text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 mb-4 transition-colors"
          >
            <IcBolt size={16} className="text-amber-300" />
            {locale === "bn"
              ? "এখনই কিনুন — ক্যাশ অন ডেলিভারি"
              : "Buy now — Cash on delivery"}
          </button>

          {/* Trust strip 2×2 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <TrustTile
              icon={<IcShield size={16} />}
              iconClass="bg-teal-50 text-teal-700"
              title={locale === "bn" ? "যাচাইকৃত বিক্রেতা" : "Verified seller"}
              subtitle={
                locale === "bn"
                  ? "১০০% খাঁটি পণ্য"
                  : "100% authentic items"
              }
            />
            <TrustTile
              icon={<IcReturn size={16} />}
              iconClass="bg-coral-50 text-coral-600"
              title={locale === "bn" ? "৭ দিনে রিটার্ন" : "7-day returns"}
              subtitle={
                locale === "bn" ? "ভুল পণ্যের জন্য" : "Damage or wrong item"
              }
            />
            <TrustTile
              icon={<IcWallet size={16} />}
              iconClass="bg-amber-100 text-amber-700"
              title={locale === "bn" ? "ক্যাশ অন ডেলিভারি" : "Cash on delivery"}
              subtitle={
                locale === "bn"
                  ? "পণ্য পেয়ে পেমেন্ট"
                  : "Pay when received"
              }
            />
            <TrustTile
              icon={<IcClock size={16} />}
              iconClass="bg-blue-100 text-blue-800"
              title={locale === "bn" ? "দ্রুত শিপিং" : "Order before 2 PM"}
              subtitle={
                locale === "bn" ? "একই দিনে শিপ" : "Ships same day"
              }
            />
          </div>

          {/* Delivery card */}
          <div className="bg-white border border-stone-200 rounded-[14px] mb-3.5 overflow-hidden">
            <InfoRow
              icon={<IcTruck size={18} />}
              iconClass="bg-teal-50 text-teal-700"
              label={
                locale === "bn" ? "ডেলিভারি গন্তব্য" : "Deliver to"
              }
              value={
                <>
                  {locale === "bn" ? "বাংলাদেশজুড়ে" : "Bangladesh-wide"}
                  {delivery?.delivery_charge && (
                    <>
                      {" · "}
                      {locale === "bn" ? "ডেলিভারি " : "from "}
                      {formatBDT(delivery.delivery_charge, locale)}
                    </>
                  )}
                </>
              }
              cta={
                <Link
                  href={`/s/${shop.slug}/checkout`}
                  className="text-[12.5px] font-semibold text-teal-700 hover:text-teal-800"
                >
                  {locale === "bn" ? "চেকআউট →" : "Checkout →"}
                </Link>
              }
            />
            <InfoRow
              icon={<IcCheck2 size={18} />}
              iconClass={
                outOfStock
                  ? "bg-stone-100 text-stone-500"
                  : "bg-green-100 text-green-700"
              }
              label={
                locale === "bn" ? "মজুদ" : "Availability"
              }
              value={
                outOfStock ? (
                  <span className="text-stone-500 font-semibold">
                    {locale === "bn" ? "স্টক নেই" : "Out of stock"}
                  </span>
                ) : (
                  <>
                    <strong className="text-green-700 font-semibold">
                      {locale === "bn" ? "স্টকে আছে" : "In stock"}
                    </strong>{" "}
                    ·{" "}
                    {locale === "bn"
                      ? `${product.stock} টি বাকি`
                      : `${product.stock} units available`}
                  </>
                )
              }
            />
            {delivery?.advance_payment_required && (
              <InfoRow
                icon={<IcInfo size={18} />}
                iconClass="bg-amber-50 text-amber-700"
                label={
                  locale === "bn"
                    ? "অগ্রিম ডেলিভারি ফি"
                    : "Advance delivery fee"
                }
                value={
                  <>
                    {locale === "bn"
                      ? "অর্ডার করার আগে ডেলিভারি ফি পাঠাতে হবে।"
                      : "Send the delivery fee before placing the order."}
                    {delivery.advance_payment_instructions && (
                      <span className="block text-stone-500 mt-0.5 text-[12px]">
                        {delivery.advance_payment_instructions.slice(0, 80)}
                        {delivery.advance_payment_instructions.length > 80
                          ? "…"
                          : ""}
                      </span>
                    )}
                  </>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs + content ────────────────────────────────────── */}
      <div className="mt-12 border-b border-stone-200 flex gap-1 overflow-x-auto">
        <TabBtn
          on={tab === "description"}
          onClick={() => setTab("description")}
        >
          {locale === "bn" ? "বিবরণ" : "Description"}
        </TabBtn>
        <TabBtn on={tab === "reviews"} onClick={() => setTab("reviews")}>
          {locale === "bn" ? "রিভিউ" : "Reviews"}
          {reviewCount > 0 && (
            <span
              className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                tab === "reviews"
                  ? "bg-teal-50 text-teal-700"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {reviewCount}
            </span>
          )}
        </TabBtn>
        <TabBtn on={tab === "delivery"} onClick={() => setTab("delivery")}>
          {locale === "bn" ? "ডেলিভারি ও রিটার্ন" : "Delivery & returns"}
        </TabBtn>
      </div>

      <div className="py-7 grid gap-9 lg:grid-cols-[2fr_1fr] items-start">
        <div>
          {tab === "description" && (
            <DescriptionPanel
              text={product.description}
              locale={locale === "bn" ? "bn" : "en"}
            />
          )}
          {tab === "reviews" && (
            <ReviewsPanel
              reviews={reviews}
              loading={reviewsQuery.isLoading}
              locale={locale === "bn" ? "bn" : "en"}
            />
          )}
          {tab === "delivery" && (
            <DeliveryPanel
              delivery={delivery}
              locale={locale === "bn" ? "bn" : "en"}
            />
          )}
        </div>

        {/* Right rail: reviews overview (when on reviews tab) or shop card otherwise */}
        <aside className="lg:sticky lg:top-20">
          {tab === "reviews" ? (
            <RatingOverview
              average={ratingAvg}
              count={reviewCount}
              breakdown={breakdown}
              locale={locale === "bn" ? "bn" : "en"}
            />
          ) : (
            <ShopCard
              shopName={shop.name}
              shopSlug={shop.slug}
              shopAvatarHue={shopAvatarHue}
              contactPhone={shop.contact_phone}
              ratingAverage={shop.rating_average}
              ratingCount={shop.rating_count}
              locale={locale === "bn" ? "bn" : "en"}
            />
          )}
        </aside>
      </div>

      {/* ── Related ────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="mt-14">
          <h3 className="m-0 mb-4 text-xl font-bold tracking-[-0.01em]">
            {locale === "bn"
              ? `${shop.name} এর আরও পণ্য`
              : `More from ${shop.name}`}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map((p) => (
              <RelatedCard
                key={p.id}
                shopSlug={shop.slug}
                product={p}
                locale={locale === "bn" ? "bn" : "en"}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Subcomponents
   ────────────────────────────────────────────────────────────── */

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center text-amber-500 leading-none">
      {[1, 2, 3, 4, 5].map((n) => (
        <IcStar
          key={n}
          size={14}
          filled={value >= n - 0.25}
          half={value >= n - 0.75 && value < n - 0.25}
        />
      ))}
    </span>
  );
}

function TrustTile({
  icon,
  iconClass,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3 bg-white border border-stone-200 rounded-[12px]">
      <span
        className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-stone-900 leading-tight">
          {title}
        </div>
        <div className="text-[11.5px] text-stone-500 mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  iconClass,
  label,
  value,
  cta,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: React.ReactNode;
  cta?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] gap-3 items-center px-[18px] py-3.5 border-b border-stone-100 last:border-b-0">
      <span
        className={`w-[38px] h-[38px] rounded-[9px] grid place-items-center ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.04em] font-bold text-stone-500">
          {label}
        </div>
        <div className="text-[13.5px] text-stone-900 font-medium mt-0.5">
          {value}
        </div>
      </div>
      {cta}
    </div>
  );
}

function TabBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 -mb-px text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center ${
        on
          ? "border-teal-600 text-teal-700 font-semibold"
          : "border-transparent text-stone-500 hover:text-stone-900"
      }`}
    >
      {children}
    </button>
  );
}

function DescriptionPanel({
  text,
  locale,
}: {
  text: string;
  locale: "en" | "bn";
}) {
  return (
    <div>
      <h3 className="m-0 mb-3 text-lg font-bold tracking-[-0.01em]">
        {locale === "bn" ? "এই পণ্য সম্পর্কে" : "About this product"}
      </h3>
      {text ? (
        <p className="text-[14.5px] text-stone-700 leading-[1.6] whitespace-pre-line m-0">
          {text}
        </p>
      ) : (
        <p className="text-[14.5px] text-stone-500 italic leading-[1.6] m-0">
          {locale === "bn"
            ? "এই পণ্যের জন্য বিক্রেতা এখনো কোনো বিবরণ যোগ করেননি।"
            : "The seller hasn't added a description for this product yet."}
        </p>
      )}
    </div>
  );
}

function DeliveryPanel({
  delivery,
  locale,
}: {
  delivery: ReturnType<typeof useStorefront>["delivery"];
  locale: "en" | "bn";
}) {
  return (
    <div className="space-y-4">
      <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">
        {locale === "bn" ? "ডেলিভারি ও রিটার্ন" : "Delivery & returns"}
      </h3>
      <ul className="m-0 p-0 list-none grid gap-2.5">
        <DeliveryLi
          title={locale === "bn" ? "ডেলিভারি চার্জ" : "Delivery charge"}
          value={
            delivery?.delivery_charge
              ? formatBDT(delivery.delivery_charge, locale)
              : locale === "bn"
                ? "চেকআউটে দেখুন"
                : "See at checkout"
          }
        />
        {delivery?.free_delivery_threshold && (
          <DeliveryLi
            title={locale === "bn" ? "ফ্রি ডেলিভারি" : "Free delivery"}
            value={
              locale === "bn"
                ? `${formatBDT(delivery.free_delivery_threshold, locale)} এর উপরে অর্ডারে`
                : `On orders over ${formatBDT(delivery.free_delivery_threshold, locale)}`
            }
          />
        )}
        <DeliveryLi
          title={locale === "bn" ? "ডেলিভারি সময়" : "Delivery time"}
          value={
            locale === "bn"
              ? "শিপিং-এর পর ১–৩ কর্ম দিবস"
              : "1–3 business days after shipping"
          }
        />
        <DeliveryLi
          title={locale === "bn" ? "পেমেন্ট" : "Payment"}
          value={
            delivery?.advance_payment_required
              ? locale === "bn"
                ? "অগ্রিম ডেলিভারি ফি + ক্যাশ অন ডেলিভারি"
                : "Advance delivery fee + Cash on delivery"
              : locale === "bn"
                ? "ক্যাশ অন ডেলিভারি"
                : "Cash on delivery"
          }
        />
        <DeliveryLi
          title={locale === "bn" ? "রিটার্ন পলিসি" : "Returns"}
          value={
            locale === "bn"
              ? "ভুল পণ্য বা ক্ষতিগ্রস্ত হলে ৭ দিনের মধ্যে রিটার্ন।"
              : "7-day return for damaged or wrong items."
          }
        />
      </ul>
    </div>
  );
}

function DeliveryLi({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 bg-white border border-stone-200 rounded-lg">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600 mt-2 flex-shrink-0" />
      <div className="flex-1">
        <div className="text-xs uppercase tracking-[0.04em] font-bold text-stone-500">
          {title}
        </div>
        <div className="text-[14px] text-stone-900 font-medium mt-0.5">
          {value}
        </div>
      </div>
    </li>
  );
}

function ShopCard({
  shopName,
  shopSlug,
  shopAvatarHue,
  contactPhone,
  ratingAverage,
  ratingCount,
  locale,
}: {
  shopName: string;
  shopSlug: string;
  shopAvatarHue: number;
  contactPhone: string;
  ratingAverage: number;
  ratingCount: number;
  locale: "en" | "bn";
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-[14px] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-[10px] grid place-items-center text-white font-bold text-lg flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${shopAvatarHue}, 70%, 60%), hsl(${shopAvatarHue}, 60%, 40%))`,
          }}
        >
          {shopName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-stone-900 truncate">{shopName}</div>
          <div className="text-[12px] text-stone-500 mt-0.5">
            {ratingCount > 0
              ? `★ ${ratingAverage.toFixed(1)} · ${ratingCount} ${locale === "bn" ? "রিভিউ" : "reviews"}`
              : locale === "bn"
                ? "এখনো কোনো রিভিউ নেই"
                : "No reviews yet"}
          </div>
        </div>
      </div>
      <Link
        href={`/s/${shopSlug}`}
        className="block text-center h-10 leading-10 rounded-[10px] border-[1.5px] border-stone-200 hover:bg-stone-50 hover:border-stone-300 text-stone-900 text-[13px] font-semibold transition-colors"
      >
        {locale === "bn" ? "দোকানে যান" : "Visit shop"}
      </Link>
      {contactPhone && (
        <a
          href={`tel:${contactPhone}`}
          className="block text-center h-10 leading-10 mt-2 rounded-[10px] bg-teal-50 hover:bg-teal-100 text-teal-700 text-[13px] font-semibold transition-colors"
        >
          {locale === "bn" ? "দোকানে কল করুন" : "Call shop"}
        </a>
      )}
    </div>
  );
}

function RatingOverview({
  average,
  count,
  breakdown,
  locale,
}: {
  average: number;
  count: number;
  breakdown: number[]; // index 0=1star ... 4=5star
  locale: "en" | "bn";
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-extrabold tracking-[-0.03em] text-stone-900 leading-none">
          {count > 0 ? average.toFixed(1) : "—"}
        </span>
        <span className="text-base text-stone-400">/ 5</span>
      </div>
      <div className="mt-1">
        <StarRow value={average} />
      </div>
      <div className="text-[13px] text-stone-500 mt-1.5">
        {count > 0
          ? locale === "bn"
            ? `${count} টি যাচাইকৃত রিভিউ থেকে`
            : `Based on ${count} verified ${count === 1 ? "review" : "reviews"}`
          : locale === "bn"
            ? "এখনো কোনো রিভিউ নেই"
            : "No reviews yet"}
      </div>
      {count > 0 && (
        <div className="mt-3 grid gap-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = breakdown[star - 1] ?? 0;
            const sampleTotal = breakdown.reduce((a, b) => a + b, 0) || 1;
            const pct = (n / sampleTotal) * 100;
            return (
              <div
                key={star}
                className="grid grid-cols-[18px_minmax(0,1fr)_28px] gap-2 items-center text-[12.5px] text-stone-700"
              >
                <span>{star}</span>
                <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-right">{n}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-stone-100 flex gap-2 text-[12px] text-stone-500">
        <IcShield size={14} className="text-teal-600 flex-shrink-0 mt-0.5" />
        <span>
          {locale === "bn"
            ? "সব রিভিউ শুধু পণ্য পাওয়া ক্রেতাদের কাছ থেকে।"
            : "All reviews are from buyers who actually received this product."}
        </span>
      </div>
    </div>
  );
}

function ReviewsPanel({
  reviews,
  loading,
  locale,
}: {
  reviews: Review[];
  loading: boolean;
  locale: "en" | "bn";
}) {
  if (loading) {
    return <div className="text-sm text-stone-500">Loading…</div>;
  }
  if (reviews.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-[14px] px-5 py-8 text-center">
        <div className="text-base font-semibold text-stone-900 mb-1">
          {locale === "bn"
            ? "এই পণ্যের এখনো কোনো রিভিউ নেই"
            : "No reviews yet for this product"}
        </div>
        <div className="text-[13px] text-stone-500">
          {locale === "bn"
            ? "অর্ডারের পর আপনি প্রথম রিভিউ লিখতে পারবেন।"
            : "After your order, you'll be able to leave the first review."}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} locale={locale} />
      ))}
    </div>
  );
}

function ReviewCard({ review: r, locale }: { review: Review; locale: "en" | "bn" }) {
  const initial = (r.customer_name?.trim()[0] ?? "?").toUpperCase();
  const hue = hueFromString(r.id);
  return (
    <article className="bg-white border border-stone-200 rounded-[14px] px-5 py-[18px]">
      <div className="flex items-center gap-3 mb-2.5">
        <div
          className="w-10 h-10 rounded-full grid place-items-center text-white font-bold flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 75%, 60%), hsl(${hue}, 65%, 40%))`,
          }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-stone-900">
            {r.customer_name || (locale === "bn" ? "ক্রেতা" : "Buyer")}
          </div>
          <div className="text-[11.5px] text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="text-teal-700 inline-flex items-center gap-1 font-semibold">
              <IcCheck size={11} />
              {locale === "bn" ? "যাচাইকৃত ক্রেতা" : "Verified buyer"}
            </span>
            <span>·</span>
            <span>{formatDateTime(r.created_at, locale)}</span>
          </div>
        </div>
        <StarRow value={r.rating} />
      </div>
      {r.body && (
        <div className="text-sm text-stone-800 leading-[1.55] mb-1.5">
          {r.body}
        </div>
      )}
      {r.image_url && (
        <a
          href={r.image_url}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.image_url}
            alt=""
            className="max-h-32 rounded-md border border-stone-200"
          />
        </a>
      )}
      {r.owner_reply && (
        <div className="mt-3 bg-teal-50 border-l-[3px] border-teal-500 px-3.5 py-3 rounded-r-[10px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-teal-700 inline-flex items-center gap-1.5 mb-1">
            <IcReply size={11} />
            {locale === "bn" ? "বিক্রেতার জবাব" : "Reply from seller"}
          </div>
          <div className="text-[13.5px] text-stone-800 leading-[1.55]">
            {r.owner_reply}
          </div>
        </div>
      )}
    </article>
  );
}

function RelatedCard({
  shopSlug,
  product,
  locale,
}: {
  shopSlug: string;
  product: PublicProduct;
  locale: "en" | "bn";
}) {
  const { effective, original } = applyDiscount(
    product.price_bdt,
    product.discount_type,
    product.discount_value,
  );
  const hue = hueFromString(product.id);
  const cover = product.images?.[0]?.url;
  return (
    <Link
      href={`/s/${shopSlug}/p/${product.id}`}
      className="group bg-white border border-stone-200 rounded-[14px] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_-14px_rgba(28,25,23,0.16)]"
    >
      <ProductImage src={cover} hue={hue} ratio="1/1" />
      <div className="px-3.5 py-3">
        <p className="text-[13.5px] font-semibold leading-[1.35] m-0 mb-1.5 line-clamp-2 min-h-[36px] text-stone-900">
          {product.name}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[15px] font-bold text-stone-900">
            {formatBDT(effective, locale)}
          </div>
          {original && (
            <div className="text-xs text-stone-400 line-through font-medium">
              {formatBDT(original, locale)}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
   Inline icons (Lucide-style, currentColor)
   ───────────────────────────────────────────────────────────── */

function Icon({
  size = 16,
  children,
  strokeWidth = 1.8,
  fill = "none",
  className,
}: {
  size?: number;
  children: React.ReactNode;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
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

const IcChevLeft = (p: { size?: number; thick?: boolean }) => (
  <Icon size={p.size} strokeWidth={p.thick ? 2.4 : 2}>
    <polyline points="15 18 9 12 15 6" />
  </Icon>
);
const IcChevRight = (p: { size?: number; thick?: boolean; className?: string }) => (
  <Icon size={p.size} strokeWidth={p.thick ? 2.4 : 2} className={p.className}>
    <polyline points="9 18 15 12 9 6" />
  </Icon>
);
const IcCheck = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} strokeWidth={2.8} className={p.className}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const IcCheck2 = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2.2}>
    <polyline points="20 6 9 17 4 12" />
  </Icon>
);
const IcStar = ({
  size = 14,
  filled,
  half,
}: {
  size?: number;
  filled?: boolean;
  half?: boolean;
}) => {
  if (half) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block">
        <defs>
          <linearGradient id="half-star">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
          fill="url(#half-star)"
          stroke="currentColor"
          strokeWidth={1.2}
        />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  );
};
const IcZoom = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </Icon>
);
const IcCart = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2}>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </Icon>
);
const IcBolt = (p: { size?: number; className?: string }) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={p.className}
  >
    <path d="M13 2 4.09 12.97c-.36.45-.36 1.09 0 1.54L11 22h2l-2-9h7l-7-11z" />
  </svg>
);
const IcShield = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} strokeWidth={1.9} className={p.className}>
    <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" />
  </Icon>
);
const IcReturn = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={1.9}>
    <path d="M3 9a2 2 0 0 1 2-2h6V3h2v4h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 12 11 14 15 10" />
  </Icon>
);
const IcWallet = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={1.9}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </Icon>
);
const IcClock = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={1.9}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);
const IcTruck = (p: { size?: number }) => (
  <Icon size={p.size}>
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </Icon>
);
const IcInfo = (p: { size?: number }) => (
  <Icon size={p.size}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Icon>
);
const IcReply = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2}>
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </Icon>
);
