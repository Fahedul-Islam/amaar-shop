import { IcHome, IcPackage, IcTruck, IcChart, IcSettings, IcTag, IcUser, IcBanknote } from '@/components/icons/Icons';

export const sellerNavigation = [
  { label: 'Daily work', items: [
    { href: '/dashboard', label: 'Overview', Icon: IcHome, paths: ['/dashboard'] },
    { href: '/dashboard/orders', label: 'Orders', Icon: IcTruck, paths: ['/dashboard/orders'] },
    { href: '/dashboard/products', label: 'Products', Icon: IcPackage, paths: ['/dashboard/products', '/dashboard/categories'] },
    { href: '/dashboard/customers', label: 'Customers', Icon: IcUser, paths: ['/dashboard/customers', '/dashboard/reviews'] },
  ] },
  { label: 'Business', items: [
    { href: '/dashboard/discounts', label: 'Discount codes', Icon: IcTag, paths: ['/dashboard/discounts'] },
    { href: '/dashboard/analytics', label: 'Sales reports', Icon: IcChart, paths: ['/dashboard/analytics'] },
    { href: '/dashboard/marketing', label: 'Profit & ad costs', Icon: IcBanknote, paths: ['/dashboard/marketing'] },
    { href: '/dashboard/billing', label: 'Platform fees', Icon: IcBanknote, paths: ['/dashboard/billing'] },
  ] },
  { label: 'Shop', items: [
    { href: '/dashboard/settings', label: 'Shop settings', Icon: IcSettings, paths: ['/dashboard/settings', '/dashboard/facebook'] },
  ] },
];

export function matchesSellerPath(pathname: string, path: string) {
  return pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`));
}

export const sellerSections = [
  { paths: ['/dashboard/products', '/dashboard/categories'], label: 'Product navigation', links: [
    { href: '/dashboard/products', label: 'Products' },
    { href: '/dashboard/categories', label: 'Categories' },
  ] },
  { paths: ['/dashboard/customers', '/dashboard/reviews'], label: 'Customer navigation', links: [
    { href: '/dashboard/customers', label: 'Customers' },
    { href: '/dashboard/reviews', label: 'Reviews' },
  ] },
  { paths: ['/dashboard/settings', '/dashboard/facebook'], label: 'Shop settings navigation', links: [
    { href: '/dashboard/settings', label: 'Shop details' },
    { href: '/dashboard/settings/delivery', label: 'Delivery & payments' },
    { href: '/dashboard/settings/courier', label: 'Courier' },
    { href: '/dashboard/settings/tracking', label: 'Ad tracking' },
  ] },
];
