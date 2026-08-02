"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useStorefront } from "./StorefrontShell";
import { ReportShopButton } from "@/components/storefront/ReportShopButton";
import { getCategories, getProducts, type PublicProduct } from "@/lib/storefrontApi";
import { getPopularProducts } from "@/lib/analyticsApi";
import { getShopReviews, type Review } from "@/lib/reviewApi";
import { applyDiscount, formatBDT, formatDateTime } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { hueFromString, ProductImage } from "@/components/ui/ProductImage";

type Tab = "products" | "reviews" | "about" | "delivery";

export default function ShopLandingPage() {
  const { shop, delivery, cart, following, toggleFollow, share, copied } =
    useStorefront();
  const { locale } = useI18n();
  const [tab, setTab] = useState<Tab>("products");
  const [cat, setCat] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "in_stock" | "on_sale">("all");
  const [copiedNumber, setCopiedNumber] = useState(false);
  const hue = hueFromString(shop.id);

  const catsQ = useQuery({
    queryKey: ["sf-cats", shop.slug],
    queryFn: () => getCategories(shop.slug),
  });

  const prodsQ = useQuery({
    queryKey: ["sf-prods", shop.slug, cat],
    queryFn: () =>
      getProducts(shop.slug, { category_id: cat || undefined, page_size: 24 }),
  });

  const popularQ = useQuery({
    queryKey: ["sf-popular", shop.slug],
    queryFn: () => getPopularProducts(shop.slug),
  });

  const reviewsQ = useQuery({
    queryKey: ["sf-shop-reviews", shop.slug],
    queryFn: () => getShopReviews(shop.slug),
  });

  const categories = catsQ.data ?? [];
  const productsAll = prodsQ.data?.data ?? [];
  const productCount = prodsQ.data?.pagination?.total ?? productsAll.length;
  const popularRefs = popularQ.data ?? [];

  // Apply quick filters (chip row) client-side over the page we already
  // fetched — keeps the UI snappy without round-tripping to the server.
  const products = useMemo(() => {
    let list = productsAll;
    if (filter === "in_stock") list = list.filter((p) => p.stock > 0);
    if (filter === "on_sale")
      list = list.filter((p) => {
        const { original } = applyDiscount(
          p.price_bdt,
          p.discount_type,
          p.discount_value,
        );
        return !!original;
      });
    return list;
  }, [productsAll, filter]);

  const popularProducts = popularRefs
    .map((pp) => productsAll.find((p) => p.id === pp.product_id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 4);

  const reviews = reviewsQ.data?.data.reviews ?? [];
  const rating = reviewsQ.data?.data.rating ?? {
    average: shop.rating_average,
    count: shop.rating_count,
  };
  const reviewCount = rating.count ?? 0;
  const ratingAvg = rating.average ?? 0;

  // Best-effort star breakdown derived from the visible review page.
  const breakdown = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      const i = Math.min(4, Math.max(0, Math.round(r.rating) - 1));
      buckets[i]++;
    }
    return buckets;
  }, [reviews]);

  const isVerified = shop.rating_count >= 3 && shop.rating_average >= 4;
  const isTopRated = shop.rating_count >= 5 && shop.rating_average >= 4.5;

  // Build the 4-card info strip (Payment / Delivery / Service area / Contact).
  const infoCards = useMemo(() => {
    const out: InfoCardSpec[] = [];
    if (delivery) {
      out.push({
        icon: <IcWallet size={18} />,
        iconClass: "bg-teal-50 text-teal-700",
        label: locale === "bn" ? "পেমেন্ট" : "Payment",
        value: delivery.cod_enabled
          ? locale === "bn"
            ? "ক্যাশ অন ডেলিভারি"
            : "Cash on delivery"
          : locale === "bn"
            ? "অগ্রিম পেমেন্ট"
            : "Advance payment",
        sub: delivery.cod_enabled
          ? locale === "bn"
            ? "পণ্য পেয়ে পেমেন্ট"
            : "Pay when you receive"
          : locale === "bn"
            ? "অর্ডারের আগে পরিশোধ"
            : "Prepayment required",
      });
      const charge = parseFloat(delivery.delivery_charge ?? "0");
      const zoneFees = (delivery.delivery_zones ?? [])
        .map((z) => parseFloat(z.delivery_charge))
        .filter((n) => Number.isFinite(n));
      const positives = [
        ...(charge > 0 ? [charge] : []),
        ...zoneFees.filter((n) => n > 0),
      ];
      let deliveryValue: string;
      let deliverySub: string;
      if (positives.length === 0) {
        deliveryValue = locale === "bn" ? "ফ্রি" : "Free";
        deliverySub = locale === "bn" ? "সব অর্ডারে" : "On all orders";
      } else if (zoneFees.length > 0) {
        deliveryValue =
          locale === "bn"
            ? `${formatBDT(Math.min(...positives), locale)} থেকে`
            : `From ${formatBDT(Math.min(...positives), locale)}`;
        deliverySub = locale === "bn" ? "এলাকা অনুযায়ী" : "Varies by area";
      } else {
        deliveryValue = formatBDT(charge, locale);
        deliverySub = locale === "bn" ? "১–৩ দিনে শিপিং" : "1–3 day shipping";
      }
      out.push({
        icon: <IcTruck size={18} />,
        iconClass: "bg-amber-100 text-amber-700",
        label: locale === "bn" ? "ডেলিভারি" : "Delivery",
        value: deliveryValue,
        sub: deliverySub,
      });
      const zones = delivery.delivery_zones ?? [];
      const totalAreas = zones.length;
      out.push({
        icon: <IcMapPin size={18} />,
        iconClass: "bg-green-100 text-green-700",
        label: locale === "bn" ? "সেবা এলাকা" : "Service area",
        value:
          totalAreas > 0
            ? locale === "bn"
              ? `${totalAreas} এলাকা`
              : `${totalAreas} ${totalAreas === 1 ? "zone" : "zones"}`
            : locale === "bn"
              ? "বাংলাদেশজুড়ে"
              : "Bangladesh-wide",
        sub:
          totalAreas > 0
            ? zones.slice(0, 2).map((z) => z.division).join(", ") +
              (totalAreas > 2 ? "…" : "")
            : locale === "bn"
              ? "সব এলাকায় ডেলিভারি"
              : "Delivers everywhere",
      });
    }
    if (shop.contact_phone) {
      out.push({
        icon: <IcPhone size={18} />,
        iconClass: "bg-coral-50 text-coral-600",
        label: locale === "bn" ? "বিক্রেতার সাথে যোগাযোগ" : "Contact seller",
        value: shop.contact_phone,
        sub:
          locale === "bn"
            ? "কল বা WhatsApp করুন"
            : "Tap to call or WhatsApp",
        href: `tel:${shop.contact_phone}`,
      });
    }
    return out;
  }, [delivery, shop.contact_phone, locale]);

  function copyNumber(value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 1400);
    });
  }

  const filterChips = (
    <div className="flex items-center gap-2 flex-wrap">
      <Chip on={filter === "all" && !cat} onClick={() => {
        setFilter("all");
        setCat("");
      }}>
        {locale === "bn" ? "সব" : "All"}
      </Chip>
      <Chip on={filter === "in_stock"} onClick={() => setFilter("in_stock")}>
        {locale === "bn" ? "স্টকে আছে" : "In stock"}
      </Chip>
      <Chip on={filter === "on_sale"} onClick={() => setFilter("on_sale")}>
        {locale === "bn" ? "ছাড়ে" : "On sale"}
      </Chip>
      {categories.length > 0 && (
        <>
          <span className="w-px h-5 bg-stone-200 mx-1" aria-hidden />
          {categories.map((c) => (
            <Chip
              key={c.id}
              on={cat === c.id}
              onClick={() => setCat(cat === c.id ? "" : c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* ── COVER ─────────────────────────────────────────────── */}
      <div
        className="relative h-[200px] sm:h-[260px] lg:h-[280px] overflow-hidden"
        style={
          shop.banner_url
            ? undefined
            : {
                backgroundImage:
                  "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.35) 100%), linear-gradient(135deg, #FBA85B 0%, #DB2777 50%, #7C3AED 100%)",
              }
        }
      >
        {shop.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.banner_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {!shop.banner_url && (
          <>
            <span
              className="absolute pointer-events-none"
              style={{
                inset: 0,
                background:
                  "radial-gradient(600px 200px at 20% 30%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(500px 200px at 80% 70%, rgba(255,255,255,0.12), transparent 60%)",
              }}
            />
          </>
        )}
        {/* Top-right cover action buttons */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            type="button"
            onClick={share}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[9px] bg-white/92 hover:bg-white text-stone-900 text-[12.5px] font-semibold backdrop-blur-sm shadow-sm"
          >
            {copied ? (
              <>
                <IcCheck size={13} />
                {locale === "bn" ? "কপি হয়েছে" : "Copied"}
              </>
            ) : (
              <>
                <IcShare size={13} />
                {locale === "bn" ? "শেয়ার" : "Share"}
              </>
            )}
          </button>
          <ReportShopButton shopSlug={shop.slug} shopName={shop.name} />
        </div>
      </div>

      {/* ── PROFILE BAND ──────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] gap-6 items-end -mt-14 lg:-mt-14">
            {/* Avatar */}
            <div
              className="w-[110px] h-[110px] sm:w-[120px] sm:h-[120px] rounded-[22px] border-[5px] border-white shadow-[0_12px_28px_-10px_rgba(28,25,23,0.25)] grid place-items-center overflow-hidden flex-shrink-0"
              style={{
                background: shop.logo_url
                  ? undefined
                  : `linear-gradient(135deg, hsl(${hue}, 75%, 65%), hsl(${hue}, 65%, 40%))`,
                color: "#fff",
              }}
            >
              {shop.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.logo_url}
                  alt={shop.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[44px] font-extrabold tracking-[-0.02em] leading-none">
                  {shop.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Name + tagline + stats */}
            <div className="pb-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="m-0 text-[26px] sm:text-3xl font-extrabold tracking-[-0.02em] leading-tight">
                  {shop.name}
                </h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-[11.5px] font-bold">
                    <IcCheck size={11} />
                    {locale === "bn" ? "যাচাইকৃত" : "Verified seller"}
                  </span>
                )}
                {isTopRated && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11.5px] font-bold">
                    <IcStar size={11} filled />
                    {locale === "bn" ? "শীর্ষ রেটেড" : "Top rated"}
                  </span>
                )}
              </div>
              {shop.description?.trim() && (
                <p className="my-2 text-[14.5px] text-stone-600 leading-[1.55] max-w-prose">
                  {shop.description}
                </p>
              )}
              <div className="flex items-center gap-x-4 gap-y-1 text-[13px] flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-stone-700">
                  <strong className="text-stone-900 font-bold">
                    {productCount}
                  </strong>
                  {locale === "bn"
                    ? "পণ্য"
                    : productCount === 1
                      ? "product"
                      : "products"}
                </span>
                {shop.rating_count > 0 && (
                  <>
                    <Dot />
                    <span className="inline-flex items-center gap-1.5 text-stone-700">
                      <IcStar size={13} filled className="text-amber-500" />
                      <strong className="text-stone-900 font-bold">
                        {shop.rating_average.toFixed(1)}
                      </strong>
                      <span className="text-stone-500">
                        ({shop.rating_count}{" "}
                        {locale === "bn"
                          ? "রিভিউ"
                          : shop.rating_count === 1
                            ? "review"
                            : "reviews"}
                        )
                      </span>
                    </span>
                  </>
                )}
                {shop.contact_phone && (
                  <>
                    <Dot />
                    <a
                      href={`tel:${shop.contact_phone}`}
                      className="inline-flex items-center gap-1.5 text-stone-700 hover:text-teal-700"
                    >
                      <IcPhone size={13} className="text-stone-400" />
                      {shop.contact_phone}
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* CTA row */}
            <div className="flex items-center gap-2 pb-1.5">
              <button
                type="button"
                onClick={share}
                title={locale === "bn" ? "শেয়ার" : "Share"}
                className="w-[42px] h-[42px] grid place-items-center rounded-[10px] bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 text-stone-700"
                aria-label="Share shop"
              >
                <IcShare size={16} />
              </button>
              {shop.contact_phone && (
                <a
                  href={`https://wa.me/${normalizeWa(shop.contact_phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                  className="w-[42px] h-[42px] grid place-items-center rounded-[10px] bg-green-100 hover:bg-green-200 text-green-700"
                  aria-label="Message on WhatsApp"
                >
                  <IcWhatsapp size={18} />
                </a>
              )}
              <button
                type="button"
                onClick={toggleFollow}
                className={`h-[42px] px-5 inline-flex items-center gap-2 rounded-[10px] text-sm font-semibold transition-colors ${
                  following
                    ? "bg-white border-[1.5px] border-stone-200 text-stone-900 hover:bg-stone-50"
                    : "bg-stone-900 hover:bg-stone-700 text-white"
                }`}
              >
                <IcHeart size={16} filled={following} />
                {following
                  ? locale === "bn"
                    ? "ফলো করছেন"
                    : "Following"
                  : locale === "bn"
                    ? "ফলো করুন"
                    : "Follow shop"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── INFO STRIP ───────────────────────────────────────── */}
      {infoCards.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-5">
          <div
            className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${
              infoCards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
            }`}
          >
            {infoCards.map((c, i) => (
              <InfoCard key={i} {...c} />
            ))}
          </div>
        </div>
      )}

      {/* ── PAYMENT NOTE ─────────────────────────────────────── */}
      {delivery?.advance_payment_required &&
        delivery.advance_payment_instructions?.trim() && (
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-3">
            <div className="flex items-center gap-3 px-4 py-3.5 bg-amber-50 border-[1.5px] border-amber-200 rounded-[12px]">
              <span className="w-9 h-9 rounded-[9px] grid place-items-center bg-amber-100 text-amber-700 flex-shrink-0">
                <IcInfo size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] uppercase tracking-[0.04em] font-bold text-amber-700">
                  {locale === "bn"
                    ? "অগ্রিম পেমেন্টের নির্দেশনা"
                    : "How to pay advance"}
                </div>
                <div className="text-[14px] text-stone-900 mt-0.5 font-medium leading-[1.4] whitespace-pre-line">
                  {delivery.advance_payment_instructions}
                </div>
              </div>
              {shop.contact_phone && (
                <button
                  type="button"
                  onClick={() => copyNumber(shop.contact_phone)}
                  className="hidden sm:inline-flex h-[34px] px-3.5 items-center gap-1.5 bg-white border-[1.5px] border-amber-200 hover:border-amber-300 text-stone-900 text-[12.5px] font-semibold rounded-md flex-shrink-0"
                >
                  {copiedNumber ? <IcCheck size={13} /> : <IcCopy size={13} />}
                  {copiedNumber
                    ? locale === "bn"
                      ? "কপি হয়েছে"
                      : "Copied"
                    : locale === "bn"
                      ? "নম্বর কপি"
                      : "Copy number"}
                </button>
              )}
            </div>
          </div>
        )}

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-7 border-b border-stone-200 flex gap-1 overflow-x-auto no-scrollbar">
        <TabBtn on={tab === "products"} onClick={() => setTab("products")}>
          {locale === "bn" ? "সব পণ্য" : "All products"}
          {productCount > 0 && (
            <TabCount on={tab === "products"}>{productCount}</TabCount>
          )}
        </TabBtn>
        <TabBtn on={tab === "reviews"} onClick={() => setTab("reviews")}>
          {locale === "bn" ? "রিভিউ" : "Reviews"}
          {reviewCount > 0 && (
            <TabCount on={tab === "reviews"}>{reviewCount}</TabCount>
          )}
        </TabBtn>
        <TabBtn on={tab === "about"} onClick={() => setTab("about")}>
          {locale === "bn" ? "পরিচিতি" : "About"}
        </TabBtn>
        <TabBtn on={tab === "delivery"} onClick={() => setTab("delivery")}>
          {locale === "bn" ? "ডেলিভারি ও রিটার্ন" : "Delivery & returns"}
        </TabBtn>
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────── */}
      {tab === "products" && (
        <>
          {/* Filter chips */}
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            {filterChips}
          </div>

          {/* Popular this week */}
          {popularProducts.length > 0 && !cat && filter === "all" && (
            <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
              <div className="flex items-baseline justify-between mb-3.5">
                <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">
                  {locale === "bn"
                    ? "এই সপ্তাহে জনপ্রিয়"
                    : "Popular this week"}
                </h3>
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {popularProducts.map((p, idx) => (
                  <ShopProductCard
                    key={p.id}
                    shopSlug={shop.slug}
                    product={p}
                    badge={
                      idx === 0
                        ? "bestseller"
                        : applyDiscount(
                              p.price_bdt,
                              p.discount_type,
                              p.discount_value,
                            ).original
                          ? "sale"
                          : undefined
                    }
                    onAdd={() => addProduct(cart, p)}
                    locale={locale === "bn" ? "bn" : "en"}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All products grid */}
          <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-12">
            <div className="flex items-baseline justify-between mb-3.5">
              <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">
                {locale === "bn" ? "সব পণ্য" : "All products"}
              </h3>
              <span className="text-xs text-stone-500">
                {products.length}{" "}
                {locale === "bn"
                  ? "টি"
                  : products.length === 1
                    ? "item"
                    : "items"}
              </span>
            </div>
            {prodsQ.isLoading ? (
              <div className="text-stone-400 text-sm py-12 text-center">
                Loading…
              </div>
            ) : products.length === 0 ? (
              <div className="text-stone-400 text-sm py-20 text-center">
                {locale === "bn"
                  ? "কোনো পণ্য পাওয়া যায়নি"
                  : "No products matched."}
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                {products.map((p) => (
                  <ShopProductCard
                    key={p.id}
                    shopSlug={shop.slug}
                    product={p}
                    onAdd={() => addProduct(cart, p)}
                    locale={locale === "bn" ? "bn" : "en"}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "reviews" && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-12">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
            <RatingOverview
              average={ratingAvg}
              count={reviewCount}
              breakdown={breakdown}
              locale={locale === "bn" ? "bn" : "en"}
            />
            <div>
              {reviewsQ.isLoading ? (
                <div className="text-sm text-stone-500 py-8 text-center">
                  Loading…
                </div>
              ) : reviews.length === 0 ? (
                <div className="px-5 py-10 text-center bg-white border border-stone-200 rounded-[14px]">
                  <div className="text-base font-semibold text-stone-900 mb-1">
                    {locale === "bn"
                      ? "এখনো কোনো রিভিউ নেই"
                      : "No reviews yet"}
                  </div>
                  <div className="text-[13px] text-stone-500">
                    {locale === "bn"
                      ? "এই দোকান থেকে অর্ডার পেয়ে রিভিউ দিতে পারবেন।"
                      : "Be the first to leave a review after your order."}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {reviews.map((r) => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      locale={locale === "bn" ? "bn" : "en"}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "about" && (
        <section className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-12">
          <div className="bg-white border border-stone-200 rounded-[14px] p-6 sm:p-7">
            <h3 className="m-0 mb-3 text-lg font-bold tracking-[-0.01em]">
              {locale === "bn" ? "এই দোকান সম্পর্কে" : "About this shop"}
            </h3>
            {shop.description?.trim() ? (
              <p className="text-[14.5px] text-stone-700 leading-[1.65] whitespace-pre-line m-0">
                {shop.description}
              </p>
            ) : (
              <p className="text-[14.5px] text-stone-500 italic leading-[1.6] m-0">
                {locale === "bn"
                  ? "বিক্রেতা এখনো এই দোকানের পরিচিতি যোগ করেননি।"
                  : "The seller hasn't added a shop description yet."}
              </p>
            )}
            {shop.contact_phone && (
              <div className="mt-5 pt-5 border-t border-stone-100 flex items-center gap-3">
                <IcPhone size={16} className="text-teal-600" />
                <a
                  href={`tel:${shop.contact_phone}`}
                  className="text-[14px] font-semibold text-stone-900 hover:text-teal-700"
                >
                  {shop.contact_phone}
                </a>
                <a
                  href={`https://wa.me/${normalizeWa(shop.contact_phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-green-100 hover:bg-green-200 text-green-700 text-[13px] font-semibold"
                >
                  <IcWhatsapp size={14} />
                  WhatsApp
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "delivery" && (
        <section className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-12">
          <div className="bg-white border border-stone-200 rounded-[14px] p-6">
            <h3 className="m-0 mb-4 text-lg font-bold tracking-[-0.01em]">
              {locale === "bn" ? "ডেলিভারি ও রিটার্ন" : "Delivery & returns"}
            </h3>
            <ul className="m-0 p-0 list-none grid gap-2.5">
              <DeliveryRow
                title={
                  locale === "bn" ? "ডেলিভারি চার্জ" : "Delivery charge"
                }
                value={
                  delivery?.delivery_charge
                    ? formatBDT(delivery.delivery_charge, locale)
                    : locale === "bn"
                      ? "চেকআউটে দেখুন"
                      : "See at checkout"
                }
              />
              {delivery?.free_delivery_threshold && (
                <DeliveryRow
                  title={locale === "bn" ? "ফ্রি ডেলিভারি" : "Free delivery"}
                  value={
                    locale === "bn"
                      ? `${formatBDT(delivery.free_delivery_threshold, locale)} এর উপরে অর্ডারে`
                      : `On orders over ${formatBDT(delivery.free_delivery_threshold, locale)}`
                  }
                />
              )}
              {(delivery?.delivery_zones ?? []).length > 0 && (
                <DeliveryRow
                  title={locale === "bn" ? "এলাকাভিত্তিক রেট" : "Zone rates"}
                  value={
                    <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5 mt-1">
                      {delivery!.delivery_zones.map((z) => (
                        <li
                          key={z.id ?? z.division}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-[12.5px] text-stone-700"
                        >
                          <strong className="text-stone-900 font-semibold">
                            {z.division}
                          </strong>{" "}
                          {formatBDT(z.delivery_charge, locale)}
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}
              <DeliveryRow
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
              <DeliveryRow
                title={locale === "bn" ? "রিটার্ন পলিসি" : "Returns"}
                value={
                  locale === "bn"
                    ? "ভুল পণ্য বা ক্ষতিগ্রস্ত হলে ৭ দিনের মধ্যে রিটার্ন।"
                    : "7-day return for damaged or wrong items."
                }
              />
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */

function addProduct(
  cart: ReturnType<typeof useStorefront>["cart"],
  p: PublicProduct,
) {
  const { effective } = applyDiscount(
    p.price_bdt,
    p.discount_type,
    p.discount_value,
  );
  cart.addItem(
    {
      productId: p.id,
      name: p.name,
      price: String(effective),
      image: p.images?.[0]?.url ?? null,
      stock: p.stock,
    },
    1,
  );
}

function normalizeWa(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `880${digits.slice(1)}` : digits;
}

/* ─────────────────────────────────────────────────────────────
   Subcomponents
   ───────────────────────────────────────────────────────────── */

interface InfoCardSpec {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  sub: string;
  href?: string;
}

function InfoCard({ icon, iconClass, label, value, sub, href }: InfoCardSpec) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-stone-200 rounded-[12px] hover:border-stone-300 transition-colors h-full">
      <span
        className={`w-[38px] h-[38px] rounded-[9px] grid place-items-center flex-shrink-0 ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.04em] font-bold text-stone-500">
          {label}
        </div>
        <div className="text-sm font-bold text-stone-900 mt-0.5 truncate">
          {value}
        </div>
        <div className="text-[11.5px] text-stone-500 mt-0.5 truncate">
          {sub}
        </div>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

function Chip({
  on,
  onClick,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[34px] px-3 inline-flex items-center gap-1.5 rounded-full text-[12.5px] font-medium border-[1.5px] transition-colors whitespace-nowrap ${
        on
          ? "bg-stone-900 text-white border-stone-900"
          : "bg-white text-stone-700 border-stone-200 hover:border-stone-300"
      }`}
    >
      {children}
    </button>
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
      className={`px-[18px] py-3 -mb-px text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-2 ${
        on
          ? "border-teal-600 text-teal-700 font-semibold"
          : "border-transparent text-stone-500 hover:text-stone-900"
      }`}
    >
      {children}
    </button>
  );
}

function TabCount({
  on,
  children,
}: {
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`text-[11px] font-semibold px-[7px] py-px rounded-full ${
        on ? "bg-teal-50 text-teal-700" : "bg-stone-100 text-stone-600"
      }`}
    >
      {children}
    </span>
  );
}

function Dot() {
  return (
    <span className="w-1 h-1 rounded-full bg-stone-300" aria-hidden="true" />
  );
}

/* ── Product card matching the design ───────────────────────── */

function ShopProductCard({
  shopSlug,
  product,
  badge,
  onAdd,
  locale,
}: {
  shopSlug: string;
  product: PublicProduct;
  badge?: "bestseller" | "sale" | "few-left";
  onAdd: () => void;
  locale: "en" | "bn";
}) {
  const { effective, original } = applyDiscount(
    product.price_bdt,
    product.discount_type,
    product.discount_value,
  );
  const discountPct =
    original && Number(original) > 0
      ? Math.round(
          ((Number(original) - Number(effective)) / Number(original)) * 100,
        )
      : 0;

  // Auto-derive a stock badge for low-stock items unless caller overrode.
  const computedBadge =
    badge ??
    (product.stock > 0 && product.stock < 5 ? "few-left" : undefined) ??
    (discountPct > 0 ? "sale" : undefined);

  const cover = product.images?.[0]?.url;
  const hue = hueFromString(product.id);
  const outOfStock = product.stock <= 0;

  return (
    <Link
      href={`/s/${shopSlug}/p/${product.id}`}
      className="group bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_-14px_rgba(28,25,23,0.16)] hover:border-transparent"
    >
      <div className="relative aspect-square overflow-hidden">
        <ProductImage src={cover} hue={hue} ratio="1/1" className="w-full h-full" />

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
          {computedBadge === "bestseller" && (
            <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-amber-100 text-amber-700 text-[10.5px] font-bold">
              <IcStar size={10} filled />
              {locale === "bn" ? "জনপ্রিয়" : "Bestseller"}
            </span>
          )}
          {computedBadge === "sale" && discountPct > 0 && (
            <span className="inline-flex items-center px-2 py-[3px] rounded-full bg-coral-500 text-white text-[10.5px] font-bold">
              −{discountPct}%
            </span>
          )}
          {computedBadge === "few-left" && (
            <span className="inline-flex items-center px-2 py-[3px] rounded-full bg-amber-100 text-amber-700 text-[10.5px] font-bold">
              {locale === "bn" ? "কয়েকটি বাকি" : "Few left"}
            </span>
          )}
          {outOfStock && (
            <span className="inline-flex items-center px-2 py-[3px] rounded-full bg-stone-900 text-white text-[10.5px] font-bold">
              {locale === "bn" ? "স্টক নেই" : "Out of stock"}
            </span>
          )}
        </div>

        {/* Slide-up Add to cart */}
        {!outOfStock && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAdd();
            }}
            // Always visible on touch devices: a hover-only reveal is
            // unreachable on a phone, which is where nearly all buyers are.
            // Desktop keeps the slide-up-on-hover treatment.
            className="absolute left-2.5 right-2.5 bottom-2.5 h-[38px] rounded-[9px] bg-stone-900 hover:bg-teal-600 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 opacity-100 translate-y-0 lg:opacity-0 lg:translate-y-1.5 lg:group-hover:opacity-100 lg:group-hover:translate-y-0 transition-all duration-200"
          >
            <IcCart size={14} />
            {locale === "bn" ? "কার্টে যোগ" : "Add to cart"}
          </button>
        )}
      </div>

      <div className="px-3.5 py-3 flex-1 flex flex-col">
        <div className="text-sm font-semibold text-stone-900 leading-[1.35] line-clamp-2 min-h-[2.7em]">
          {product.name}
        </div>
        <div className="flex items-baseline gap-2 mt-auto pt-2">
          <span className="text-[17px] font-bold tracking-[-0.01em] text-stone-900">
            {formatBDT(effective, locale)}
          </span>
          {original && (
            <span className="text-[12.5px] text-stone-400 line-through font-medium">
              {formatBDT(original, locale)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Reviews ───────────────────────────────────────────────── */

function RatingOverview({
  average,
  count,
  breakdown,
  locale,
}: {
  average: number;
  count: number;
  breakdown: number[];
  locale: "en" | "bn";
}) {
  return (
    <aside className="bg-white border border-stone-200 rounded-2xl p-5 lg:sticky lg:top-20">
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-extrabold tracking-[-0.03em] text-stone-900 leading-none">
          {count > 0 ? average.toFixed(1) : "—"}
        </span>
        <span className="text-base text-stone-400">/ 5</span>
      </div>
      <div className="mt-1.5 inline-flex items-center text-amber-500 leading-none">
        {[1, 2, 3, 4, 5].map((n) => (
          <IcStar
            key={n}
            size={16}
            filled={average >= n - 0.25}
            half={average >= n - 0.75 && average < n - 0.25}
          />
        ))}
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
            ? "সব রিভিউ যারা অর্ডার পেয়েছেন তাদের কাছ থেকে।"
            : "All reviews are from buyers who actually received their order."}
        </span>
      </div>
    </aside>
  );
}

function ReviewCard({
  review: r,
  locale,
}: {
  review: Review;
  locale: "en" | "bn";
}) {
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
        <span className="inline-flex items-center text-amber-500 leading-none ml-auto">
          {[1, 2, 3, 4, 5].map((n) => (
            <IcStar
              key={n}
              size={14}
              filled={r.rating >= n - 0.25}
              half={r.rating >= n - 0.75 && r.rating < n - 0.25}
            />
          ))}
        </span>
      </div>
      {r.product_name && (
        <Link
          href={`/s/${r.shop_id}/p/${r.product_id}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-50 text-[12px] text-stone-700 mb-2 hover:bg-stone-100"
        >
          <IcPackage size={12} />
          {r.product_name}
        </Link>
      )}
      {r.body && (
        <div className="text-sm text-stone-800 leading-[1.55] my-1.5">
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
        <div className="mt-2.5 bg-teal-50 border-l-[3px] border-teal-500 px-3.5 py-3 rounded-r-[10px]">
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

function DeliveryRow({
  title,
  value,
}: {
  title: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 bg-stone-50 border border-stone-100 rounded-lg">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600 mt-2 flex-shrink-0" />
      <div className="flex-1 min-w-0">
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

/* ─────────────────────────────────────────────────────────────
   Inline icons
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

const IcCheck = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} strokeWidth={2.8} className={p.className}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const IcCopy = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);
const IcStar = ({
  size = 14,
  filled,
  half,
  className,
}: {
  size?: number;
  filled?: boolean;
  half?: boolean;
  className?: string;
}) => {
  if (half) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={`inline-block ${className ?? ""}`}
      >
        <defs>
          <linearGradient id="half-storefront">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
          fill="url(#half-storefront)"
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
      className={`inline-block ${className ?? ""}`}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  );
};
const IcHeart = (p: { size?: number; filled?: boolean }) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill={p.filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={p.filled ? 0 : 1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const IcShare = (p: { size?: number }) => (
  <Icon size={p.size}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </Icon>
);
const IcWhatsapp = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
  </svg>
);
const IcWallet = (p: { size?: number }) => (
  <Icon size={p.size}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
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
const IcMapPin = (p: { size?: number }) => (
  <Icon size={p.size}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);
const IcPhone = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Icon>
);
const IcInfo = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Icon>
);
const IcCart = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2}>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </Icon>
);
const IcShield = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} strokeWidth={2} className={p.className}>
    <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" />
  </Icon>
);
const IcPackage = (p: { size?: number }) => (
  <Icon size={p.size}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </Icon>
);
const IcReply = (p: { size?: number }) => (
  <Icon size={p.size} strokeWidth={2}>
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </Icon>
);
