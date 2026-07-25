'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { IcArrowLeft, IcPlus, IcTrash } from '@/components/icons/Icons';
import { ProductImage } from '@/components/ui/ProductImage';
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  deleteProductImage,
  getProduct,
  listCategories,
  updateProduct,
  uploadProductImage,
  type ProductImage as ProductImageT,
} from '@/lib/productApi';
import { getDeliverySettings } from '@/lib/shopApi';
import { ApiRequestError } from '@/lib/api';

interface Props {
  mode: 'new' | 'edit';
  productId?: string;
}

export default function ProductFormPage({ mode, productId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = mode === 'edit' && !!productId;

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId!),
    enabled: isEdit,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['cats'],
    queryFn: listCategories,
  });

  const { data: delivery } = useQuery({
    queryKey: ['delivery'],
    queryFn: getDeliverySettings,
  });
  const deliveryConfigured = delivery?.is_configured ?? true;
  const blockNew = !isEdit && delivery !== undefined && !deliveryConfigured;

  // If a seller bookmarks /products/new and hits it without configuring delivery,
  // route them to the settings page so they can't get stuck on a blocked form.
  useEffect(() => {
    if (blockNew) router.replace('/dashboard/settings/delivery');
  }, [blockNew, router]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [discountType, setDiscountType] = useState<'' | 'percentage' | 'flat'>('');
  const [discountValue, setDiscountValue] = useState('');
  const [chargeDhaka, setChargeDhaka] = useState('');
  const [chargeOutside, setChargeOutside] = useState('');
  const [images, setImages] = useState<ProductImageT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description);
      setPrice(product.price_bdt);
      setCostPrice(product.cost_price_bdt ?? '');
      setStock(String(product.stock));
      setCategoryId(product.category_id ?? '');
      setIsActive(product.is_active);
      setDiscountType((product.discount_type as 'percentage' | 'flat' | null) ?? '');
      setDiscountValue(product.discount_value ?? '');
      setChargeDhaka(product.delivery_charge_dhaka ?? '');
      setChargeOutside(product.delivery_charge_outside ?? '');
      setImages(product.images ?? []);
    }
  }, [product]);

  const uploadFile = async (file: File, forId: string) => {
    try {
      const img = await uploadProductImage(forId, file);
      setImages((prev) => [...prev, img]);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Upload failed');
    }
  };

  const removeImage = async (imageId: string) => {
    if (!productId) return;
    await deleteProductImage(productId, imageId);
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockNew) {
      setError('Please configure your delivery settings before adding products.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      price_bdt: price,
      // Blank clears the stored cost (null), rather than saving 0.
      cost_price_bdt: costPrice.trim() === '' ? null : costPrice.trim(),
      stock: parseInt(stock, 10) || 0,
      category_id: categoryId || null,
      is_active: isActive,
      discount_type: discountType || null,
      discount_value: discountType ? discountValue || null : null,
      delivery_charge_dhaka: chargeDhaka || null,
      delivery_charge_outside: chargeOutside || null,
    };
    try {
      if (!isEdit) {
        const created = await createProduct(payload);
        qc.invalidateQueries({ queryKey: ['prods'] });
        router.push(`/dashboard/products/${created.id}`);
      } else if (productId) {
        await updateProduct(productId, payload);
        qc.invalidateQueries({ queryKey: ['prods'] });
        qc.invalidateQueries({ queryKey: ['product', productId] });
        router.push('/dashboard/products');
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!productId) return;
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      await deleteProduct(productId);
      qc.invalidateQueries({ queryKey: ['prods'] });
      router.push('/dashboard/products');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Delete failed');
    }
  };

  const archive = async () => {
    if (!productId) return;
    try {
      await archiveProduct(productId);
      qc.invalidateQueries({ queryKey: ['prods'] });
      qc.invalidateQueries({ queryKey: ['product', productId] });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Archive failed');
    }
  };

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-5xl">
      <Link href="/dashboard/products" className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-3.5">
        <IcArrowLeft size={14} /> Back to products
      </Link>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit product' : 'Add product'}</h1>
        <div className="flex gap-2">
          {isEdit && product && !product.is_archived && (
            <Button variant="ghost" onClick={archive}>Archive</Button>
          )}
          {isEdit && product?.is_archived && (
            <span className="text-xs px-2 py-1 rounded bg-stone-100 text-stone-600 self-center">Archived</span>
          )}
          {isEdit && <Button variant="ghost" onClick={del}>Delete</Button>}
          <Button variant="primary" onClick={save} disabled={saving || blockNew}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      <form onSubmit={save} className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          {isEdit && (
            <Card className="p-5" hover={false}>
              <h3 className="text-sm font-semibold mb-3">Photos</h3>
              <div className="grid grid-cols-4 gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <div className="aspect-square rounded-md overflow-hidden">
                      <ProductImage src={img.url} ratio="1/1" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-sm text-stone-700 hover:text-red-600"
                      aria-label="Remove image"
                    >
                      <IcTrash size={14} />
                    </button>
                  </div>
                ))}
                {images.length < 8 && (
                  <label className="aspect-square border-2 border-dashed border-stone-300 rounded-md grid place-items-center text-stone-400 cursor-pointer hover:bg-stone-50">
                    <IcPlus size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && productId) uploadFile(f, productId);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </Card>
          )}

          <Card className="p-5 grid gap-3.5" hover={false}>
            <Input name="name" label="Product name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Textarea name="description" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="grid gap-3.5 md:grid-cols-2">
              <Input name="price" label="Price (৳)" value={price} onChange={(e) => setPrice(e.target.value)} required />
              <Input name="stock" label="Stock" value={stock} onChange={(e) => setStock(e.target.value)} required />
            </div>
            <div className="grid gap-3.5 md:grid-cols-2">
              <div>
                <Input
                  name="cost_price"
                  label="Buying price (৳)"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="Optional"
                />
                <p className="text-xs text-stone-500 mt-1">
                  What you pay your supplier. Only you see this — it powers your profit &amp; ad reports.
                </p>
              </div>
              <MarginPreview price={price} cost={costPrice} />
            </div>
          </Card>

          <Card className="p-5 grid gap-3.5" hover={false}>
            <h3 className="text-sm font-semibold">Discount (optional)</h3>
            <div className="grid gap-3.5 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as '' | 'percentage' | 'flat')}
                  className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white"
                >
                  <option value="">No discount</option>
                  <option value="percentage">Percentage off</option>
                  <option value="flat">Flat amount off (৳)</option>
                </select>
              </div>
              {discountType && (
                <Input
                  name="discount_value"
                  label={discountType === 'percentage' ? 'Percent (e.g. 10)' : 'Amount (৳)'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              )}
            </div>
          </Card>

          <Card className="p-5" hover={false}>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-semibold">Delivery</h3>
              <Link
                href="/dashboard/settings/delivery"
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                Edit
              </Link>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              All products use your shop&apos;s delivery settings.
            </p>
            {delivery ? (
              <ul className="text-sm grid gap-1.5">
                {(delivery.delivery_zones ?? []).map((z) => (
                  <li
                    key={`${z.division}-${z.id ?? ''}`}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-stone-50 border border-stone-100"
                  >
                    <span className="text-stone-700">{z.division}</span>
                    <span className="font-semibold text-stone-900">
                      ৳{Number(z.delivery_charge).toFixed(0)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-stone-50 border border-stone-100">
                  <span className="text-stone-600">All other areas</span>
                  <span className="font-semibold text-stone-900">
                    {parseFloat(delivery.delivery_charge) > 0
                      ? `৳${Number(delivery.delivery_charge).toFixed(0)}`
                      : 'Free'}
                  </span>
                </li>
                {delivery.free_delivery_threshold && (
                  <li className="text-xs text-stone-500 px-1 pt-1">
                    Free delivery on orders above ৳
                    {Number(delivery.free_delivery_threshold).toFixed(0)}
                  </li>
                )}
                {delivery.advance_payment_required && (
                  <li className="text-xs text-stone-500 px-1">
                    Advance payment required at checkout
                  </li>
                )}
              </ul>
            ) : (
              <div className="text-xs text-stone-400">Loading…</div>
            )}
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="p-5" hover={false}>
            <h3 className="text-sm font-semibold mb-3">Category</h3>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Link href="/dashboard/categories" className="text-xs text-teal-600 mt-2 inline-block">
              Manage categories →
            </Link>
          </Card>
          <Card className="p-5" hover={false}>
            <h3 className="text-sm font-semibold mb-3">Status</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-teal-600"
              />
              Active (visible in storefront)
            </label>
          </Card>
          {!isEdit && (
            <Card className="p-5 text-sm text-stone-500" hover={false}>
              Save the product first, then upload images.
            </Card>
          )}
        </div>
      </form>
    </div>
  );
}

// MarginPreview gives instant feedback while typing: profit per unit and
// margin %, plus the break-even ROAS the seller's ads must beat at that margin.
function MarginPreview({ price, cost }: { price: string; cost: string }) {
  const p = parseFloat(price);
  const c = parseFloat(cost);
  const valid = Number.isFinite(p) && Number.isFinite(c) && p > 0 && c >= 0;
  if (!valid) {
    return (
      <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3.5 py-3 text-xs text-stone-500 self-start">
        Add a buying price to see your profit per unit and the ad ROAS you need
        to break even.
      </div>
    );
  }
  const profit = p - c;
  const marginPct = (profit / p) * 100;
  const loss = profit <= 0;
  return (
    <div
      className={`rounded-lg border px-3.5 py-3 self-start ${
        loss
          ? 'border-red-200 bg-red-50'
          : 'border-teal-100 bg-teal-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-stone-600">Profit / unit</span>
        <span
          className={`text-lg font-bold ${loss ? 'text-red-700' : 'text-teal-800'}`}
        >
          ৳{profit.toFixed(2)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <span className="text-xs font-medium text-stone-600">Margin</span>
        <span className={`text-xs font-semibold ${loss ? 'text-red-700' : 'text-teal-800'}`}>
          {marginPct.toFixed(1)}%
        </span>
      </div>
      {loss ? (
        <p className="text-[11px] text-red-700 mt-1.5 leading-snug">
          You lose money on every sale at this price.
        </p>
      ) : (
        <p className="text-[11px] text-teal-800 mt-1.5 leading-snug">
          Ads must return at least{' '}
          <strong>{(p / profit).toFixed(2)}x</strong> (break-even ROAS).
        </p>
      )}
    </div>
  );
}
