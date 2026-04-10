import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import LanguageToggle from '@/components/LanguageToggle';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';

function Landing() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  // If already logged in, redirect to dashboard
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <header className="absolute top-4 right-4">
        <LanguageToggle />
      </header>
      <main className="text-center">
        <h1 className="text-4xl font-bold text-primary-700 mb-3">
          {t('app_name')}
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          {t('tagline')}
        </p>
        <a
          href="/signup"
          className="inline-block rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          {t('get_started')}
        </a>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
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
      </Routes>
    </AuthProvider>
  );
}
