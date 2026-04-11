import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import {
  createShop,
  checkSlug,
  uploadLogo,
  uploadBanner,
  updateMyShop,
  updateDeliverySettings,
} from '@/lib/shopApi';

export default function ShopSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Step 2
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Step 3
  const [codEnabled, setCodEnabled] = useState(true);
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [freeThreshold, setFreeThreshold] = useState('');
  const [advanceRequired, setAdvanceRequired] = useState(false);
  const [advanceInstructions, setAdvanceInstructions] = useState('');
  const [deliveryAreas, setDeliveryAreas] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-suggest slug from name
  useEffect(() => {
    const suggested = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    setSlug(suggested);
  }, [name]);

  // Debounced slug availability check
  useEffect(() => {
    if (slug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkSlug(slug);
        setSlugAvailable(result.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [slug]);

  const handleFileChange = useCallback(
    (setter: (f: File | null) => void, previewSetter: (s: string | null) => void) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setter(file);
        if (file) {
          const reader = new FileReader();
          reader.onload = () => previewSetter(reader.result as string);
          reader.readAsDataURL(file);
        } else {
          previewSetter(null);
        }
      },
    [],
  );

  const addArea = () => {
    const area = areaInput.trim();
    if (area && !deliveryAreas.includes(area)) {
      setDeliveryAreas([...deliveryAreas, area]);
    }
    setAreaInput('');
  };

  const removeArea = (area: string) => {
    setDeliveryAreas(deliveryAreas.filter((a) => a !== area));
  };

  const handleStep1 = async () => {
    setError('');
    if (!name.trim()) {
      setError(t('setup.name_required'));
      return;
    }
    if (slug.length < 3 || slugAvailable === false) {
      setError(t('setup.slug_invalid'));
      return;
    }

    setSubmitting(true);
    try {
      await createShop({ name: name.trim(), slug, description, contact_phone: contactPhone });
      await queryClient.invalidateQueries({ queryKey: ['my-shop'] });
      setStep(2);
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

  const handleStep2 = async () => {
    setError('');
    setSubmitting(true);
    try {
      if (logoFile) await uploadLogo(logoFile);
      if (bannerFile) await uploadBanner(bannerFile);
      if (description || contactPhone) {
        await updateMyShop({ description, contact_phone: contactPhone });
      }
      await queryClient.invalidateQueries({ queryKey: ['my-shop'] });
      setStep(3);
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

  const handleStep3 = async () => {
    setError('');
    setSubmitting(true);
    try {
      await updateDeliverySettings({
        cod_enabled: codEnabled,
        delivery_charge: deliveryCharge || '0',
        free_delivery_threshold: freeThreshold || null,
        advance_payment_required: advanceRequired,
        advance_payment_instructions: advanceInstructions,
        delivery_areas: deliveryAreas,
      });
      await queryClient.invalidateQueries({ queryKey: ['my-shop'] });
      navigate('/dashboard');
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('setup.title')}</h2>
      <p className="text-gray-500 mb-6">{t('setup.subtitle')}</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div className={`w-12 h-0.5 ${step > s ? 'bg-primary-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Step 1: Name & Slug */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">{t('setup.step1_title')}</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.shop_name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder={t('setup.shop_name_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.slug')}</label>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-1">/s/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            {slug.length >= 3 && (
              <p className={`text-xs mt-1 ${slugChecking ? 'text-gray-400' : slugAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {slugChecking ? t('setup.checking_slug') : slugAvailable ? t('setup.slug_available') : t('setup.slug_taken')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder={t('setup.description_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.contact_phone')}</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="+8801XXXXXXXXX"
            />
          </div>

          <button
            onClick={handleStep1}
            disabled={submitting || !name.trim() || slug.length < 3 || slugAvailable === false}
            className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('setup.creating') : t('setup.next')}
          </button>
        </div>
      )}

      {/* Step 2: Logo, Banner, Branding */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">{t('setup.step2_title')}</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.logo')}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange(setLogoFile, setLogoPreview)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {logoPreview && (
              <img src={logoPreview} alt="Logo preview" className="mt-2 w-20 h-20 rounded-lg object-cover border" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.banner')}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange(setBannerFile, setBannerPreview)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {bannerPreview && (
              <img src={bannerPreview} alt="Banner preview" className="mt-2 w-full h-32 rounded-lg object-cover border" />
            )}
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

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('setup.skip')}
            </button>
            <button
              onClick={handleStep2}
              disabled={submitting}
              className="flex-1 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t('setup.uploading') : t('setup.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Delivery Settings */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">{t('setup.step3_title')}</h3>
          <p className="text-sm text-gray-500">{t('setup.step3_hint')}</p>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t('setup.cod_enabled')}</label>
            <button
              type="button"
              onClick={() => setCodEnabled(!codEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                codEnabled ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${codEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.delivery_charge')}</label>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">৳</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.free_delivery_threshold')}</label>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">৳</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(e.target.value)}
                placeholder={t('setup.optional')}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t('setup.advance_payment')}</label>
            <button
              type="button"
              onClick={() => setAdvanceRequired(!advanceRequired)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                advanceRequired ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${advanceRequired ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {advanceRequired && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.advance_instructions')}</label>
              <textarea
                value={advanceInstructions}
                onChange={(e) => setAdvanceInstructions(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder={t('setup.advance_instructions_placeholder')}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.delivery_areas')}</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addArea();
                  }
                }}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder={t('setup.area_placeholder')}
              />
              <button
                type="button"
                onClick={addArea}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('setup.add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {deliveryAreas.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700"
                >
                  {area}
                  <button
                    type="button"
                    onClick={() => removeArea(area)}
                    className="text-primary-500 hover:text-primary-800"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('setup.skip')}
            </button>
            <button
              onClick={handleStep3}
              disabled={submitting}
              className="flex-1 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t('setup.saving') : t('setup.finish')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
