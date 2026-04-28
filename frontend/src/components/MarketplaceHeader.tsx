'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { IcSearch, IcStore } from '@/components/icons/Icons';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';

export function MarketplaceHeader({
  defaultQuery = '',
  revealSearchOnScroll = false,
}: {
  defaultQuery?: string;
  revealSearchOnScroll?: boolean;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!revealSearchOnScroll) return;
    const onScroll = () => setScrolled(window.scrollY > 220);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [revealSearchOnScroll]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/');
  };

  const searchVisible = !revealSearchOnScroll || scrolled;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200">
      <div className="max-w-container mx-auto px-4 h-16 flex items-center gap-4">
        <Logo size={28} />
        <form
          onSubmit={submit}
          aria-hidden={!searchVisible}
          className={`flex-1 max-w-[480px] ml-4 hidden sm:flex h-10 bg-stone-100 rounded-md items-center px-3 gap-2 transition-opacity duration-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/30 ${
            searchVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <IcSearch size={16} className="text-stone-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={locale === 'bn' ? 'দোকান বা পণ্য খুঁজুন…' : 'Search shops and products…'}
            tabIndex={searchVisible ? 0 : -1}
            className="border-0 bg-transparent outline-none flex-1 text-sm text-stone-900 placeholder-stone-500"
          />
        </form>
        <div className="ml-auto flex items-center gap-3">
          <LanguageToggle />
          {user ? (
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                <IcStore size={14} /> {t('dashboard')}
              </Button>
            </Link>
          ) : (
            <Link href="/signup">
              <Button variant="primary" size="sm">
                <IcStore size={14} /> {locale === 'bn' ? 'বিক্রি করুন' : 'Sell on AmaarShop'}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
