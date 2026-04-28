'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { getOwnerReviews, replyToReview } from '@/lib/reviewApi';
import { formatDateTime } from '@/lib/format';
import { ApiRequestError } from '@/lib/api';
import { useI18n } from '@/hooks/useI18n';

export default function DashboardReviewsPage() {
  const { locale } = useI18n();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['owner-reviews'],
    queryFn: () => getOwnerReviews(1, 100),
  });

  const reviews = data?.reviews ?? [];
  const rating = data?.rating;

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-5xl">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Reviews</h1>
      <p className="text-stone-500 mt-1 mb-5">
        Customer reviews on your shop and products. Reply to engage with your buyers.
      </p>

      <Card className="p-5 mb-5" hover={false}>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[34px] font-bold leading-none text-stone-900">
              {rating?.count ? rating.average.toFixed(1) : '–'}
            </div>
            <div className="mt-1.5">
              <StarRating value={rating?.average ?? 0} size={14} />
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              {rating?.count ?? 0} total {rating?.count === 1 ? 'review' : 'reviews'}
            </div>
          </div>
          <div className="flex-1 text-[13px] text-stone-500 leading-relaxed">
            Your shop&apos;s overall rating from delivered-order reviews.
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-stone-500 text-sm py-8 text-center">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="text-stone-500 text-sm py-12 text-center">No reviews yet.</div>
      ) : (
        <div className="grid gap-3">
          {reviews.map((r) => (
            <ReviewRow
              key={r.id}
              review={r}
              onReplied={() => qc.invalidateQueries({ queryKey: ['owner-reviews'] })}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewRowProps {
  review: {
    id: string;
    customer_name: string;
    rating: number;
    body: string;
    image_url: string | null;
    owner_reply: string | null;
    owner_replied_at: string | null;
    product_name: string;
    created_at: string;
  };
  onReplied: () => void;
  locale: 'en' | 'bn';
}

function ReviewRow({ review, onReplied, locale }: ReviewRowProps) {
  const [replyDraft, setReplyDraft] = useState(review.owner_reply ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!replyDraft.trim()) {
      setError('Reply cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await replyToReview(review.id, replyDraft.trim());
      setEditing(false);
      onReplied();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save reply');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4" hover={false}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-stone-100 grid place-items-center text-stone-600 text-sm font-semibold flex-shrink-0">
          {review.customer_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium text-stone-900">{review.customer_name}</div>
            <StarRating value={review.rating} size={12} />
            <div className="text-[11px] text-stone-400 ml-auto">
              {formatDateTime(review.created_at, locale)}
            </div>
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            On: <span className="font-medium text-stone-700">{review.product_name}</span>
          </div>
          {review.body && (
            <p className="text-[13.5px] text-stone-700 leading-relaxed mt-1.5 whitespace-pre-line">
              {review.body}
            </p>
          )}
          {review.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.image_url}
              alt=""
              className="mt-2 max-h-44 rounded-md border border-stone-200 object-cover"
            />
          )}

          {/* Reply section */}
          {review.owner_reply && !editing ? (
            <div className="mt-3 bg-stone-50 border-l-2 border-teal-500 px-3 py-2 rounded-r-md">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                  Your reply
                </div>
                <button
                  onClick={() => {
                    setReplyDraft(review.owner_reply ?? '');
                    setEditing(true);
                  }}
                  className="text-[11px] text-teal-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="text-[13px] text-stone-700 mt-0.5 whitespace-pre-line">
                {review.owner_reply}
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                rows={2}
                placeholder="Write a reply…"
                className="w-full text-sm border border-stone-300 rounded-md px-3 py-2 focus:outline-none focus:border-teal-500"
              />
              {error && <div className="text-[12px] text-red-600 mt-1">{error}</div>}
              <div className="flex gap-2 mt-2">
                <Button variant="primary" size="sm" onClick={submit} disabled={saving}>
                  {saving ? 'Saving…' : review.owner_reply ? 'Update reply' : 'Send reply'}
                </Button>
                {editing && (
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setReplyDraft(review.owner_reply ?? '');
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
