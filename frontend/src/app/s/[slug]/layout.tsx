import type { ReactNode } from 'react';
import { StorefrontShell } from './StorefrontShell';
import { getShop, getDeliverySettings } from '@/lib/storefrontApi';
import type { PublicShop, PublicDeliverySettings } from '@/lib/shopApi';

export default async function StorefrontLayout({
  params,
  children,
}: {
  params: { slug: string };
  children: ReactNode;
}) {
  let shop: PublicShop | null = null;
  let delivery: PublicDeliverySettings | null = null;
  try {
    shop = await getShop(params.slug);
    delivery = await getDeliverySettings(params.slug).catch(() => null);
  } catch {
    shop = null;
  }

  if (!shop) {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Shop not found</h1>
          <p className="text-stone-500">This shop may no longer be available.</p>
        </div>
      </div>
    );
  }

  return (
    <StorefrontShell shop={shop} delivery={delivery}>
      {children}
    </StorefrontShell>
  );
}
