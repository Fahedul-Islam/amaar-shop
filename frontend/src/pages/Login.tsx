import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { ApiRequestError } from '@/lib/api';
import LanguageToggle from '@/components/LanguageToggle';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(t(`errors.${err.code}`, err.message));
      } else {
        setError(t('errors.unknown', 'Something went wrong'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <header className="absolute top-4 right-4">
        <LanguageToggle />
      </header>

      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-primary-700 text-center mb-2">
          {t('app_name')}
        </h1>
        <h2 className="text-lg text-gray-600 text-center mb-8">
          {t('login')}
        </h2>

        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-md p-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="seller@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary-600 px-4 py-2 text-white font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {submitting ? t('logging_in') : t('login')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          {t('no_account')}{' '}
          <Link to="/signup" className="text-primary-600 font-medium hover:text-primary-700">
            {t('signup')}
          </Link>
        </p>
      </div>
    </div>
  );
}
