import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '@/components/LanguageToggle';
import {
  getMarketplaceProducts,
  getMarketplaceShops,
  getMarketplaceCategories,
  lookupOrdersByPhone,
} from '@/lib/marketplaceApi';
import type { MarketplaceProduct, MarketplaceShop } from '@/lib/marketplaceApi';
import type { Order } from '@/lib/storefrontApi';
import { useAuth } from '@/hooks/useAuth';

// ─── Main Marketplace Homepage ───

export default function MarketplaceHome() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'shops' | 'orders'>('products');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary-700">
            {t('app_name')}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            {!authLoading && (
              user ? (
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {t('dashboard')}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Seller Login
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{t('app_name')}</h1>
          <p className="text-primary-100 text-base sm:text-lg mb-6">
            Discover products from trusted local shops
          </p>

          {/* Tab switcher */}
          <div className="inline-flex bg-white/20 rounded-lg p-1 mb-4">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'products'
                  ? 'bg-white text-primary-700'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab('shops')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'shops'
                  ? 'bg-white text-primary-700'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Shops
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'bg-white text-primary-700'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              My Orders
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'products' && <ProductsSection />}
        {activeTab === 'shops' && <ShopsSection />}
        {activeTab === 'orders' && <OrderLookupSection />}
      </div>
    </div>
  );
}

// ─── Products Section ───

function ProductsSection() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Debounce search input.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMarketplaceProducts({
        q: debouncedSearch || undefined,
        category: activeCategory || undefined,
        page,
        page_size: 20,
      });
      setProducts(res.data);
      setTotalPages(res.pagination.total_pages);
      setTotal(res.pagination.total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeCategory, page]);

  useEffect(() => {
    getMarketplaceCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeCategory]);

  return (
    <>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products across all shops..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !activeCategory
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result count */}
      {!loading && (
        <p className="text-sm text-gray-500 mb-3">
          {total} product{total !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Product grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm mt-1">Try a different search or category.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Product Card ───

function ProductCard({ product }: { product: MarketplaceProduct }) {
  const thumb = product.images?.[0]?.url;
  const outOfStock = product.stock <= 0;

  return (
    <Link
      to={`/s/${product.shop_slug}/p/${product.id}`}
      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-100 overflow-hidden relative">
        {thumb ? (
          <img
            src={thumb}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-semibold px-2 py-1 rounded">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
        <p className="text-sm font-bold text-primary-700 mt-0.5">
          {'\u09F3'}{product.price_bdt}
        </p>
        {/* Shop badge */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {product.shop_logo_url ? (
            <img
              src={product.shop_logo_url}
              alt=""
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-[8px] font-bold text-gray-500">
                {product.shop_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs text-gray-500 truncate">{product.shop_name}</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Shops Section ───

function ShopsSection() {
  const [shops, setShops] = useState<MarketplaceShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMarketplaceShops({
        q: debouncedSearch || undefined,
        page,
        page_size: 20,
      });
      setShops(res.data);
      setTotalPages(res.pagination.total_pages);
      setTotal(res.pagination.total);
    } catch {
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  return (
    <>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search for shops..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {!loading && (
        <p className="text-sm text-gray-500 mb-3">
          {total} shop{total !== 1 ? 's' : ''} found
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : shops.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-lg font-medium">No shops found</p>
          <p className="text-sm mt-1">Try a different search term.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Shop Card ───

function ShopCard({ shop }: { shop: MarketplaceShop }) {
  return (
    <Link
      to={`/s/${shop.slug}`}
      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Banner */}
      <div className="h-24 bg-gradient-to-r from-primary-100 to-indigo-100 overflow-hidden">
        {shop.banner_url && (
          <img
            src={shop.banner_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Info */}
      <div className="p-4 -mt-6 relative">
        <div className="flex items-end gap-3 mb-2">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt=""
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow bg-white"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary-100 border-2 border-white shadow flex items-center justify-center">
              <span className="text-lg font-bold text-primary-600">
                {shop.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h3 className="text-base font-semibold text-gray-800 truncate pb-0.5">{shop.name}</h3>
        </div>
        {shop.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{shop.description}</p>
        )}
        <div className="mt-3">
          <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded">
            Visit Shop
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Order Lookup Section ───

function OrderLookupSection() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrders(null);

    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      const result = await lookupOrdersByPhone(trimmed);
      setOrders(result);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <svg className="w-12 h-12 mx-auto mb-3 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <h2 className="text-xl font-bold text-gray-800">Track Your Orders</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter your phone number to see all your orders across any shop
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60"
        >
          {loading ? 'Looking up...' : 'Find My Orders'}
        </button>
      </form>

      {/* Results */}
      {orders !== null && (
        <div className="mt-6">
          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-base font-medium">No orders found</p>
              <p className="text-sm mt-1">No orders are associated with this phone number.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 font-medium">
                {orders.length} order{orders.length !== 1 ? 's' : ''} found
              </p>
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Order Card ───

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="font-mono text-sm font-bold text-primary-700">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(order.created_at).toLocaleDateString('en-BD', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">
            {'\u09F3'}{order.total_bdt}
          </span>
          <StatusBadge status={order.status} />
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Items</p>
            <div className="space-y-1">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.product_name_snapshot}
                    <span className="text-gray-400 ml-1">x{item.quantity}</span>
                  </span>
                  <span className="text-gray-800">{'\u09F3'}{item.line_total_bdt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{'\u09F3'}{order.subtotal_bdt}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delivery</span>
              <span>
                {parseFloat(order.delivery_charge_bdt) === 0 ? 'Free' : `${'\u09F3'}${order.delivery_charge_bdt}`}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1">
              <span>Total</span>
              <span className="text-primary-700">{'\u09F3'}{order.total_bdt}</span>
            </div>
          </div>

          {/* Delivery address */}
          <div className="border-t pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Delivery</p>
            <p className="text-sm text-gray-600">{order.delivery_area}</p>
            <p className="text-sm text-gray-600">{order.delivery_address}</p>
          </div>

          {order.cancelled_reason && (
            <div className="border-t pt-2">
              <p className="text-xs font-semibold text-red-500 uppercase mb-1">Cancellation Reason</p>
              <p className="text-sm text-gray-600">{order.cancelled_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ───

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}
