'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MarketplaceHeader } from '@/components/MarketplaceHeader';
import { MarketplaceFooter } from '@/components/MarketplaceFooter';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { IcChevR } from '@/components/icons/Icons';
import { lookupOrdersByPhone, type MarketplaceOrder } from '@/lib/marketplaceApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import { ApiRequestError } from '@/lib/api';

export default function MarketplaceOrderLookup() {
  const [phone, setPhone] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [orders, setOrders] = useState<MarketplaceOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const list = await lookupOrdersByPhone(trimmed);
      setOrders(list);
      setSubmittedPhone(trimmed);
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
        <h1 className="text-2xl font-bold tracking-tight mb-2">Track your orders</h1>
        <p className="text-stone-500 mb-5">
          Enter the phone number you used at checkout to see all your orders.
        </p>

        <Card className="p-5" hover={false}>
          <form onSubmit={submit} className="grid gap-3.5">
            <Input
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01712 345 678"
            />
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Searching…' : 'Find my orders'}
            </Button>
            {error && <div className="text-red-600 text-sm">{error}</div>}
          </form>
        </Card>

        {orders && (
          <div className="mt-6">
            {orders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-stone-200 rounded-lg">
                <div className="text-stone-700 font-medium mb-1">No orders found</div>
                <div className="text-stone-500 text-sm">
                  We couldn&rsquo;t find any orders for that phone number.
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm text-stone-500 mb-3">
                  {orders.length} order{orders.length === 1 ? '' : 's'} found for {submittedPhone}
                </div>
                <div className="grid gap-3">
                  {orders.map((o) => {
                    const detailHref = `/s/${o.shop_slug}/order-lookup?ref=${encodeURIComponent(
                      o.id,
                    )}&phone=${encodeURIComponent(submittedPhone)}`;
                    return (
                      <Card key={o.id} className="p-4" hover={false}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-sm text-stone-700">
                                #{o.id.slice(0, 8)}
                              </span>
                              <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                            </div>
                            <div className="text-sm font-medium text-stone-900 truncate">
                              {o.shop_name}
                            </div>
                            <div className="text-xs text-stone-500 mt-0.5">
                              {formatDateTime(o.created_at)} · {o.items.length} item
                              {o.items.length === 1 ? '' : 's'} · {formatBDT(o.total_bdt)}
                            </div>
                          </div>
                          <Link href={detailHref}>
                            <Button variant="secondary" size="sm">
                              View details <IcChevR size={14} />
                            </Button>
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <div className="text-xs text-stone-500 mt-6 text-center">
          <Link href="/" className="text-teal-600 hover:text-teal-700">
            ← Back to marketplace
          </Link>
        </div>
      </section>
      <MarketplaceFooter />
    </>
  );
}
