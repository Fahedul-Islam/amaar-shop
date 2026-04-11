import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import { getDeliverySettings, updateDeliverySettings, type DeliverySettings } from '@/lib/shopApi';

export default function DeliverySettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<DeliverySettings>({
    queryKey: ['delivery-settings'],
    queryFn: getDeliverySettings,
  });

  const [codEnabled, setCodEnabled] = useState(true);
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [freeThreshold, setFreeThreshold] = useState('');
  const [advanceRequired, setAdvanceRequired] = useState(false);
  const [advanceInstructions, setAdvanceInstructions] = useState('');
  const [deliveryAreas, setDeliveryAreas] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Populate form when data loads
  useEffect(() => {
    if (settings) {
      setCodEnabled(settings.cod_enabled);
      setDeliveryCharge(settings.delivery_charge);
      setFreeThreshold(settings.free_delivery_threshold ?? '');
      setAdvanceRequired(settings.advance_payment_required);
      setAdvanceInstructions(settings.advance_payment_instructions);
      setDeliveryAreas(settings.delivery_areas);
    }
  }, [settings]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
      await queryClient.invalidateQueries({ queryKey: ['delivery-settings'] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('shop.delivery_settings')}</h2>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">{t('setup.cod_enabled')}</label>
            <p className="text-xs text-gray-400">{t('delivery.cod_hint')}</p>
          </div>
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
          <p className="text-xs text-gray-400 mb-1">{t('delivery.threshold_hint')}</p>
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
          <div>
            <label className="text-sm font-medium text-gray-700">{t('setup.advance_payment')}</label>
            <p className="text-xs text-gray-400">{t('delivery.advance_hint')}</p>
          </div>
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
                <button type="button" onClick={() => removeArea(area)} className="text-primary-500 hover:text-primary-800">
                  x
                </button>
              </span>
            ))}
          </div>
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
