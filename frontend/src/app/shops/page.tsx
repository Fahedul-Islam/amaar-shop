'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { MarketplaceHeader } from '@/components/MarketplaceHeader';
import { MarketplaceFooter } from '@/components/MarketplaceFooter';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IcSearch } from '@/components/icons/Icons';
import { getMarketplaceShops } from '@/lib/marketplaceApi';
import { hueFromString } from '@/components/ui/ProductImage';

export default function ShopDirectoryPage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const shopsQuery = useQuery({
    queryKey: ['mp-shops', submitted],
    queryFn: () => getMarketplaceShops({ q: submitted || undefined, page_size: 24 }),
  });

  const shops = shopsQuery.data?.data ?? [];

  return (
    <>
      <MarketplaceHeader />
      <section className="max-w-container mx-auto px-4 pt-7 pb-12">
        <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mb-1">All shops</h1>
        <p className="text-stone-500 mb-6">Browse every seller on AmaarShop.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim());
          }}
          className="flex gap-2 mb-6 max-w-[480px]"
        >
          <div className="flex-1 h-10 bg-white border border-stone-200 rounded-md flex items-center px-3 gap-2">
            <IcSearch size={16} className="text-stone-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search shops…"
              className="flex-1 bg-transparent outline-none text-sm text-stone-900"
            />
          </div>
          <Button type="submit" variant="primary">Search</Button>
        </form>

        {shopsQuery.isLoading ? (
          <div className="text-stone-500 text-sm">Loading…</div>
        ) : shops.length === 0 ? (
          <div className="text-stone-500 text-sm py-10 text-center">No shops found.</div>
        ) : (
          <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {shops.map((s) => {
              const hue = hueFromString(s.id);
              return (
                <Card key={s.id} className="p-4">
                  <div className="flex gap-3 items-center mb-2.5">
                    <div
                      className="w-11 h-11 rounded-lg flex-shrink-0 grid place-items-center font-bold text-base overflow-hidden"
                      style={{ background: `hsl(${hue},30%,88%)`, color: `hsl(${hue},30%,35%)` }}
                    >
                      {s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" /> : s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-xs text-stone-500 truncate">/{s.slug}</div>
                    </div>
                  </div>
                  <div className="text-sm text-stone-600 mb-3 leading-relaxed line-clamp-2 min-h-[2.8em]">
                    {s.description || 'A shop on AmaarShop.'}
                  </div>
                  <Link href={`/s/${s.slug}`}>
                    <Button variant="secondary" size="sm" className="w-full">Visit shop</Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </section>
      <MarketplaceFooter />
    </>
  );
}
