'use client';
import { useI18n } from '@/hooks/useI18n';

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="inline-flex bg-stone-100 rounded-full p-[3px] gap-[2px]">
      {(['en', 'bn'] as const).map((l) => {
        const on = locale === l;
        return (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={`px-3 py-[5px] text-xs font-medium rounded-full transition-colors ${
              on ? 'bg-teal-600 text-white' : 'bg-transparent text-stone-600 hover:text-stone-900'
            } ${l === 'bn' ? 'font-bengali' : ''}`}
          >
            {l === 'en' ? 'EN' : 'বাং'}
          </button>
        );
      })}
    </div>
  );
}
