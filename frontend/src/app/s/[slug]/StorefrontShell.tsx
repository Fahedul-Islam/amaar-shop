'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { IcArrowLeft, IcCart } from '@/components/icons/Icons';
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
  following: boolean;
  toggleFollow: () => void;
  share: () => Promise<void>;
  copied: boolean;
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

  return (
    <Ctx.Provider value={{ shop, delivery, openCart: () => setCartOpen(true), cart, following, toggleFollow, share, copied }}>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          {/* Mobile: back arrow */}
          <Link
            href="/"
            className="sm:hidden p-1.5 -ml-1 rounded-md text-stone-500 hover:text-teal-600 hover:bg-stone-100 transition-colors flex-shrink-0"
            aria-label={locale === 'bn' ? 'মার্কেটপ্লেসে ফিরুন' : 'Back to Marketplace'}
          >
            <IcArrowLeft size={18} />
          </Link>
          {/* Desktop: AmaarShop logo */}
          <Link
            href="/"
            className="hidden sm:flex items-center flex-shrink-0 hover:opacity-80 transition-opacity"
            title={locale === 'bn' ? 'মার্কেটপ্লেসে ফিরুন' : 'Back to Marketplace'}
          >
            <Logo size={22} href={null} />
          </Link>
          <span className="hidden sm:block w-px h-5 bg-stone-200 flex-shrink-0" />

          {/* Shop mini-avatar + name */}
          <Link href={`/s/${shop.slug}`} className="flex items-center gap-2.5 min-w-0 group">
            <div
              className="w-8 h-8 rounded-lg grid place-items-center font-bold text-sm overflow-hidden flex-shrink-0"
              style={{ background: `hsl(${hue},32%,88%)`, color: `hsl(${hue},32%,30%)` }}
            >
              {shop.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
              ) : (
                shop.name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="font-semibold text-sm text-stone-900 truncate hidden sm:block group-hover:text-teal-700 transition-colors">
              {shop.name}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-md text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Open cart"
            >
              <IcCart size={20} />
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
