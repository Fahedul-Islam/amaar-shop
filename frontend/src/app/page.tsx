'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useState, useEffect } from 'react';
import { MarketplaceHeader } from '@/components/MarketplaceHeader';
import { MarketplaceFooter } from '@/components/MarketplaceFooter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProductCard } from '@/components/ProductCard';
import { IcSearch, IcChevR } from '@/components/icons/Icons';
import {
  getMarketplaceProducts,
  getMarketplaceShops,
  getMarketplaceCategories,
} from '@/lib/marketplaceApi';
import { useI18n } from '@/hooks/useI18n';
import { hueFromString } from '@/components/ui/ProductImage';
import { applyDiscount } from '@/lib/format';

export default function MarketplaceHomePage() {
  return (
    <Suspense>
      <MarketplaceHomePageInner />
    </Suspense>
  );
}

function MarketplaceHomePageInner() {
  const { locale } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const initialQ = search.get('q') ?? '';
  const initialCat = search.get('category') ?? '';

  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);

  useEffect(() => {
    setQ(initialQ);
    setCat(initialCat);
  }, [initialQ, initialCat]);

  const productsQuery = useQuery({
    queryKey: ['mp-products', initialQ, initialCat],
    queryFn: () => getMarketplaceProducts({ q: initialQ || undefined, category: initialCat || undefined, page_size: 24 }),
  });
  const shopsQuery = useQuery({
    queryKey: ['mp-shops-featured'],
    queryFn: () => getMarketplaceShops({ page_size: 6 }),
  });
  const categoriesQuery = useQuery({
    queryKey: ['mp-categories'],
    queryFn: () => getMarketplaceCategories(),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (cat) params.set('category', cat);
    router.push(`/?${params.toString()}`);
  };

  const selectCategory = (c: string) => {
    const params = new URLSearchParams();
    if (initialQ) params.set('q', initialQ);
    if (c) params.set('category', c);
    router.push(`/${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const products = productsQuery.data?.data ?? [];
  const shops = shopsQuery.data?.data ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <>
      <MarketplaceHeader defaultQuery={initialQ} revealSearchOnScroll />

      {/* Hero */}
      <section className="py-14 px-4 bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-[760px] mx-auto text-center">
          <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-tight leading-[1.15] text-stone-900 mb-3">
            {locale === 'bn'
              ? 'ছোট ব্যবসায়ীদের জন্য উষ্ণ মার্কেটপ্লেস'
              : 'A warmer marketplace for Bangladesh’s small businesses'}
          </h1>
          <p className="text-base text-stone-600 max-w-[540px] mx-auto mb-7">
            {locale === 'bn'
              ? 'হাতে তৈরি পণ্য, সৎ বিক্রেতা, বিশ্বাসযোগ্য ডেলিভারি।'
              : 'Handmade goods, honest sellers, delivery you can trust.'}
          </p>
          <form
            onSubmit={submit}
            className="flex gap-2 bg-white border border-stone-200 rounded-2xl p-1.5 max-w-[560px] mx-auto shadow-[0_2px_10px_rgba(28,25,23,0.05)] transition-all focus-within:border-teal-400 focus-within:shadow-[0_6px_20px_rgba(13,148,136,0.12)]"
          >
            <div className="flex items-center pl-3 text-stone-400">
              <IcSearch size={20} />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={locale === 'bn' ? 'কী খুঁজছেন?' : 'Search shops, products, categories…'}
              className="flex-1 border-0 outline-none text-base bg-transparent text-stone-900 placeholder-stone-400 px-2 min-w-0"
              aria-label={locale === 'bn' ? 'খুঁজুন' : 'Search'}
            />
            <Button type="submit" variant="primary" className="px-5">
              {locale === 'bn' ? 'খুঁজুন' : 'Search'}
            </Button>
          </form>
          {categories.length > 0 && (
            <div className="mt-5 text-sm text-stone-500">
              {locale === 'bn' ? 'জনপ্রিয়:' : 'Popular:'}{' '}
              {categories.slice(0, 4).map((c, i) => (
                <span key={c}>
                  <button onClick={() => selectCategory(c)} className="text-teal-600 hover:text-teal-700">
                    {c}
                  </button>
                  {i < Math.min(categories.length, 4) - 1 && ' · '}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured shops */}
      {shops.length > 0 && (
        <section className="px-4 pt-8 max-w-container mx-auto">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {locale === 'bn' ? 'ফিচার্ড দোকান' : 'Featured shops'}
            </h2>
            <Link href="/shops" className="text-teal-600 text-sm font-medium hover:text-teal-700">
              {locale === 'bn' ? 'সব দেখুন' : 'See all'} →
            </Link>
          </div>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {shops.map((s) => {
              const hue = hueFromString(s.id);
              return (
                <Link key={s.id} href={`/s/${s.slug}`}>
                  <Card className="p-3.5 flex gap-3 items-center cursor-pointer">
                    <div
                      className="w-12 h-12 flex-shrink-0 rounded-[10px] grid place-items-center font-bold text-base overflow-hidden"
                      style={{ background: `hsl(${hue},30%,88%)`, color: `hsl(${hue},30%,35%)` }}
                    >
                      {s.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        s.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-stone-900 truncate">{s.name}</div>
                      <div className="text-xs text-stone-500 truncate">
                        {s.description?.trim() || (locale === 'bn' ? 'দোকান দেখুন' : 'Browse shop')}
                      </div>
                    </div>
                    <IcChevR size={16} className="text-stone-400 flex-shrink-0" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Category pills */}
      {categories.length > 0 && (
        <section className="px-4 pt-6 max-w-container mx-auto">
          <div className="flex gap-1.5 overflow-auto no-scrollbar pb-2">
            <CategoryPill active={!cat} onClick={() => selectCategory('')}>
              {locale === 'bn' ? 'সব' : 'All'}
            </CategoryPill>
            {categories.map((c) => (
              <CategoryPill key={c} active={cat === c} onClick={() => selectCategory(c)}>
                {c}
              </CategoryPill>
            ))}
          </div>
        </section>
      )}

      {/* Product grid */}
      <section className="px-4 pt-6 pb-12 max-w-container mx-auto">
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          {initialQ
            ? `${locale === 'bn' ? 'খুঁজছেন' : 'Results for'} "${initialQ}"`
            : locale === 'bn'
            ? 'সব পণ্য'
            : 'All products'}
        </h2>
        {productsQuery.isLoading ? (
          <div className="text-stone-500 text-sm">Loading…</div>
        ) : products.length === 0 ? (
          <div className="text-stone-500 text-sm py-10 text-center">
            {locale === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found.'}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {products.map((p) => {
              const { effective, original } = applyDiscount(p.price_bdt, p.discount_type, p.discount_value);
              return (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={effective}
                  oldPrice={original}
                  imageUrl={p.images?.[0]?.url}
                  shopName={p.shop_name}
                  locale={locale}
                  href={`/s/${p.shop_slug}/p/${p.id}`}
                />
              );
            })}
          </div>
        )}
      </section>

      <MarketplaceFooter />
    </>
  );
}

function CategoryPill({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}
