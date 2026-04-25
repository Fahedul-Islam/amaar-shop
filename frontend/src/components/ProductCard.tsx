'use client';
import Link from 'next/link';
import { Price } from '@/components/ui/Price';
import { ProductImage, hueFromString } from '@/components/ui/ProductImage';
import { IcPlus } from '@/components/icons/Icons';
import type { ReactNode } from 'react';

interface Props {
  id: string;
  name: string;
  price: string | number;
  oldPrice?: string | number | null;
  imageUrl?: string | null;
  shopName?: string;
  locale?: 'en' | 'bn';
  href?: string;
  onAdd?: () => void;
  badge?: ReactNode;
}

export function ProductCard({ id, name, price, oldPrice, imageUrl, shopName, locale = 'en', href, onAdd, badge }: Props) {
  const hue = hueFromString(id);
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  const oldNum = oldPrice != null ? (typeof oldPrice === 'string' ? parseFloat(oldPrice) : oldPrice) : null;
  const discount = oldNum && oldNum > priceNum ? Math.round((1 - priceNum / oldNum) * 100) : 0;

  const Content = (
    <div className="group bg-white border border-stone-200 rounded-lg overflow-hidden relative transition-shadow duration-200 ease-standard hover:shadow-sm">
      {badge ?? (discount > 0 && (
        <span className="absolute top-2 right-2 z-10 bg-coral-50 text-coral-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
          −{discount}%
        </span>
      ))}
      <ProductImage src={imageUrl} alt={name} hue={hue} ratio="1/1" />
      <div className="p-3">
        <div className="font-medium text-sm text-stone-900 leading-snug line-clamp-2 min-h-[2.4em]">{name}</div>
        {shopName && <div className="text-xs text-stone-500 mt-0.5">{shopName}</div>}
        <div className="flex items-center justify-between mt-2">
          <Price amount={priceNum} old={oldNum} locale={locale} />
          {onAdd && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAdd();
              }}
              aria-label="Add to cart"
              className="w-8 h-8 rounded-md bg-stone-100 text-stone-700 hover:bg-coral-500 hover:text-white grid place-items-center transition-colors duration-150 ease-standard"
            >
              <IcPlus size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{Content}</Link> : Content;
}
