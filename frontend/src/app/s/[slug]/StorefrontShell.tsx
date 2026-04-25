'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { IcCart, IcCheck, IcCopy, IcHeart } from '@/components/icons/Icons';
import { CartDrawer } from './CartDrawer';
import { useCart } from '@/hooks/useCart';
import { hueFromString } from '@/components/ui/ProductImage';
import type { PublicShop, PublicDeliverySettings } from '@/lib/shopApi';
import { useI18n } from '@/hooks/useI18n';

interface StorefrontCtx {
  shop: PublicShop;
  delivery: PublicDeliverySettings | null;
  openCart: () => void;
  cart: ReturnType<typeof useCart>;
}
const Ctx = createContext<StorefrontCtx | null>(null);

export function useStorefront() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStorefront must be used inside StorefrontShell');
  return ctx;
}

export function StorefrontShell({
  shop,
  delivery,
  children,
}: {
  shop: PublicShop;
  delivery: PublicDeliverySettings | null;
  children: ReactNode;
}) {
  const [cartOpen, setCartOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(false);
  const cart = useCart(shop.slug);
  const { locale } = useI18n();
  const hue = hueFromString(shop.id);

  // Follow state is persisted client-side for now — backend follow API isn't
  // implemented yet (see to_implement_api.md).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setFollowing(localStorage.getItem(`follow:${shop.slug}`) === '1');
  }, [shop.slug]);

  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    if (typeof window !== 'undefined') {
      if (next) localStorage.setItem(`follow:${shop.slug}`, '1');
      else localStorage.removeItem(`follow:${shop.slug}`);
    }
  };

  const share = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/s/${shop.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: shop.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // user cancelled share — ignore
    }
  };

  // Subtitle: show description (truncated) or fall back to slug.
  const subtitle = shop.description?.trim() || `/${shop.slug}`;

  return (
    <Ctx.Provider value={{ shop, delivery, openCart: () => setCartOpen(true), cart }}>
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
        <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/s/${shop.slug}`} className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-[10px] grid place-items-center font-bold text-lg overflow-hidden flex-shrink-0"
              style={{ background: `hsl(${hue},32%,88%)`, color: `hsl(${hue},32%,30%)` }}
            >
              {shop.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
              ) : (
                shop.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base text-stone-900 flex items-center gap-2">
                <span className="truncate">{shop.name}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                  <IcCheck size={10} /> Verified
                </span>
              </div>
              <div className="text-xs text-stone-500 truncate">{subtitle}</div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <Button variant="secondary" size="sm" onClick={share} className="hidden sm:inline-flex">
              {copied ? (
                <><IcCheck size={14} /> {locale === 'bn' ? 'কপি হয়েছে' : 'Copied'}</>
              ) : (
                <><IcCopy size={14} /> {locale === 'bn' ? 'শেয়ার' : 'Share'}</>
              )}
            </Button>
            <Button variant={following ? 'secondary' : 'primary'} size="sm" onClick={toggleFollow}>
              <IcHeart size={14} /> {following ? (locale === 'bn' ? 'ফলো করছেন' : 'Following') : locale === 'bn' ? 'ফলো করুন' : 'Follow'}
            </Button>
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-md text-stone-700 hover:bg-stone-100"
              aria-label="Open cart"
            >
              <IcCart size={22} />
              {cart.totalQuantity > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-coral-500 text-white rounded-full text-[10px] font-semibold grid place-items-center leading-none">
                  {cart.totalQuantity}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        shop={shop}
      />
    </Ctx.Provider>
  );
}
