'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from '@/locales/en.json';
import bn from '@/locales/bn.json';

type Locale = 'en' | 'bn';
type Dict = Record<string, unknown>;

const dicts: Record<Locale, Dict> = { en: en as Dict, bn: bn as Dict };

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<Ctx | null>(null);

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === 'object' && seg in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[seg];
    }
    return undefined;
  }, obj);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('amaarshop_locale') as Locale | null) : null;
    if (saved === 'en' || saved === 'bn') {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('amaarshop_locale', l);
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const v = getByPath(dicts[locale], key);
      if (typeof v === 'string') return v;
      const fv = getByPath(dicts.en, key);
      if (typeof fv === 'string') return fv;
      return fallback ?? key;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
