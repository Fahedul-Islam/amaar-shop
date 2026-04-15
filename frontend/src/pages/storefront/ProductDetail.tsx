import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduct, getProducts } from '@/lib/storefrontApi';
import type { PublicProduct } from '@/lib/storefrontApi';
import { useStorefront } from './StorefrontLayout';

function calcDiscountedPrice(price: string, discountType: string | null, discountValue: string | null): number | null {
  if (!discountType || !discountValue) return null;
  const p = parseFloat(price);
  const v = parseFloat(discountValue);
  if (isNaN(p) || isNaN(v) || v <= 0) return null;
  if (discountType === 'percentage') {
    return Math.round(p - (p * v) / 100);
  }
  if (discountType === 'flat') {
    const result = p - v;
    return result > 0 ? Math.round(result) : null;
  }
  return null;
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const { slug, cart, setCartOpen } = useStorefront();

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getProduct(slug, productId!)
      .then((p) => {
        setProduct(p);
        setSelectedImage(0);
        setQuantity(1);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug, productId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Product not found</h2>
        <Link to={`/s/${slug}`} className="text-primary-600 hover:underline text-sm">
          Back to shop
        </Link>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;
  const images = product.images || [];
  const currentImage = images[selectedImage]?.url;

  const handleAddToCart = () => {
    cart.addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price_bdt,
        image: images[0]?.url || null,
        stock: product.stock,
      },
      quantity,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link to={`/s/${slug}`} className="hover:text-primary-600">
          Shop
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-800">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gallery */}
        <div>
          {/* Main image */}
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
            {currentImage ? (
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                    i === selectedImage ? 'border-primary-600' : 'border-transparent'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{product.name}</h1>
          {(() => {
            const discounted = calcDiscountedPrice(product.price_bdt, product.discount_type, product.discount_value);
            if (discounted !== null) {
              return (
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary-700">{'\u09F3'}{discounted}</span>
                    <span className="text-lg text-gray-400 line-through">{'\u09F3'}{product.price_bdt}</span>
                    <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      {product.discount_type === 'percentage'
                        ? `-${product.discount_value}%`
                        : `-৳${product.discount_value}`}
                    </span>
                  </div>
                </div>
              );
            }
            return (
              <p className="text-2xl font-bold text-primary-700 mb-4">
                {'\u09F3'}{product.price_bdt}
              </p>
            );
          })()}

          {/* Delivery charges */}
          {(product.delivery_charge_dhaka || product.delivery_charge_outside) && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium text-gray-700 mb-1.5">Delivery Charges</p>
              <div className="space-y-1 text-gray-600">
                {product.delivery_charge_dhaka && (
                  <div className="flex justify-between">
                    <span>Inside Dhaka</span>
                    <span className="font-medium">{'\u09F3'}{product.delivery_charge_dhaka}</span>
                  </div>
                )}
                {product.delivery_charge_outside && (
                  <div className="flex justify-between">
                    <span>Outside Dhaka</span>
                    <span className="font-medium">{'\u09F3'}{product.delivery_charge_outside}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {product.description && (
            <p className="text-gray-600 mb-6 whitespace-pre-line">{product.description}</p>
          )}

          {outOfStock ? (
            <div className="bg-gray-100 text-gray-600 text-center py-3 rounded-lg font-medium">
              Out of Stock
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quantity selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-lg font-medium w-10 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={quantity >= product.stock}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-500 ml-2">{product.stock} available</span>
                </div>
              </div>

              {/* Add to cart */}
              <button
                onClick={handleAddToCart}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                {added ? 'Added!' : 'Add to Cart'}
              </button>

              {/* View cart shortcut */}
              {cart.totalQuantity > 0 && (
                <button
                  onClick={() => setCartOpen(true)}
                  className="w-full text-center text-sm text-primary-600 hover:underline"
                >
                  View Cart ({cart.totalQuantity} items)
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Similar Products */}
      <SimilarProducts slug={slug} product={product} />
    </div>
  );
}

// ─── Similar Products ───

function SimilarProducts({ slug, product }: { slug: string; product: PublicProduct }) {
  const [similar, setSimilar] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params: { category_id?: string; page_size?: number } = { page_size: 10 };
    if (product.category_id) {
      params.category_id = product.category_id;
    }
    getProducts(slug, params)
      .then((res) => {
        setSimilar(res.data.filter((p) => p.id !== product.id).slice(0, 8));
      })
      .catch(() => setSimilar([]))
      .finally(() => setLoading(false));
  }, [slug, product.id, product.category_id]);

  if (loading || similar.length === 0) return null;

  return (
    <div className="mt-10 border-t pt-8">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Similar Products</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {similar.map((p) => {
          const thumb = p.images?.[0]?.url;
          const discounted = calcDiscountedPrice(p.price_bdt, p.discount_type, p.discount_value);
          const outOfStock = p.stock <= 0;
          return (
            <Link
              key={p.id}
              to={`/s/${slug}/p/${p.id}`}
              className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden relative">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={p.name}
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
                {discounted !== null && (
                  <span className="absolute top-1.5 left-1.5 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {p.discount_type === 'percentage' ? `-${p.discount_value}%` : `-৳${p.discount_value}`}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                {discounted !== null ? (
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-sm font-bold text-primary-700">{'\u09F3'}{discounted}</span>
                    <span className="text-xs text-gray-400 line-through">{'\u09F3'}{p.price_bdt}</span>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-primary-700 mt-0.5">{'\u09F3'}{p.price_bdt}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
