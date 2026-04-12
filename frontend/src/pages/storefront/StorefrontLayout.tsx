import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, useParams, Link } from 'react-router-dom';
import { getShop } from '@/lib/storefrontApi';
import type { PublicShop } from '@/lib/shopApi';
import { useCart } from '@/hooks/useCart';
import CartDrawer from './CartDrawer';

interface StorefrontCtx {
  shop: PublicShop;
  slug: string;
  cart: ReturnType<typeof useCart>;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
}

const Ctx = createContext<StorefrontCtx | null>(null);

export function useStorefront() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStorefront must be used inside StorefrontLayout');
  return ctx;
}

export default function StorefrontLayout() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const cart = useCart(slug!);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getShop(slug!)
      .then(setShop)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Shop not found</h1>
          <p className="text-gray-500">This shop may no longer be available.</p>
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ shop, slug: slug!, cart, cartOpen, setCartOpen }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to={`/s/${slug}`} className="flex items-center gap-2 min-w-0">
              {shop.logo_url && (
                <img
                  src={shop.logo_url}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                />
              )}
              <span className="text-lg font-bold text-primary-700 truncate">{shop.name}</span>
            </Link>

            {/* Cart button */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-gray-600 hover:text-primary-700 transition-colors"
              aria-label="Cart"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {cart.totalQuantity > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                  {cart.totalQuantity}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>

        {/* Floating cart button (mobile) */}
        {cart.totalQuantity > 0 && !cartOpen && (
          <button
            onClick={() => setCartOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-primary-600 text-white rounded-full p-4 shadow-lg hover:bg-primary-700 transition-colors md:hidden"
            aria-label="Open cart"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span className="absolute -top-1 -right-1 bg-white text-primary-700 text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {cart.totalQuantity}
            </span>
          </button>
        )}

        {/* Cart drawer */}
        <CartDrawer />
      </div>
    </Ctx.Provider>
  );
}
