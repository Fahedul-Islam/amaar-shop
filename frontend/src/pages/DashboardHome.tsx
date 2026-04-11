import { useTranslation } from 'react-i18next';
import { useShop } from '@/hooks/useShop';

export default function DashboardHome() {
  const { t } = useTranslation();
  const { shop } = useShop();

  if (!shop) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('dashboard')}</h2>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-start gap-6">
          {shop.logo_url && (
            <img
              src={shop.logo_url}
              alt={shop.name}
              className="w-20 h-20 rounded-lg object-cover border"
            />
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{shop.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">/{shop.slug}</p>
            {shop.description && (
              <p className="text-gray-600 mt-2">{shop.description}</p>
            )}
            {shop.contact_phone && (
              <p className="text-sm text-gray-500 mt-1">{shop.contact_phone}</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-gray-500 text-sm mt-6">
        {t('dashboard_home_hint')}
      </p>
    </div>
  );
}
