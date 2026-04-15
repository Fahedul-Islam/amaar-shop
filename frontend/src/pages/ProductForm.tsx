import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProduct,
  updateProduct,
  getProduct,
  listCategories,
  uploadProductImage,
  deleteProductImage,
  type Product,
  type ProductImage,
} from '@/lib/productApi';
import { ApiRequestError } from '@/lib/api';

export default function ProductForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id!),
    enabled: isEdit,
  });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceBDT, setPriceBDT] = useState('');
  const [stock, setStock] = useState('0');
  const [categoryID, setCategoryID] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [discountType, setDiscountType] = useState<string>('');
  const [discountValue, setDiscountValue] = useState('');
  const [deliveryChargeDhaka, setDeliveryChargeDhaka] = useState('');
  const [deliveryChargeOutside, setDeliveryChargeOutside] = useState('');
  const [images, setImages] = useState<ProductImage[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const p = productQuery.data;
    if (!p) return;
    setName(p.name);
    setDescription(p.description);
    setPriceBDT(p.price_bdt);
    setStock(String(p.stock));
    setCategoryID(p.category_id ?? '');
    setIsActive(p.is_active);
    setDiscountType(p.discount_type ?? '');
    setDiscountValue(p.discount_value ?? '');
    setDeliveryChargeDhaka(p.delivery_charge_dhaka ?? '');
    setDeliveryChargeOutside(p.delivery_charge_outside ?? '');
    setImages(p.images);
  }, [productQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description,
        price_bdt: priceBDT.trim(),
        stock: Number(stock) || 0,
        category_id: categoryID || null,
        is_active: isActive,
        discount_type: discountType || null,
        discount_value: discountValue || null,
        delivery_charge_dhaka: deliveryChargeDhaka || null,
        delivery_charge_outside: deliveryChargeOutside || null,
      };
      if (isEdit && id) {
        return updateProduct(id, payload);
      }
      return createProduct(payload);
    },
    onSuccess: async (p: Product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', p.id] });
      if (!isEdit) {
        navigate(`/dashboard/products/${p.id}`, { replace: true });
      } else {
        setError('');
      }
    },
    onError: (err) => setError(translateError(err, t)),
  });

  const handleUpload = async (file: File) => {
    if (!isEdit || !id) {
      setError(t('products.save_before_images'));
      return;
    }
    setError('');
    setUploading(true);
    try {
      const img = await uploadProductImage(id, file);
      setImages((prev) => [...prev, img]);
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      setError(translateError(err, t));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageID: string) => {
    if (!id) return;
    try {
      await deleteProductImage(id, imageID);
      setImages((prev) => prev.filter((img) => img.id !== imageID));
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      setError(translateError(err, t));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(t('errors.validation_error'));
      return;
    }
    saveMutation.mutate();
  };

  if (isEdit && productQuery.isLoading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {isEdit ? t('products.edit') : t('products.new')}
        </h2>
        <button
          type="button"
          onClick={() => navigate('/dashboard/products')}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t('products.cancel')}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('products.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('products.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.price')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={priceBDT}
              onChange={(e) => setPriceBDT(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('products.stock')}
            </label>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('products.category')}
          </label>
          <select
            value={categoryID}
            onChange={(e) => setCategoryID(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{t('products.no_category')}</option>
            {categoriesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Discount */}
        <div className="border-t pt-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Discount</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => {
                  setDiscountType(e.target.value);
                  if (!e.target.value) setDiscountValue('');
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">No discount</option>
                <option value="flat">Flat (&#2547;)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            {discountType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Value {discountType === 'percentage' ? '(%)' : '(৳)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Delivery Charges */}
        <div className="border-t pt-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Delivery Charges</h3>
          <p className="text-xs text-gray-400 mb-3">Leave empty to use shop-level delivery settings.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inside Dhaka (&#2547;)</label>
              <input
                type="text"
                inputMode="decimal"
                value={deliveryChargeDhaka}
                onChange={(e) => setDeliveryChargeDhaka(e.target.value)}
                placeholder="e.g. 100"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outside Dhaka (&#2547;)</label>
              <input
                type="text"
                inputMode="decimal"
                value={deliveryChargeOutside}
                onChange={(e) => setDeliveryChargeOutside(e.target.value)}
                placeholder="e.g. 150"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          {t('products.active')}
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saveMutation.isPending
              ? isEdit
                ? t('products.saving')
                : t('products.creating')
              : isEdit
                ? t('products.save')
                : t('products.create')}
          </button>
        </div>
      </form>

      {isEdit && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{t('products.images')}</h3>
            <span className="text-xs text-gray-500">{t('products.max_images')}</span>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {images.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.url}
                    alt=""
                    className="w-full aspect-square object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute top-1 right-1 rounded-full bg-red-600 text-white w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="delete"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                handleUpload(f);
                e.target.value = '';
              }
            }}
            disabled={uploading || images.length >= 8}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
          {uploading && <p className="text-xs text-gray-400 mt-1">{t('setup.uploading')}</p>}
        </div>
      )}
    </div>
  );
}

function translateError(err: unknown, t: (key: string, opts?: object) => string): string {
  if (err instanceof ApiRequestError) {
    return t(`errors.${err.code}`, { defaultValue: err.message });
  }
  return t('errors.unknown');
}
