import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import MarketplaceHome from '@/pages/MarketplaceHome';
import StorefrontLayout from '@/pages/storefront/StorefrontLayout';
import ShopLanding from '@/pages/storefront/ShopLanding';
import ProductDetail from '@/pages/storefront/ProductDetail';
import Checkout from '@/pages/storefront/Checkout';
import OrderConfirmed from '@/pages/storefront/OrderConfirmed';
import OrderLookup from '@/pages/storefront/OrderLookup';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<MarketplaceHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Public storefront */}
        <Route path="/s/:slug" element={<StorefrontLayout />}>
          <Route index element={<ShopLanding />} />
          <Route path="p/:productId" element={<ProductDetail />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-confirmed/:orderID" element={<OrderConfirmed />} />
          <Route path="order-lookup" element={<OrderLookup />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
