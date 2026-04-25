'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MarketplaceHeader } from '@/components/MarketplaceHeader';
import { MarketplaceFooter } from '@/components/MarketplaceFooter';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { lookupOrdersByPhone } from '@/lib/marketplaceApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import type { Order } from '@/lib/storefrontApi';
import { ApiRequestError } from '@/lib/api';

export default function MarketplaceOrderLookup() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const list = await lookupOrdersByPhone(phone.trim());
      setOrders(list);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not look up orders.');
      setOrders(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MarketplaceHeader />
      <section className="max-w-[640px] mx-auto px-4 pt-10 pb-12">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Track your order</h1>
        <p className="text-stone-500 mb-5">Enter the phone number you used when placing the order.</p>

        <Card className="p-5" hover={false}>
          <form onSubmit={submit} className="grid gap-3.5">
            <Input
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01712 345 678"
            />
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Searching…' : 'Track order'}
            </Button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
          </form>
        </Card>

        {orders && (
          <div className="mt-6 grid gap-3">
            {orders.length === 0 ? (
              <div className="text-stone-500 text-sm text-center py-10">No orders found for that phone.</div>
            ) : (
              orders.map((o) => (
                <Card key={o.id} className="p-4 flex items-start gap-4" hover={false}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-stone-700">#{o.id.slice(0, 8)}</span>
                      <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                    </div>
                    <div className="text-xs text-stone-500">{formatDateTime(o.created_at)}</div>
                    <div className="text-sm mt-2">
                      {o.items.length} item{o.items.length === 1 ? '' : 's'} · {formatBDT(o.total_bdt)}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        <div className="text-xs text-stone-500 mt-5 text-center">
          Or visit the shop directly: <Link href="/" className="text-teal-600">back to marketplace</Link>
        </div>
      </section>
      <MarketplaceFooter />
    </>
  );
}
