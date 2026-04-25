'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { IcStore, IcTrash, IcX } from '@/components/icons/Icons';
import { formatBDT } from '@/lib/format';
import type { PublicShop } from '@/lib/shopApi';
import type { useCart } from '@/hooks/useCart';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  open: boolean;
  onClose: () => void;
  cart: ReturnType<typeof useCart>;
  shop: PublicShop;
}

export function CartDrawer({ open, onClose, cart, shop }: Props) {
  const { locale } = useI18n();
  const { items, updateQuantity, removeItem, subtotal } = cart;
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-stone-900/40 transition-opacity duration-200 z-50 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 w-full max-w-[400px] bg-white z-50 shadow-drawer flex flex-col transition-transform duration-300 ease-standard ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-3">
          <h2 className="text-lg font-semibold flex-1">
            {locale === 'bn' ? 'আপনার কার্ট' : 'Your cart'}
            <span className="text-stone-500 font-normal ml-2">({items.length})</span>
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-stone-700 hover:bg-stone-100 rounded-md">
            <IcX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-stone-900 font-medium mb-1">
                {locale === 'bn' ? 'আপনার কার্ট খালি' : 'Your cart is empty'}
              </div>
              <div className="text-stone-500 text-sm">{locale === 'bn' ? 'ব্রাউজিং চালিয়ে যান' : 'Keep browsing'}</div>
            </div>
          ) : (
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2 text-stone-700 text-sm">
                <IcStore size={14} className="text-stone-500" />
                <span className="font-medium">{shop.name}</span>
              </div>
              {items.map((it) => (
                <div key={it.productId} className="flex gap-3 mb-3">
                  <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-stone-100">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">{it.name}</div>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <div className="flex items-center bg-stone-100 rounded-md h-7">
                        <button
                          onClick={() => updateQuantity(it.productId, it.quantity - 1)}
                          className="w-7 h-7 text-stone-700 hover:text-stone-900"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <div className="min-w-[20px] text-center text-sm font-medium">{it.quantity}</div>
                        <button
                          onClick={() => updateQuantity(it.productId, it.quantity + 1)}
                          className="w-7 h-7 text-stone-700 hover:text-stone-900"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-sm font-semibold ml-auto">
                        {formatBDT(parseFloat(it.price) * it.quantity, locale)}
                      </div>
                      <button
                        onClick={() => removeItem(it.productId)}
                        aria-label="Remove"
                        className="text-stone-400 hover:text-stone-700 p-1"
                      >
                        <IcTrash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-stone-200 bg-stone-50">
            <div className="flex justify-between mb-3">
              <span className="text-stone-500 text-sm">{locale === 'bn' ? 'উপমোট' : 'Subtotal'}</span>
              <span className="font-semibold text-lg">{formatBDT(subtotal, locale)}</span>
            </div>
            <Link href={`/s/${shop.slug}/checkout`} onClick={onClose}>
              <Button variant="primary" className="w-full">
                {locale === 'bn' ? 'চেকআউট' : 'Checkout'}
              </Button>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
