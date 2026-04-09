import { useTranslation } from 'react-i18next';
import LanguageToggle from './components/LanguageToggle';

export default function App() {
  const { t } = useTranslation();

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
