import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useShop } from '@/hooks/useShop';
import LanguageToggle from '@/components/LanguageToggle';
import DashboardHome from '@/pages/DashboardHome';
import ShopSetup from '@/pages/ShopSetup';
import ShopSettings from '@/pages/ShopSettings';
import DeliverySettingsPage from '@/pages/DeliverySettings';
import Products from '@/pages/Products';
import ProductForm from '@/pages/ProductForm';
import Categories from '@/pages/Categories';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { shop, loading } = useShop();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // No shop yet — show only the setup wizard (no nav)
  if (!shop) {
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
        <Routes>
          <Route path="setup" element={<ShopSetup />} />
          <Route path="*" element={<Navigate to="/dashboard/setup" replace />} />
        </Routes>
      </div>
    );
  }

  // Has shop — full dashboard layout with navigation
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-700">{t('app_name')}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{shop.name}</span>
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

      <nav className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 flex gap-6 text-sm overflow-x-auto">
          <DashboardNavLink to="/dashboard" end>{t('dashboard')}</DashboardNavLink>
          <DashboardNavLink to="/dashboard/products">{t('shop.products')}</DashboardNavLink>
          <DashboardNavLink to="/dashboard/categories">{t('shop.categories')}</DashboardNavLink>
          <DashboardNavLink to="/dashboard/settings">{t('shop.settings')}</DashboardNavLink>
          <DashboardNavLink to="/dashboard/settings/delivery">{t('shop.delivery_settings')}</DashboardNavLink>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Routes>
          <Route index element={<DashboardHome />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductForm />} />
          <Route path="categories" element={<Categories />} />
          <Route path="settings" element={<ShopSettings />} />
          <Route path="settings/delivery" element={<DeliverySettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function DashboardNavLink({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `py-3 border-b-2 font-medium transition-colors ${
          isActive
            ? 'border-primary-600 text-primary-700'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
