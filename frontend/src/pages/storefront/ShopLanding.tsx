import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories } from '@/lib/storefrontApi';
import type { PublicProduct, PublicCategory } from '@/lib/storefrontApi';
import { getPopularProducts } from '@/lib/analyticsApi';
import type { PopularProduct } from '@/lib/analyticsApi';
import { useStorefront } from './StorefrontLayout';

export default function ShopLanding() {
  const { shop, slug, cart } = useStorefront();

  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProducts(slug, {
        q: search || undefined,
        category_id: activeCategory || undefined,
        page,
        page_size: 20,
      });
      setProducts(res.data);
      setTotalPages(res.pagination.total_pages);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [slug, search, activeCategory, page]);

  useEffect(() => {
    getCategories(slug).then(setCategories).catch(() => {});
    getPopularProducts(slug).then(setPopularProducts).catch(() => {});
  }, [slug]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, activeCategory]);

  return (
    <div>
      {/* Banner */}
      {shop.banner_url && (
        <div className="w-full h-40 sm:h-56 bg-gray-200 overflow-hidden">
          <img
            src={shop.banner_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Shop info */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-1">
          {shop.logo_url && (
            <img
              src={shop.logo_url}
              alt=""
              className="h-12 w-12 rounded-full object-cover border-2 border-white shadow -mt-8"
            />
          )}
          <h1 className="text-xl font-bold text-gray-800">{shop.name}</h1>
        </div>
        {shop.description && (
          <p className="text-sm text-gray-600 mt-1">{shop.description}</p>
        )}
      </div>

      {/* Popular / Trending Products */}
      {popularProducts.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <div className="bg-gradient-to-r from-primary-50 to-indigo-50 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-primary-800 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" />
              </svg>
              Trending Products
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {popularProducts.slice(0, 5).map((pp) => (
                <Link
                  key={pp.product_id}
                  to={`/s/${slug}/p/${pp.product_id}`}
                  className="flex-shrink-0 bg-white rounded-lg px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="text-sm font-medium text-gray-800 whitespace-nowrap">{pp.product_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pp.total_quantity} sold</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="max-w-5xl mx-auto px-4 pb-3">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pb-4">
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
                key={cat.id}
                onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product grid */}
      <div className="max-w-5xl mx-auto px-4 pb-8">
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
            <p className="text-sm mt-1">Check back soon for new products!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {products.map((product) => {
                const thumb = product.images?.[0]?.url;
                const outOfStock = product.stock <= 0;
                return (
                  <Link
                    key={product.id}
                    to={`/s/${slug}/p/${product.id}`}
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
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Quick-add buttons (below grid for mobile UX) */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {products.map((product) => {
                const outOfStock = product.stock <= 0;
                return (
                  <button
                    key={`add-${product.id}`}
                    disabled={outOfStock}
                    onClick={(e) => {
                      e.preventDefault();
                      cart.addItem({
                        productId: product.id,
                        name: product.name,
                        price: product.price_bdt,
                        image: product.images?.[0]?.url || null,
                        stock: product.stock,
                      });
                    }}
                    className="text-xs py-1.5 rounded-lg font-medium transition-colors bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {outOfStock ? 'Out of Stock' : '+ Add to Cart'}
                  </button>
                );
              })}
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
      </div>
    </div>
  );
}
