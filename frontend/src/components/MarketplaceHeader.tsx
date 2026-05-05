'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { IcSearch, IcStore, IcPackage, IcMenu, IcX } from '@/components/icons/Icons';
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  const labels = {
    shops: locale === 'bn' ? 'দোকান' : 'Shops',
    track: locale === 'bn' ? 'অর্ডার ট্র্যাক' : 'Track order',
    sell: locale === 'bn' ? 'বিক্রি করুন' : 'Sell on AmaarShop',
    searchPh: locale === 'bn' ? 'দোকান বা পণ্য খুঁজুন…' : 'Search shops and products…',
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200">
      <div className="max-w-container mx-auto px-4 h-16 flex items-center gap-3 sm:gap-4">
        <Logo size={28} />

        {/* Search (matches design: rounded-md stone-100, focus → white + ring) */}
        <form
          onSubmit={submit}
          aria-hidden={!searchVisible}
          className={`flex-1 max-w-[480px] hidden sm:flex h-10 bg-stone-100 rounded-md items-center px-3 gap-2 transition-opacity duration-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/30 ${
            searchVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <IcSearch size={16} className="text-stone-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.searchPh}
            tabIndex={searchVisible ? 0 : -1}
            className="border-0 bg-transparent outline-none flex-1 text-sm text-stone-900 placeholder-stone-500 min-w-0"
          />
        </form>

        {/* Right side: nav links + lang + primary CTA */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/shops"
            className="hidden md:inline-flex items-center px-2.5 py-1.5 rounded-md text-sm font-medium text-stone-700 hover:text-teal-700 hover:bg-stone-50 transition-colors"
          >
            {labels.shops}
          </Link>
          <Link
            href="/order-lookup"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-stone-700 hover:text-teal-700 hover:bg-stone-50 transition-colors"
          >
            <IcPackage size={15} className="text-stone-500" />
            {labels.track}
          </Link>
          <div className="ml-1 sm:ml-2">
            <LanguageToggle />
          </div>
          {user ? (
            <Link href="/dashboard" className="hidden sm:block ml-1">
              <Button variant="primary" size="sm">
                <IcStore size={14} /> {t('dashboard')}
              </Button>
            </Link>
          ) : (
            <Link href="/signup" className="hidden sm:block ml-1">
              <Button variant="primary" size="sm">
                <IcStore size={14} /> {labels.sell}
              </Button>
            </Link>
          )}
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-stone-700 hover:bg-stone-100"
          >
            {menuOpen ? <IcX size={18} /> : <IcMenu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white">
          <div className="max-w-container mx-auto px-4 py-3 flex flex-col gap-1">
            <form onSubmit={submit} className="flex h-10 bg-stone-100 rounded-md items-center px-3 gap-2 mb-2 sm:hidden">
              <IcSearch size={16} className="text-stone-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={labels.searchPh}
                className="border-0 bg-transparent outline-none flex-1 text-sm text-stone-900 placeholder-stone-500 min-w-0"
              />
            </form>
            <Link href="/shops" onClick={() => setMenuOpen(false)} className="px-2 py-2 rounded-md text-sm font-medium text-stone-800 hover:bg-stone-50">
              {labels.shops}
            </Link>
            <Link href="/order-lookup" onClick={() => setMenuOpen(false)} className="px-2 py-2 rounded-md text-sm font-medium text-stone-800 hover:bg-stone-50 inline-flex items-center gap-2">
              <IcPackage size={15} className="text-stone-500" />
              {labels.track}
            </Link>
            <div className="border-t border-stone-100 my-2" />
            {user ? (
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="px-2 py-2 rounded-md text-sm font-medium text-teal-700 hover:bg-stone-50 inline-flex items-center gap-2">
                <IcStore size={15} /> {t('dashboard')}
              </Link>
            ) : (
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="px-2 py-2 rounded-md text-sm font-medium text-teal-700 hover:bg-stone-50 inline-flex items-center gap-2">
                <IcStore size={15} /> {labels.sell}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
