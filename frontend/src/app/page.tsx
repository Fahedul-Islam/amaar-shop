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
  const isFiltering = Boolean(initialQ || initialCat);

  return (
    <>
      <MarketplaceHeader defaultQuery={initialQ} revealSearchOnScroll />

      {/* Hero — search-first, single CTA */}
      <section className="px-4 pt-14 pb-12 bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-[760px] mx-auto text-center">
          <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-tight leading-[1.15] text-stone-900 mb-3.5">
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
            className="flex gap-2 bg-white border border-stone-200 rounded-xl p-1.5 max-w-[520px] mx-auto shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-all focus-within:border-teal-400 focus-within:shadow-[0_4px_16px_rgba(13,148,136,0.10)]"
          >
            <div className="flex items-center pl-2.5 pr-1 text-stone-500">
              <IcSearch size={18} />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={locale === 'bn' ? 'কী খুঁজছেন?' : 'What are you looking for?'}
              className="flex-1 border-0 outline-none text-base bg-transparent text-stone-900 placeholder-stone-400 px-1 min-w-0"
              aria-label={locale === 'bn' ? 'খুঁজুন' : 'Search'}
            />
            <Button type="submit" variant="primary" className="px-5">
              {locale === 'bn' ? 'খুঁজুন' : 'Search'}
            </Button>
          </form>
          {categories.length > 0 && (
            <div className="mt-[18px] text-[13px] text-stone-500">
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
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="text-[20px] font-semibold tracking-tight">
              {locale === 'bn' ? 'ফিচার্ড দোকান' : 'Featured shops'}
            </h2>
            <Link href="/shops" className="text-teal-600 text-[13px] font-medium hover:text-teal-700">
              {locale === 'bn' ? 'সব দেখুন' : 'See all'} →
            </Link>
          </div>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {shops.map((s) => {
              const hue = hueFromString(s.id);
              const hasRating = (s.rating_count ?? 0) > 0;
              const subtitle = s.description?.trim() ||
                (locale === 'bn' ? 'নতুন দোকান' : 'New shop');
              return (
                <Link key={s.id} href={`/s/${s.slug}`}>
                  <Card className="!rounded-xl p-3.5 flex gap-3 items-center cursor-pointer transition-shadow duration-200 ease-standard hover:shadow-sm">
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
                      <div className="text-xs text-stone-500 truncate mt-0.5">
                        {hasRating ? (
                          <>
                            <span className="inline-flex items-center gap-0.5 align-middle">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth={1.6} strokeLinejoin="round" className="-mt-px">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              <span className="font-medium text-stone-700">{s.rating_average.toFixed(1)}</span>
                              <span className="text-stone-400">({s.rating_count})</span>
                            </span>
                            {s.description?.trim() ? <span> · {s.description}</span> : null}
                          </>
                        ) : (
                          subtitle
                        )}
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

      {/* Products with category pills above */}
      <section id="products" className="px-4 pt-8 pb-12 max-w-container mx-auto scroll-mt-20">
        <div className="flex items-baseline justify-between mb-3.5 gap-3 flex-wrap">
          <h2 className="text-[20px] font-semibold tracking-tight">
            {initialQ
              ? `${locale === 'bn' ? 'খুঁজছেন' : 'Results for'} "${initialQ}"`
              : initialCat
              ? initialCat
              : locale === 'bn'
              ? 'নতুন পণ্য'
              : 'New this week'}
          </h2>
          {isFiltering && (
            <button
              onClick={() => router.push('/')}
              className="text-[13px] text-stone-500 hover:text-teal-700 font-medium"
            >
              {locale === 'bn' ? 'ফিল্টার সাফ' : 'Clear filters'}
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-auto no-scrollbar pb-1 mb-4">
            <CategoryPill active={!cat} onClick={() => selectCategory('')}>
              {locale === 'bn' ? 'সব' : 'All'}
            </CategoryPill>
            {categories.map((c) => (
              <CategoryPill key={c} active={cat === c} onClick={() => selectCategory(c)}>
                {c}
              </CategoryPill>
            ))}
          </div>
        )}

        {productsQuery.isLoading ? (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="aspect-square bg-stone-100 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 bg-stone-100 rounded animate-pulse" />
                  <div className="h-3 bg-stone-100 rounded animate-pulse w-2/3" />
                  <div className="h-4 bg-stone-100 rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-stone-200 rounded-xl">
            <div className="text-stone-700 font-medium mb-1">
              {locale === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
            </div>
            <div className="text-stone-500 text-sm mb-4">
              {locale === 'bn' ? 'অন্য কিছু খুঁজে দেখুন বা ফিল্টার সাফ করুন।' : 'Try a different search or clear your filters.'}
            </div>
            {isFiltering && (
              <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
                {locale === 'bn' ? 'ফিল্টার সাফ' : 'Clear filters'}
              </Button>
            )}
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
                  rating={p.rating_average}
                  ratingCount={p.rating_count}
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
      className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}
