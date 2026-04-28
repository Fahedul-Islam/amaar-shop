'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Logo } from '@/components/ui/Logo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Button } from '@/components/ui/Button';
import {
  IcHome, IcPackage, IcTruck, IcChart, IcFacebook, IcSettings, IcTag, IcStore, IcLogout, IcHeart,
} from '@/components/icons/Icons';
import { useAuth } from '@/hooks/useAuth';
import { useShop } from '@/hooks/useShop';

const nav = [
  { href: '/dashboard', label: 'Dashboard', Icon: IcHome, exact: true },
  { href: '/dashboard/products', label: 'Products', Icon: IcPackage },
  { href: '/dashboard/categories', label: 'Categories', Icon: IcTag },
  { href: '/dashboard/orders', label: 'Orders', Icon: IcTruck },
  { href: '/dashboard/reviews', label: 'Reviews', Icon: IcHeart },
  { href: '/dashboard/analytics', label: 'Analytics', Icon: IcChart },
  { href: '/dashboard/facebook', label: 'Facebook', Icon: IcFacebook },
  { href: '/dashboard/settings', label: 'Settings', Icon: IcSettings },
];

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
  const { shop, loading } = useShop();

  useEffect(() => {
    if (loading) return;
    // Force all routes under /dashboard to route to /dashboard/setup if no shop
    if (!shop && !pathname?.startsWith('/dashboard/setup')) {
      router.replace('/dashboard/setup');
    }
    if (shop && pathname === '/dashboard/setup') {
      router.replace('/dashboard');
    }
  }, [shop, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

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
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-stone-50 border-r border-stone-200 p-3 sticky top-0 h-screen hidden md:flex flex-col gap-1">
        <div className="px-2 pb-4">
          <Logo size={26} href="/dashboard" />
        </div>
        <div className="text-[11px] text-stone-400 uppercase tracking-wider px-3 pt-2 pb-1">Manage</div>
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-teal-50 text-teal-700 font-medium'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <item.Icon size={18} /> {item.label}
            </Link>
          );
        })}
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
            <Button variant="neutral" size="sm" onClick={logout}><IcLogout size={14} /></Button>
          </div>
        </header>
      </div>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 flex">
        {nav.slice(0, 5).map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
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
      </nav>
    </div>
  );
}
