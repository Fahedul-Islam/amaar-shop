import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n, t } = useTranslation();

  const toggle = () => {
    const next = i18n.language === 'en' ? 'bn' : 'en';
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
    >
      {i18n.language === 'en' ? t('bengali') : t('english')}
    </button>
  );
}
