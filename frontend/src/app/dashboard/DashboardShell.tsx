'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Logo } from '@/components/ui/Logo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { IcStore, IcLogout } from '@/components/icons/Icons';
import { useAuth } from '@/hooks/useAuth';
import { useShop } from '@/hooks/useShop';

import { sellerNavigation, sellerSections, matchesSellerPath } from './sellerNavigation';

const dailyNavigation = sellerNavigation[0].items;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardInner>{children}</DashboardInner>
    </ProtectedRoute>
  );
}

function DashboardInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { shop, loading, error: shopError, refetch } = useShop();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const section = sellerSections.find(group => group.paths.some(path => matchesSellerPath(pathname, path)));
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const dialog = menuRef.current;
    if (!dialog) return;
    if (menuOpen) dialog.showModal();
    else if (dialog.open) dialog.close();
  }, [menuOpen]);

  useEffect(() => {
    if (loading || shopError) return;
    // Force all routes under /dashboard to route to /dashboard/setup if no shop
    if (!shop && !pathname?.startsWith('/dashboard/setup')) {
      router.replace('/dashboard/setup');
    }
    if (shop && pathname === '/dashboard/setup') {
      router.replace('/dashboard');
    }
  }, [shop, loading, shopError, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (shopError) return <div className="p-8"><p role="alert" className="mb-3">Could not load your shop. Your settings have not changed.</p><Button onClick={() => refetch()}>Try again</Button></div>;

  // No shop — skip sidebar, show just the header + content (the setup wizard).
  if (!shop) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white border-b border-stone-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Logo size={26} href="/dashboard" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-600">{user?.email}</span>
              <LanguageToggle />
              <Button variant="neutral" size="sm" onClick={logout}>
                <IcLogout size={14} /> Sign out
              </Button>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-stone-50 border-r border-stone-200 p-3 sticky top-0 h-screen hidden md:flex flex-col gap-1">
        <div className="px-2 pb-4">
          <Logo size={26} href="/dashboard" />
        </div>
        <nav aria-label="Seller navigation" className="flex-1 overflow-y-auto min-h-0">
          {sellerNavigation.map(group => <div key={group.label} className="mb-5">
            <p className="px-3 mb-2 text-xs font-medium text-stone-400">{group.label}</p>
            {group.items.map(item => {
              const active = item.paths.some(path => matchesSellerPath(pathname, path));
              return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-stone-600 hover:bg-stone-100'}`}><item.Icon size={18} />{item.label}</Link>;
            })}
          </div>)}
        </nav>
        <div className="mt-auto pt-3 border-t border-stone-200">
          <Link
            href={`/s/${shop.slug}`}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-stone-600 hover:bg-stone-100"
          >
            <IcStore size={18} /> View storefront
          </Link>
          <div className="flex items-center gap-2.5 p-2 mt-1">
            <div
              className="w-8 h-8 rounded-full bg-coral-500 text-white grid place-items-center font-semibold text-sm"
              aria-hidden
            >
              {shop.name.charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[13px] font-medium truncate">{shop.name}</div>
              <div className="text-[11px] text-stone-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-stone-600 hover:bg-stone-100 mt-1"
          >
            <IcLogout size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden w-full">
        <header className="bg-white border-b border-stone-200 flex items-center px-4 h-14 gap-3">
          <Logo size={24} href="/dashboard" />
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <Button aria-label="Sign out" variant="neutral" size="sm" onClick={logout}><IcLogout size={14} /></Button>
          </div>
        </header>
      </div>

      <main id="seller-content" className="flex-1 min-w-0 pb-20 md:pb-0">
        {section && <nav aria-label={section.label} className="flex gap-5 overflow-x-auto border-b border-stone-200 px-5 md:px-8 bg-white">
          {section.links.map(link => {
            const active = link.href === '/dashboard/settings' ? pathname === link.href : matchesSellerPath(pathname, link.href) || (link.href.endsWith('/tracking') && pathname === '/dashboard/facebook');
            return <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={`whitespace-nowrap py-4 text-sm border-b-2 ${active ? 'border-teal-700 text-teal-700 font-medium' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>{link.label}</Link>;
          })}
        </nav>}
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Primary seller navigation" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 flex">
        {dailyNavigation.map((item) => {
          const active = item.paths.some(path => matchesSellerPath(pathname, path));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] ${
                active ? 'text-teal-600' : 'text-stone-500'
              }`}
            >
              <item.Icon size={20} />
              <span className="truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        <button ref={menuButtonRef} type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] ${!dailyNavigation.some(item => item.paths.some(path => matchesSellerPath(pathname, path))) ? 'text-teal-700' : 'text-stone-500'}`}><span aria-hidden className="text-xl leading-5">···</span>More</button>
      </nav>
      <dialog ref={menuRef} onCancel={() => setMenuOpen(false)} onClose={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} aria-labelledby="seller-menu-title" className="w-[calc(100%-2rem)] max-w-md max-h-[85dvh] rounded-xl border border-stone-200 p-0 backdrop:bg-black/30">
        <div className="sticky top-0 flex justify-between items-center p-4 bg-white border-b border-stone-200"><h2 id="seller-menu-title" className="font-semibold">Your shop</h2><button type="button" onClick={() => setMenuOpen(false)} className="text-sm px-3 py-2">Close</button></div>
        <nav aria-label="More seller features" className="p-4">
          {sellerNavigation.slice(1).map(group => <div key={group.label} className="mb-4"><p className="text-xs text-stone-500 mb-2">{group.label}</p>{group.items.map(item => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex gap-3 items-center py-3 text-sm"><item.Icon size={18} />{item.label}</Link>)}</div>)}
          <Link href={`/s/${shop.slug}`} className="block border-t border-stone-200 pt-4 text-sm" onClick={() => setMenuOpen(false)}>View storefront</Link>
        </nav>
      </dialog>
    </div>
  );
}
