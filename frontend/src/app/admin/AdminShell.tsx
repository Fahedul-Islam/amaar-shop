'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import {
  IcHome, IcStore, IcUser, IcTruck, IcPackage, IcLogout,
  IcChart, IcTag, IcLock, IcInfo,
} from '@/components/icons/Icons';
import { useAuth } from '@/hooks/useAuth';

// Sidebar groups — labels are written for non-technical admins.
// "Insights" reads better than "Analytics", "Money & payouts" beats
// "Financial overview", and "Admin team" is plainer than "Roles & access".
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Marketplace',
    items: [
      { href: '/admin',          label: 'Overview',         Icon: IcHome,    exact: true },
      { href: '/admin/shops',    label: 'Shops',            Icon: IcStore },
      { href: '/admin/users',    label: 'Users',            Icon: IcUser },
      { href: '/admin/orders',   label: 'Orders',           Icon: IcTruck },
      { href: '/admin/products', label: 'Products',         Icon: IcPackage },
      { href: '/admin/reports',  label: 'Customer reports', Icon: IcInfo },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/admin/analytics', label: 'Insights',         Icon: IcChart },
      { href: '/admin/financial', label: 'Money & payouts',  Icon: IcTag },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/team', label: 'Admin team', Icon: IcLock },
    ],
  },
];

interface NavItem {
  href: string;
  label: string;
  Icon: (props: { size?: number }) => JSX.Element;
  exact?: boolean;
}

// mobilePrimary picks the five most-used routes for the bottom-tab bar on phones.
const mobilePrimary: NavItem[] = navGroups.flatMap((g) => g.items).slice(0, 5);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/admin/login');
      return;
    }
    if (!user.is_admin) {
      // Non-admins get bounced to the seller dashboard.
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user || !user.is_admin) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-60 flex-shrink-0 bg-stone-50 border-r border-stone-200 p-3 sticky top-0 h-screen hidden md:flex flex-col gap-1">
        <div className="px-2 pb-4 flex items-center gap-2">
          <Logo size={26} href="/admin" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 border border-stone-200 rounded px-1.5 py-0.5 bg-white">
            Admin
          </span>
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5 mt-2">
            <div className="text-[11px] text-stone-400 uppercase tracking-wider px-3 pt-2 pb-1">
              {group.label}
            </div>
            {group.items.map((item) => {
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
          </div>
        ))}

        <div className="mt-auto pt-3 border-t border-stone-200">
          <div className="flex items-center gap-2.5 p-2">
            <div
              className="w-8 h-8 rounded-full bg-teal-600 text-white grid place-items-center font-semibold text-sm"
              aria-hidden
            >
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{user.email}</div>
              <div className="text-[11px] text-stone-500">Super admin</div>
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

      <div className="md:hidden w-full">
        <header className="bg-white border-b border-stone-200 flex items-center px-4 h-14 gap-3">
          <Logo size={24} href="/admin" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 border border-stone-200 rounded px-1.5 py-0.5">
            Admin
          </span>
          <div className="ml-auto">
            <Button variant="neutral" size="sm" onClick={logout}><IcLogout size={14} /></Button>
          </div>
        </header>
      </div>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 flex">
        {/* Mobile bottom bar shows the most-used pages only — five tabs is the
            ergonomic limit on phones. */}
        {mobilePrimary.map((item) => {
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
