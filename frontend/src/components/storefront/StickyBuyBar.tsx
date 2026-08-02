'use client';
import { useEffect, useState, type RefObject } from 'react';
import { ProductImage, hueFromString } from '@/components/ui/ProductImage';
import { formatBDT } from '@/lib/format';

/**
 * StickyBuyBar keeps the purchase action reachable while the buyer reads down
 * the page.
 *
 * On a phone the inline Buy button scrolls away as soon as the buyer starts
 * doing the thing cash-on-delivery buyers always do — checking reviews, the
 * delivery charge, and whether the seller looks real. Everything that builds
 * that confidence sits *below* the button, so by the time they are convinced
 * the way to act is off-screen. This bar follows them down, so intent can
 * convert at the moment trust is established.
 *
 * Desktop already has a sticky sidebar, so the bar is mobile-only.
 */
export function StickyBuyBar({
  watchRef,
  name,
  imageUrl,
  productId,
  price,
  originalPrice,
  quantity,
  outOfStock,
  onBuyNow,
  onAddToCart,
  locale,
}: {
  /** The inline actions block. The bar appears once this is out of view. */
  watchRef: RefObject<HTMLElement | null>;
  name: string;
  imageUrl: string | null;
  productId: string;
  price: number;
  originalPrice?: number | null;
  quantity: number;
  outOfStock: boolean;
  onBuyNow: () => void;
  onAddToCart: () => void;
  locale: 'en' | 'bn';
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = watchRef.current;
    if (!target) return;

    // Show the bar once the inline buttons have scrolled fully above the
    // viewport — i.e. the buyer can no longer reach them from where they are.
    //
    // Position-based rather than an IntersectionObserver on purpose: an
    // observer only fires when the intersection ratio crosses a threshold, so
    // a fast flick-scroll or an in-page jump that carries the element past the
    // viewport within a single frame never fires a callback, leaving the bar
    // stuck. Measuring position handles every case identically.
    //
    // The read runs straight from the passive listener rather than via
    // requestAnimationFrame: it is a single cheap measurement, and rAF is
    // throttled (or skipped entirely) in background tabs and non-compositing
    // contexts, which would strand the bar in a stale state.
    const update = () => setVisible(target.getBoundingClientRect().bottom < 0);

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [watchRef]);

  const total = price * quantity;
  const discounted = !!originalPrice && originalPrice > price;

  return (
    <div
      aria-hidden={!visible}
      className={`lg:hidden fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
    >
      <div
        className="bg-white/95 backdrop-blur-sm border-t border-stone-200 shadow-[0_-4px_24px_-8px_rgba(28,25,23,0.15)] px-3 pt-2.5 flex items-center gap-3"
        // Sits above the iPhone home indicator instead of under it.
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        <div className="w-11 h-11 rounded-[10px] overflow-hidden flex-shrink-0 bg-stone-100">
          <ProductImage
            src={imageUrl}
            alt={name}
            hue={hueFromString(productId)}
            className="w-full h-full"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-stone-600 truncate leading-tight">
            {name}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[16px] font-bold text-stone-900 leading-tight">
              {formatBDT(total, locale)}
            </span>
            {discounted && (
              <span className="text-[11.5px] text-stone-400 line-through">
                {formatBDT(originalPrice! * quantity, locale)}
              </span>
            )}
            {quantity > 1 && (
              <span className="text-[11px] text-stone-500">×{quantity}</span>
            )}
          </div>
        </div>

        {!outOfStock && (
          <button
            type="button"
            onClick={onAddToCart}
            aria-label={locale === 'bn' ? 'কার্টে যোগ করুন' : 'Add to cart'}
            className="w-[46px] h-[46px] grid place-items-center rounded-[11px] border-[1.5px] border-stone-200 text-stone-700 hover:bg-stone-50 active:scale-95 transition flex-shrink-0"
          >
            <CartIcon />
          </button>
        )}

        <button
          type="button"
          onClick={onBuyNow}
          disabled={outOfStock}
          className="h-[46px] px-4 rounded-[11px] bg-coral-500 hover:bg-coral-600 active:scale-[0.98] disabled:bg-stone-200 disabled:text-stone-500 text-white text-[14.5px] font-bold transition flex-shrink-0"
        >
          {outOfStock
            ? locale === 'bn'
              ? 'স্টক নেই'
              : 'Out of stock'
            : locale === 'bn'
              ? 'অর্ডার করুন'
              : 'Order now'}
        </button>
      </div>
    </div>
  );
}

function CartIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
