'use client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { getShopReviews, getProductReviews } from '@/lib/reviewApi';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

interface BaseProps {
  // Either a shop slug or a product id is supplied.
  slug?: string;
  productId?: string;
  title?: string;
}

export function ReviewList({ slug, productId, title }: BaseProps) {
  const { locale } = useI18n();
  const enabled = Boolean(slug || productId);

  const q = useQuery({
    queryKey: ['reviews', slug ?? '', productId ?? ''],
    queryFn: () => {
      if (productId) return getProductReviews(productId);
      return getShopReviews(slug as string);
    },
    enabled,
  });

  if (!enabled) return null;

  if (q.isLoading) {
    return <div className="text-stone-400 text-sm py-6 text-center">Loading reviews…</div>;
  }

  const data = q.data?.data;
  const rating = data?.rating;
  const reviews = data?.reviews ?? [];

  return (
    <div>
      {title && <h2 className="text-[15px] font-semibold text-stone-900 mb-3">{title}</h2>}

      <Card className="p-5 mb-4" hover={false}>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-[34px] font-bold leading-none text-stone-900">
              {rating?.count ? rating.average.toFixed(1) : '–'}
            </div>
            <div className="mt-1.5">
              <StarRating value={rating?.average ?? 0} size={14} />
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              {rating?.count ?? 0} {locale === 'bn' ? 'রিভিউ' : rating?.count === 1 ? 'review' : 'reviews'}
            </div>
          </div>
          <div className="flex-1 text-[13px] text-stone-500 leading-relaxed">
            {rating?.count
              ? (locale === 'bn'
                  ? 'যাচাইকৃত ক্রেতাদের রিভিউ — শুধু ডেলিভার্ড অর্ডারের জন্য।'
                  : 'Verified buyer reviews — only after order delivery.')
              : (locale === 'bn'
                  ? 'এখনো কোনো রিভিউ নেই।'
                  : 'No reviews yet.')}
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {reviews.map((r) => (
          <Card key={r.id} className="p-4" hover={false}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-100 grid place-items-center text-stone-600 text-sm font-semibold flex-shrink-0">
                {r.customer_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-medium text-stone-900">{r.customer_name}</div>
                  <StarRating value={r.rating} size={12} />
                  <div className="text-[11px] text-stone-400 ml-auto">{formatDateTime(r.created_at, locale)}</div>
                </div>
                {!productId && r.product_name && (
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {locale === 'bn' ? 'পণ্য:' : 'On:'} {r.product_name}
                  </div>
                )}
                {r.body && (
                  <p className="text-[13.5px] text-stone-700 leading-relaxed mt-1.5 whitespace-pre-line">
                    {r.body}
                  </p>
                )}
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt=""
                    className="mt-2 max-h-44 rounded-md border border-stone-200 object-cover"
                  />
                )}
                {r.owner_reply && (
                  <div className="mt-3 bg-stone-50 border-l-2 border-teal-500 px-3 py-2 rounded-r-md">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                      {locale === 'bn' ? 'বিক্রেতার উত্তর' : 'Reply from seller'}
                    </div>
                    <div className="text-[13px] text-stone-700 mt-0.5 whitespace-pre-line">
                      {r.owner_reply}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
