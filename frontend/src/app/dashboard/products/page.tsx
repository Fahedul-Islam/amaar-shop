'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { ProductImage, hueFromString } from '@/components/ui/ProductImage';
import { IcPlus, IcSearch, IcChevR, IcDownload } from '@/components/icons/Icons';
import { listProducts } from '@/lib/productApi';
import { useI18n } from '@/hooks/useI18n';

type StockFilter = 'all' | 'low' | 'out';

export default function ProductsPage() {
  const { locale } = useI18n();
  const params = useSearchParams();
  const initialStock = (params?.get('stock') === 'low' || params?.get('stock') === 'out')
    ? (params.get('stock') as StockFilter)
    : 'all';
  const [q, setQ] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>(initialStock);

  const { data, isLoading } = useQuery({
    queryKey: ['prods', q],
    queryFn: () => listProducts({ q: q || undefined, page_size: 100 }),
  });

  const allProducts = data?.data ?? [];
  const products = allProducts.filter((p) => {
    if (stockFilter === 'out') return p.stock === 0;
    if (stockFilter === 'low') return p.stock > 0 && p.stock <= 5;
    return true;
  });

  return (
    <div className="px-6 md:px-8 py-6 md:py-7">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Products</h1>
          <p className="text-stone-500 mt-1">{products.length} listed</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/shops/me/exports/products.pdf" target="_blank" rel="noreferrer">
            <Button variant="neutral"><IcDownload size={14} /> Download PDF</Button>
          </a>
          <Link href="/dashboard/products/new">
            <Button variant="primary"><IcPlus size={16} /> Add product</Button>
          </Link>
        </div>
      </div>

      <Card className="p-0 overflow-hidden" hover={false}>
        <div className="px-4 py-3 border-b border-stone-200 flex gap-3 items-center">
          <div className="flex-1 max-w-[320px] h-9 bg-stone-50 rounded-md flex items-center px-3 gap-2 text-stone-500">
            <IcSearch size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={locale === 'bn' ? 'পণ্য খুঁজুন...' : 'Search products...'}
              className="bg-transparent outline-none flex-1 text-sm text-stone-900"
            />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            {([
              { key: 'all', label: 'All' },
              { key: 'low', label: 'Running low' },
              { key: 'out', label: 'Out of stock' },
            ] as { key: StockFilter; label: string }[]).map((f) => {
              const on = stockFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStockFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    on ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-stone-500 text-sm">Loading…</div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center text-stone-500 text-sm">
            {locale === 'bn' ? 'এখনো কোনো পণ্য নেই।' : 'No products yet. Add your first product to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-left">
                  <Th>Product</Th><Th>Price</Th><Th>Stock</Th><Th>Status</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const hue = hueFromString(p.id);
                  const statusColor =
                    !p.is_active ? 'bg-stone-400' :
                    p.stock === 0 ? 'bg-red-500' :
                    p.stock < 5 ? 'bg-amber-500' : 'bg-green-600';
                  const statusText =
                    !p.is_active ? 'Inactive' :
                    p.stock === 0 ? 'Out of stock' :
                    p.stock < 5 ? 'Low stock' : 'In stock';
                  return (
                    <tr key={p.id} className="border-t border-stone-100 hover:bg-stone-50">
                      <Td>
                        <div className="flex gap-2.5 items-center">
                          <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                            <ProductImage src={p.images?.[0]?.url} alt={p.name} hue={hue} ratio="1/1" />
                          </div>
                          <div className="font-medium text-stone-900 min-w-0">{p.name}</div>
                        </div>
                      </Td>
                      <Td><Price amount={p.price_bdt} locale={locale} /></Td>
                      <Td>{p.stock}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                          {statusText}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          <Link
                            href={`/dashboard/products/${p.id}`}
                            className="border border-stone-200 bg-white rounded-md w-7 h-7 grid place-items-center text-stone-700 hover:bg-stone-50"
                            aria-label="Edit"
                          >
                            <IcChevR size={16} />
                          </Link>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>{children}</td>;
}
