import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import LanguageToggle from '@/components/LanguageToggle';

// Dashboard is a placeholder page for authenticated sellers.
// Sub-Prompt 5+ will expand this with shop setup, products, orders, etc.
export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-700">{t('app_name')}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <LanguageToggle />
            <button
              onClick={logout}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('dashboard')}</h2>
        <p className="text-gray-600">{t('dashboard_placeholder')}</p>
      </main>
    </div>
  );
}
