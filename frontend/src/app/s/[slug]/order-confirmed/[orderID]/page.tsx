'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IcCheck, IcDownload } from '@/components/icons/Icons';
import { lookupOrder } from '@/lib/storefrontApi';
import { formatBDT, formatDateTime } from '@/lib/format';
import { useStorefront } from '../../StorefrontShell';
import { useI18n } from '@/hooks/useI18n';

export default function OrderConfirmedPage() {
  return (
    <Suspense>
      <OrderConfirmedInner />
    </Suspense>
  );
}

function OrderConfirmedInner() {
  const params = useParams<{ slug: string; orderID: string }>();
  const search = useSearchParams();
  const phone = search.get('phone') ?? '';
  const { shop } = useStorefront();
  const { locale } = useI18n();

  const { data: order } = useQuery({
    queryKey: ['order-confirm', params.slug, params.orderID, phone],
    queryFn: () => lookupOrder(params.slug, params.orderID, phone),
    enabled: !!phone,
    retry: false,
  });

  return (
    <section className="max-w-[560px] mx-auto px-4 py-14 pb-12 text-center">
      <div className="w-[72px] h-[72px] rounded-full bg-teal-50 text-teal-600 grid place-items-center mx-auto mb-4">
        <IcCheck size={36} />
      </div>
      <h1 className="text-[26px] font-bold tracking-tight mb-2">
        {locale === 'bn' ? 'অর্ডার সফল!' : 'Order placed!'}
      </h1>
      <p className="text-stone-600 text-[15px] mb-6">
        {locale === 'bn'
          ? 'আমরা আপনার ফোনে কনফার্মেশন পাঠিয়েছি। বিক্রেতা শীঘ্রই যোগাযোগ করবেন।'
          : 'The seller will reach out to confirm delivery details.'}
      </p>

      <Card className="p-5 text-left mb-5" hover={false}>
        <div className="flex justify-between mb-2.5">
          <span className="text-stone-500 text-sm">{locale === 'bn' ? 'অর্ডার রেফারেন্স' : 'Order reference'}</span>
          <span className="font-mono font-medium">{params.orderID.slice(0, 8)}</span>
        </div>
        {order && (
          <>
            <div className="flex justify-between mb-2.5">
              <span className="text-stone-500 text-sm">Total</span>
              <span className="font-semibold">{formatBDT(order.total_bdt, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500 text-sm">Placed</span>
              <span>{formatDateTime(order.created_at, locale)}</span>
            </div>
          </>
        )}
      </Card>

      <div className="flex flex-wrap gap-2.5 justify-center">
        {phone && (
          <a
            href={`/api/shops/by-slug/${shop.slug}/orders/${params.orderID}/invoice.pdf?phone=${encodeURIComponent(phone)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="neutral">
              <IcDownload size={14} />
              {locale === 'bn' ? 'ইনভয়েস ডাউনলোড' : 'Download invoice'}
            </Button>
          </a>
        )}
        <Link href={`/s/${shop.slug}/order-lookup`}>
          <Button variant="secondary">{locale === 'bn' ? 'অর্ডার ট্র্যাক' : 'Track order'}</Button>
        </Link>
        <Link href={`/s/${shop.slug}`}>
          <Button variant="primary">{locale === 'bn' ? 'কেনাকাটা চালিয়ে যান' : 'Keep shopping'}</Button>
        </Link>
      </div>
    </section>
  );
}
