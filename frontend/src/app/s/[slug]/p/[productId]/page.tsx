'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useStorefront } from '../../StorefrontShell';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { ProductImage, hueFromString } from '@/components/ui/ProductImage';
import { IcArrowLeft, IcCart, IcCheck, IcPackage, IcTruck } from '@/components/icons/Icons';
import { getProduct } from '@/lib/storefrontApi';
import { applyDiscount, formatBDT } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

export default function ProductDetailPage() {
  const { shop, cart, openCart } = useStorefront();
  const { locale } = useI18n();
  const params = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['sf-product', params.slug, params.productId],
    queryFn: () => getProduct(params.slug, params.productId),
  });

  if (isLoading) {
    return <div className="max-w-[1100px] mx-auto px-4 py-8 text-stone-500">Loading…</div>;
  }
  if (!product) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 py-10 text-center">
        <div className="text-lg font-semibold mb-1">Product not found</div>
        <Link href={`/s/${shop.slug}`} className="text-teal-600 text-sm">← Back to shop</Link>
      </div>
    );
  }

  const hue = hueFromString(product.id);
  const { effective, original } = applyDiscount(product.price_bdt, product.discount_type, product.discount_value);
  const outOfStock = product.stock <= 0;

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

  return (
    <section className="max-w-[1100px] mx-auto px-4 py-5 pb-12">
      <Link href={`/s/${shop.slug}`} className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-3.5 hover:text-teal-700">
        <IcArrowLeft size={14} /> {locale === 'bn' ? 'দোকানে ফিরুন' : 'Back to shop'}
      </Link>

      <div className="grid gap-9 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <div className="rounded-lg overflow-hidden border border-stone-200 mb-2.5">
            {product.images?.[imgIdx] ? (
              <ProductImage src={product.images[imgIdx].url} alt={product.name} ratio="1/1" />
            ) : (
              <ProductImage hue={hue} ratio="1/1" />
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImgIdx(i)}
                  className={`w-16 h-16 rounded-md overflow-hidden p-0 bg-white ${
                    imgIdx === i ? 'border-2 border-teal-600' : 'border border-stone-200'
                  }`}
                >
                  <ProductImage src={img.url} alt="" ratio="1/1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-stone-500 mb-1.5">{shop.name}</div>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-3">{product.name}</h1>
          <div className="mb-5">
            <Price amount={effective} old={original} locale={locale} size="lg" />
          </div>
          {(product.delivery_charge_dhaka || product.delivery_charge_outside) && (
            <div className="text-xs text-stone-500 mb-5 grid gap-0.5">
              {product.delivery_charge_dhaka && (
                <div>
                  {locale === 'bn' ? 'ঢাকা' : 'Dhaka'}: {formatBDT(product.delivery_charge_dhaka, locale)}
                </div>
              )}
              {product.delivery_charge_outside && (
                <div>
                  {locale === 'bn' ? 'ঢাকার বাইরে' : 'Outside Dhaka'}: {formatBDT(product.delivery_charge_outside, locale)}
                </div>
              )}
            </div>
          )}

          {product.description && (
            <p className="text-[15px] text-stone-600 leading-relaxed mb-6">{product.description}</p>
          )}

          <div className="flex gap-3 mb-5 items-center">
            <div className="flex items-center bg-stone-100 rounded-md h-10">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-9 h-10 text-lg text-stone-700 hover:text-stone-900"
                aria-label="Decrease"
              >
                −
              </button>
              <div className="min-w-[28px] text-center font-medium">{qty}</div>
              <button
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                className="w-9 h-10 text-lg text-stone-700 hover:text-stone-900"
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <Button variant="accent" className="flex-1" onClick={addToCart} disabled={outOfStock}>
              <IcCart size={16} /> {outOfStock ? (locale === 'bn' ? 'স্টক নেই' : 'Out of stock') : locale === 'bn' ? 'কার্টে যোগ করুন' : 'Add to cart'}
            </Button>
            <Button variant="secondary" onClick={buyNow} disabled={outOfStock}>
              {locale === 'bn' ? 'এখনই কিনুন' : 'Buy now'}
            </Button>
          </div>

          <div className="border-t border-stone-200 pt-4 grid gap-2.5 text-[13px] text-stone-600">
            <div className="flex items-center gap-2">
              <IcTruck size={14} className="text-teal-600 flex-shrink-0" />
              {locale === 'bn' ? 'ক্যাশ অন ডেলিভারি, ১–২ দিনে শিপিং' : 'Ships in 1–2 days · cash on delivery'}
            </div>
            <div className="flex items-center gap-2">
              <IcPackage size={14} className="text-teal-600 flex-shrink-0" />
              {outOfStock
                ? locale === 'bn' ? 'স্টক নেই' : 'Out of stock'
                : product.stock < 5
                ? locale === 'bn' ? `মাত্র ${product.stock}টি বাকি` : `Only ${product.stock} left`
                : locale === 'bn' ? `${product.stock}টি স্টকে আছে` : `${product.stock} in stock`}
            </div>
            <div className="flex items-center gap-2">
              <IcCheck size={14} className="text-teal-600 flex-shrink-0" />
              {locale === 'bn' ? 'যাচাইকৃত বিক্রেতা' : 'Verified seller'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
