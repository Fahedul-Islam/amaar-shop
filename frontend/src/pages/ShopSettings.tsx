import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useShop } from '@/hooks/useShop';
import { ApiRequestError } from '@/lib/api';
import { updateMyShop, uploadLogo, uploadBanner } from '@/lib/shopApi';

export default function ShopSettings() {
  const { t } = useTranslation();
  const { shop } = useShop();
  const queryClient = useQueryClient();

  const [name, setName] = useState(shop?.name ?? '');
  const [description, setDescription] = useState(shop?.description ?? '');
  const [contactPhone, setContactPhone] = useState(shop?.contact_phone ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  if (!shop) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError(t('setup.name_required'));
      return;
    }

    setSubmitting(true);
    try {
      await updateMyShop({ name: name.trim(), description, contact_phone: contactPhone });
      await queryClient.invalidateQueries({ queryKey: ['my-shop'] });
      setSuccess(t('settings.saved'));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(t(`errors.${err.code}`, { defaultValue: err.message }));
      } else {
        setError(t('errors.unknown'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = useCallback(
    async (type: 'logo' | 'banner', file: File) => {
      const setUploading = type === 'logo' ? setLogoUploading : setBannerUploading;
      setUploading(true);
      setError('');
      try {
        if (type === 'logo') {
          await uploadLogo(file);
        } else {
          await uploadBanner(file);
        }
        await queryClient.invalidateQueries({ queryKey: ['my-shop'] });
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(t(`errors.${err.code}`, { defaultValue: err.message }));
        } else {
          setError(t('errors.unknown'));
        }
      } finally {
        setUploading(false);
      }
    },
    [queryClient, t],
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('settings.branding_title')}</h2>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Logo & Banner uploads */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('setup.logo')}</label>
            {shop.logo_url && (
              <img src={shop.logo_url} alt="Logo" className="w-20 h-20 rounded-lg object-cover border mb-2" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload('logo', file);
              }}
              disabled={logoUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {logoUploading && <p className="text-xs text-gray-400 mt-1">{t('setup.uploading')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('setup.banner')}</label>
            {shop.banner_url && (
              <img src={shop.banner_url} alt="Banner" className="w-full h-20 rounded-lg object-cover border mb-2" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload('banner', file);
              }}
              disabled={bannerUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {bannerUploading && <p className="text-xs text-gray-400 mt-1">{t('setup.uploading')}</p>}
          </div>
        </div>
      </div>

      {/* Branding form */}
      <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.shop_name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.slug')}</label>
          <p className="text-sm text-gray-500">/s/{shop.slug}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('settings.slug_readonly')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.contact_phone')}</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? t('setup.saving') : t('settings.save')}
        </button>
      </form>
    </div>
  );
}
