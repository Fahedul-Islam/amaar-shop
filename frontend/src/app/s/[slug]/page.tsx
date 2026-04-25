'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStorefront } from './StorefrontShell';
import { ProductCard } from '@/components/ProductCard';
import { getCategories, getProducts } from '@/lib/storefrontApi';
import { getPopularProducts } from '@/lib/analyticsApi';
import { applyDiscount } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';
import { IcCheck } from '@/components/icons/Icons';

export default function ShopLandingPage() {
  const { shop, delivery, cart } = useStorefront();
  const { locale } = useI18n();
  const [cat, setCat] = useState<string>('');

  const catsQ = useQuery({
    queryKey: ['sf-cats', shop.slug],
    queryFn: () => getCategories(shop.slug),
  });

  const prodsQ = useQuery({
    queryKey: ['sf-prods', shop.slug, cat],
    queryFn: () => getProducts(shop.slug, { category_id: cat || undefined, page_size: 24 }),
  });

  const popularQ = useQuery({
    queryKey: ['sf-popular', shop.slug],
    queryFn: () => getPopularProducts(shop.slug),
  });

  const categories = catsQ.data ?? [];
  const products = prodsQ.data?.data ?? [];
  const popular = popularQ.data ?? [];
  const popularProducts = popular
    .map((pp) => products.find((p) => p.id === pp.product_id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 4);

  // Stats row: only numeric figures we have today. Rating/reviews/sold/followers
  // are documented as backend gaps in to_implement_api.md.
  const productCount = prodsQ.data?.pagination?.total ?? products.length;

  return (
    <>
      {/* Shop hero — design: kicker + tagline-style headline + paragraph + stats row */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-[1100px] mx-auto px-4 pt-7 pb-6">
          <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_280px] items-center">
            <div>
              <div className="text-xs font-medium text-teal-700 uppercase tracking-[0.06em] mb-2 inline-flex items-center gap-1.5">
                <IcCheck size={12} /> Verified seller
              </div>
              <h1 className="text-[28px] font-bold tracking-tight leading-[1.2] mb-2.5 text-stone-900">
                {shop.description?.trim() || shop.name}
              </h1>
              {shop.description?.trim() ? (
                <p className="text-stone-500 text-[15px] leading-relaxed max-w-[560px]">
                  {shop.name}{shop.contact_phone ? ` · ${shop.contact_phone}` : ''}
                </p>
              ) : (
                <p className="text-stone-500 text-[15px] leading-relaxed max-w-[560px]">
                  {locale === 'bn' ? 'AmaarShop-এ একটি দোকান।' : 'A shop on AmaarShop.'}
                </p>
              )}

              <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 mt-4 text-[13px] text-stone-700">
                <div>
                  <span className="font-semibold text-stone-900">{productCount}</span>{' '}
                  <span className="text-stone-500">
                    {productCount === 1
                      ? locale === 'bn' ? 'পণ্য' : 'product'
                      : locale === 'bn' ? 'পণ্য' : 'products'}
                  </span>
                </div>
                {delivery && (
                  <>
                    <div>
                      <span className="font-semibold text-stone-900">
                        {delivery.cod_enabled ? (locale === 'bn' ? 'COD' : 'COD') : (locale === 'bn' ? 'অগ্রিম' : 'Advance')}
                      </span>{' '}
                      <span className="text-stone-500">
                        {delivery.cod_enabled
                          ? locale === 'bn' ? 'ক্যাশ অন ডেলিভারি' : 'cash on delivery'
                          : locale === 'bn' ? 'প্রিপেইড' : 'prepaid'}
                      </span>
                    </div>
                    {delivery.delivery_areas?.length > 0 && (
                      <div>
                        <span className="font-semibold text-stone-900">
                          {delivery.delivery_areas.length}
                        </span>{' '}
                        <span className="text-stone-500">
                          {locale === 'bn' ? 'এলাকা' : delivery.delivery_areas.length === 1 ? 'zone' : 'zones'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {shop.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.banner_url}
                alt={shop.name}
                className="aspect-[4/3] rounded-xl object-cover w-full"
              />
            ) : (
              <div
                className="aspect-[4/3] rounded-xl grid place-items-center text-xs"
                style={{
                  background: 'linear-gradient(135deg, hsl(180,24%,84%), hsl(180,18%,75%))',
                  color: 'hsl(180,24%,40%)',
                }}
              >
                {locale === 'bn' ? 'দোকানের ব্যানার' : 'shop banner'}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Popular products */}
      {popularProducts.length > 0 && !cat && (
        <section className="max-w-[1100px] mx-auto px-4 pt-6">
          <h2 className="text-base font-semibold tracking-tight mb-3">
            {locale === 'bn' ? 'এই সপ্তাহে জনপ্রিয়' : 'Popular this week'}
          </h2>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {popularProducts.map((p) => {
              const { effective, original } = applyDiscount(p.price_bdt, p.discount_type, p.discount_value);
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

      {/* Categories + grid */}
      <section className="max-w-[1100px] mx-auto px-4 py-6 pb-12">
        {categories.length > 0 && (
          <div className="flex gap-1.5 mb-5 overflow-auto no-scrollbar">
            <CatPill active={!cat} onClick={() => setCat('')}>
              {locale === 'bn' ? 'সব' : 'All'}
            </CatPill>
            {categories.map((c) => (
              <CatPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name}
              </CatPill>
            ))}
          </div>
        )}

        {prodsQ.isLoading ? (
          <div className="text-stone-500 text-sm">Loading…</div>
        ) : products.length === 0 ? (
          <div className="text-stone-500 text-sm py-10 text-center">
            {locale === 'bn' ? 'কোনো পণ্য নেই' : 'No products yet.'}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
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
    </>
  );
}

function CatPill({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
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
