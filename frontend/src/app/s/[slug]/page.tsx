"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStorefront } from "./StorefrontShell";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewList } from "@/components/storefront/ReviewList";
import { ReportShopButton } from "@/components/storefront/ReportShopButton";
import { getCategories, getProducts } from "@/lib/storefrontApi";
import { getPopularProducts } from "@/lib/analyticsApi";
import { applyDiscount, formatBDT } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { hueFromString } from "@/components/ui/ProductImage";
import {
  IcBanknote,
  IcCheck,
  IcCopy,
  IcGift,
  IcHeart,
  IcInfo,
  IcMapPin,
  IcPhone,
  IcTruck,
} from "@/components/icons/Icons";
import type { ReactNode } from "react";

export default function ShopLandingPage() {
  const { shop, delivery, cart, following, toggleFollow, share, copied } =
    useStorefront();
  const { locale } = useI18n();
  const [cat, setCat] = useState<string>("");
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

  const categories = catsQ.data ?? [];
  const products = prodsQ.data?.data ?? [];
  const popular = popularQ.data ?? [];
  const popularProducts = popular
    .map((pp) => products.find((p) => p.id === pp.product_id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 4);

  const productCount = prodsQ.data?.pagination?.total ?? products.length;

  /* ── Build trust-strip cells from delivery data ─────────── */
  const cells: TrustCell[] = [];
  if (delivery) {
    cells.push({
      icon: <IcBanknote size={16} />,
      color: delivery.cod_enabled ? "green" : "amber",
      label: locale === "bn" ? "পেমেন্ট" : "Payment",
      value: delivery.cod_enabled
        ? locale === "bn"
          ? "ক্যাশ অন ডেলিভারি"
          : "Cash on Delivery"
        : locale === "bn"
          ? "অগ্রিম পেমেন্ট"
          : "Advance Payment",
      sub: delivery.cod_enabled
        ? locale === "bn"
          ? "গ্রহণের সময় পেমেন্ট"
          : "Pay when you receive"
        : locale === "bn"
          ? "অর্ডারের আগে পরিশোধ"
          : "Prepayment required",
    });

    const charge = parseFloat(delivery.delivery_charge ?? "0");
    cells.push({
      icon: <IcTruck size={16} />,
      color: "teal",
      label: locale === "bn" ? "ডেলিভারি চার্জ" : "Delivery charge",
      value:
        charge > 0
          ? formatBDT(charge, locale)
          : locale === "bn"
            ? "ফ্রি"
            : "Free",
      sub:
        charge > 0
          ? locale === "bn"
            ? "স্ট্যান্ডার্ড রেট"
            : "Standard rate"
          : locale === "bn"
            ? "সব অর্ডারে"
            : "On all orders",
    });

    const threshold = parseFloat(delivery.free_delivery_threshold ?? "0");
    if (threshold > 0) {
      cells.push({
        icon: <IcGift size={16} />,
        color: "green",
        label: locale === "bn" ? "ফ্রি ডেলিভারি" : "Free shipping",
        value:
          locale === "bn"
            ? `${formatBDT(threshold, locale)}-এর উপরে`
            : `Above ${formatBDT(threshold, locale)}`,
        sub: locale === "bn" ? "যোগ্য অর্ডারে" : "On qualifying orders",
      });
    }

    if (delivery.delivery_zones?.length > 0) {
      const divisions = delivery.delivery_zones.map((z) => z.division);
      const n = divisions.length;
      cells.push({
        icon: <IcMapPin size={16} />,
        color: "stone",
        label: locale === "bn" ? "ডেলিভারি এরিয়া" : "Service area",
        value:
          locale === "bn" ? `${n} এলাকা` : `${n} ${n === 1 ? "zone" : "zones"}`,
        sub: divisions.slice(0, 3).join(", ") + (n > 3 ? "…" : ""),
      });
    }
  }

  // Responsive grid — single row on lg, 2x2 on md/sm, stacked on mobile
  const lgCols =
    cells.length === 4
      ? "lg:grid-cols-4"
      : cells.length === 3
        ? "lg:grid-cols-3"
        : cells.length === 2
          ? "lg:grid-cols-2"
          : "lg:grid-cols-1";

  return (
    <>
      {/* ── STORE HERO ───────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200">
        {/* Banner */}
        <div className="relative h-[200px] sm:h-[280px] md:h-[340px] overflow-hidden bg-stone-200">
          {shop.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.banner_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, hsl(${hue},28%,80%) 0%, hsl(${hue},20%,65%) 100%)`,
              }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* Profile */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-7">
          <div className="flex items-end gap-4 sm:gap-6 -mt-10 sm:-mt-14 md:-mt-16 relative z-10">
            {/* Logo */}
            <div
              className="w-20 h-20 sm:w-28 sm:h-28 md:w-[130px] md:h-[130px] rounded-2xl border-[3px] sm:border-4 border-white shadow-lg flex-shrink-0 overflow-hidden grid place-items-center font-bold select-none"
              style={{
                background: `hsl(${hue},32%,88%)`,
                color: `hsl(${hue},32%,30%)`,
                fontSize: "clamp(1.75rem, 6vw, 3rem)",
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
                shop.name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Name + actions */}
            <div className="flex-1 min-w-0 pb-1 flex flex-col sm:flex-row sm:items-end gap-2.5 sm:gap-4">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-stone-900 tracking-tight leading-tight">
                  {shop.name}
                </h1>
                {/* Facebook-style verified badge */}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="flex-shrink-0 mt-0.5"
                  aria-label="Verified seller"
                >
                  <circle cx="12" cy="12" r="12" fill="#1877F2" />
                  <path
                    d="M7 12.5L10.5 16L17 9"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="flex items-center gap-2 sm:ml-auto flex-shrink-0">
                <Button variant="neutral" size="md" onClick={share}>
                  {copied ? (
                    <>
                      <IcCheck size={15} className="text-teal-600" />
                      {locale === "bn" ? "কপি হয়েছে" : "Copied"}
                    </>
                  ) : (
                    <>
                      <IcCopy size={15} />
                      {locale === "bn" ? "শেয়ার" : "Share"}
                    </>
                  )}
                </Button>
                <Button
                  variant={following ? "neutral" : "primary"}
                  size="md"
                  onClick={toggleFollow}
                >
                  <IcHeart size={15} />
                  {following
                    ? locale === "bn"
                      ? "ফলো করছেন"
                      : "Following"
                    : locale === "bn"
                      ? "ফলো করুন"
                      : "Follow"}
                </Button>
              </div>
            </div>
          </div>

          {/* Description + meta line — clean, single block under the avatar row */}
          <div className="mt-5 max-w-[680px]">
            {shop.description?.trim() && (
              <p className="text-stone-600 text-[14.5px] leading-relaxed">
                {shop.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-stone-500">
              <span>
                <strong className="font-semibold text-stone-800">
                  {productCount}
                </strong>{" "}
                {locale === "bn"
                  ? "পণ্য"
                  : productCount === 1
                    ? "product"
                    : "products"}
              </span>
              {shop.rating_count > 0 && (
                <>
                  <span className="text-stone-300">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <StarRating value={shop.rating_average} size={13} />
                    <strong className="font-semibold text-stone-800">
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
                  <span className="text-stone-300">·</span>
                  <a
                    href={`tel:${shop.contact_phone}`}
                    className="inline-flex items-center gap-1.5 text-stone-600 hover:text-teal-600 transition-colors font-medium"
                  >
                    <IcPhone size={13} className="text-stone-400" />
                    {shop.contact_phone}
                  </a>
                </>
              )}
            </div>
            <div className="mt-3">
              <ReportShopButton shopSlug={shop.slug} shopName={shop.name} />
            </div>
          </div>
        </div>
      </div>

      {/* ── TRUST STRIP — sits between hero and products ─────── */}
      {cells.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6">
          <div className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${lgCols}`}>
            {cells.map((c, i) => (
              <div
                key={i}
                className="bg-white border border-stone-200 rounded-xl shadow-sm px-4 py-3.5 flex items-start gap-3 hover:border-stone-300 transition-colors"
              >
                <IconBadge color={c.color}>{c.icon}</IconBadge>
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-stone-400">
                    {c.label}
                  </div>
                  <div className="text-[14px] font-semibold text-stone-900 mt-0.5 leading-tight truncate">
                    {c.value}
                  </div>
                  {c.sub && (
                    <div className="text-[12px] text-stone-500 mt-0.5 truncate">
                      {c.sub}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Advance payment instructions — appears as a focused note */}
          {delivery?.advance_payment_required &&
            delivery.advance_payment_instructions?.trim() && (
              <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                <IcInfo
                  size={18}
                  className="text-amber-600 flex-shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-amber-700">
                    {locale === "bn"
                      ? "পেমেন্ট নির্দেশনা"
                      : "Payment instructions"}
                  </div>
                  <div className="text-[14px] text-amber-800 leading-relaxed mt-0.5 whitespace-pre-line">
                    {delivery.advance_payment_instructions}
                  </div>
                </div>
              </div>
            )}
        </div>
      )}

      {/* ── POPULAR THIS WEEK ────────────────────────────────── */}
      {popularProducts.length > 0 && !cat && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
          <SectionHeader>
            {locale === "bn" ? "এই সপ্তাহে জনপ্রিয়" : "Popular this week"}
          </SectionHeader>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {popularProducts.map((p) => {
              const { effective, original } = applyDiscount(
                p.price_bdt,
                p.discount_type,
                p.discount_value,
              );
              return (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={effective}
                  oldPrice={original}
                  imageUrl={p.images?.[0]?.url}
                  locale={locale}
                  href={`/s/${shop.slug}/p/${p.id}`}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── ALL PRODUCTS ─────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 pb-16">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
          <SectionHeader>
            {locale === "bn" ? "সব পণ্য" : "All products"}
          </SectionHeader>
          {categories.length > 0 && (
            <div className="flex gap-1.5 overflow-auto no-scrollbar">
              <CatPill active={!cat} onClick={() => setCat("")}>
                {locale === "bn" ? "সব" : "All"}
              </CatPill>
              {categories.map((c) => (
                <CatPill
                  key={c.id}
                  active={cat === c.id}
                  onClick={() => setCat(c.id)}
                >
                  {c.name}
                </CatPill>
              ))}
            </div>
          )}
        </div>

        {prodsQ.isLoading ? (
          <div className="text-stone-400 text-sm py-12 text-center">
            Loading…
          </div>
        ) : products.length === 0 ? (
          <div className="text-stone-400 text-sm py-20 text-center">
            {locale === "bn" ? "কোনো পণ্য নেই" : "No products yet."}
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {products.map((p) => {
              const { effective, original } = applyDiscount(
                p.price_bdt,
                p.discount_type,
                p.discount_value,
              );
              return (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={effective}
                  oldPrice={original}
                  imageUrl={p.images?.[0]?.url}
                  locale={locale}
                  href={`/s/${shop.slug}/p/${p.id}`}
                  onAdd={() =>
                    cart.addItem(
                      {
                        productId: p.id,
                        name: p.name,
                        price: String(effective),
                        image: p.images?.[0]?.url ?? null,
                        stock: p.stock,
                      },
                      1,
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── REVIEWS ─────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-16">
        <ReviewList
          slug={shop.slug}
          title={locale === "bn" ? "ক্রেতার রিভিউ" : "Customer reviews"}
        />
      </section>
    </>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

type IconColor = "teal" | "stone" | "green" | "amber";

interface TrustCell {
  icon: ReactNode;
  color: IconColor;
  label: string;
  value: string;
  sub?: string;
}

const iconBg: Record<IconColor, string> = {
  teal: "bg-teal-50  text-teal-600",
  stone: "bg-stone-100 text-stone-600",
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
};

function IconBadge({
  color,
  children,
}: {
  color: IconColor;
  children: ReactNode;
}) {
  return (
    <div
      className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${iconBg[color]}`}
    >
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[15px] font-semibold text-stone-900">{children}</h2>
  );
}

function CatPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? "bg-teal-600 text-white"
          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
      }`}
    >
      {children}
    </button>
  );
}
