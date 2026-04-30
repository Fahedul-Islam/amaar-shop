'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { IcSearch } from '@/components/icons/Icons';
import { getOwnerReviews, replyToReview, type OwnerReview } from '@/lib/reviewApi';
import { formatDateTime } from '@/lib/format';
import { ApiRequestError } from '@/lib/api';
import { useI18n } from '@/hooks/useI18n';

type StatusFilter = 'all' | 'needs_reply' | 'replied';
type RatingFilter = 'all' | 1 | 2 | 3 | 4 | 5;
type SortOrder = 'newest' | 'oldest' | 'lowest' | 'highest';

export default function DashboardReviewsPage() {
  const { locale } = useI18n();
  const qc = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['owner-reviews'],
    queryFn: () => getOwnerReviews(1, 100),
  });

  const allReviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);
  const rating = data?.rating;

  // Distribution counts (1★ → 5★).
  const distribution = useMemo(() => {
    const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of allReviews) buckets[r.rating] = (buckets[r.rating] ?? 0) + 1;
    return buckets;
  }, [allReviews]);

  const needsReplyCount = useMemo(
    () => allReviews.filter((r) => !r.owner_reply).length,
    [allReviews],
  );
  const lowRatedCount = useMemo(
    () => allReviews.filter((r) => r.rating <= 2).length,
    [allReviews],
  );

  const filtered = useMemo(() => {
    let out = allReviews;
    if (status === 'needs_reply') out = out.filter((r) => !r.owner_reply);
    else if (status === 'replied') out = out.filter((r) => !!r.owner_reply);
    if (ratingFilter !== 'all') out = out.filter((r) => r.rating === ratingFilter);
    if (debouncedSearch) {
      out = out.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(debouncedSearch) ||
          r.product_name.toLowerCase().includes(debouncedSearch) ||
          r.body.toLowerCase().includes(debouncedSearch),
      );
    }
    out = [...out];
    if (sort === 'newest') out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (sort === 'oldest') out.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sort === 'lowest') out.sort((a, b) => a.rating - b.rating || b.created_at.localeCompare(a.created_at));
    else if (sort === 'highest') out.sort((a, b) => b.rating - a.rating || b.created_at.localeCompare(a.created_at));
    return out;
  }, [allReviews, status, ratingFilter, sort, debouncedSearch]);

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-5xl">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Reviews</h1>
      <p className="text-stone-500 mt-1 mb-5">
        How buyers feel about your shop. Reply to thank, follow up, or fix issues.
      </p>

      <SummaryCard
        avg={rating?.average ?? 0}
        count={rating?.count ?? 0}
        distribution={distribution}
        needsReplyCount={needsReplyCount}
        lowRatedCount={lowRatedCount}
        onJumpToNeedsReply={() => {
          setStatus('needs_reply');
          setRatingFilter('all');
        }}
        onJumpToLow={() => {
          setStatus('all');
          setRatingFilter('all');
          setSort('lowest');
        }}
        onPickRating={(r) => {
          setRatingFilter(r);
          setStatus('all');
        }}
      />

      <FilterBar
        status={status}
        onStatus={setStatus}
        ratingFilter={ratingFilter}
        onRating={setRatingFilter}
        sort={sort}
        onSort={setSort}
        search={search}
        onSearch={setSearch}
        counts={{
          all: allReviews.length,
          needs_reply: needsReplyCount,
          replied: allReviews.length - needsReplyCount,
        }}
      />

      {isLoading ? (
        <div className="text-stone-500 text-sm py-12 text-center">Loading reviews…</div>
      ) : allReviews.length === 0 ? (
        <EmptyAllState />
      ) : filtered.length === 0 ? (
        <EmptyFilterState
          onClear={() => {
            setStatus('all');
            setRatingFilter('all');
            setSearch('');
          }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
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

function SummaryCard({
  avg,
  count,
  distribution,
  needsReplyCount,
  lowRatedCount,
  onJumpToNeedsReply,
  onJumpToLow,
  onPickRating,
}: {
  avg: number;
  count: number;
  distribution: Record<number, number>;
  needsReplyCount: number;
  lowRatedCount: number;
  onJumpToNeedsReply: () => void;
  onJumpToLow: () => void;
  onPickRating: (r: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const max = Math.max(1, ...Object.values(distribution));
  const positivePct = count === 0 ? 0 : ((distribution[5] + distribution[4]) / count) * 100;

  return (
    <Card className="p-5 mb-5" hover={false}>
      <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)_220px]">
        {/* Big rating */}
        <div className="flex flex-col items-start">
          <div className="text-[44px] font-bold leading-none text-stone-900">
            {count ? avg.toFixed(1) : '–'}
          </div>
          <div className="mt-2">
            <StarRating value={avg} size={16} />
          </div>
          <div className="text-xs text-stone-500 mt-1.5">
            From {count} {count === 1 ? 'review' : 'reviews'}
          </div>
          {count > 0 && (
            <div className={`mt-2 text-[11px] font-medium ${positivePct >= 80 ? 'text-emerald-700' : positivePct >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
              {positivePct.toFixed(0)}% gave 4★ or higher
            </div>
          )}
        </div>

        {/* Distribution bars */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-0.5">
            Rating breakdown
          </div>
          {[5, 4, 3, 2, 1].map((star) => {
            const c = distribution[star] ?? 0;
            const pct = (c / max) * 100;
            const barColor =
              star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <button
                key={star}
                onClick={() => c > 0 && onPickRating(star as 1 | 2 | 3 | 4 | 5)}
                disabled={c === 0}
                className={`flex items-center gap-2 group ${c > 0 ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
                title={c > 0 ? `Show only ${star}★ reviews` : `No ${star}★ reviews yet`}
              >
                <span className="text-xs font-medium text-stone-600 w-7 text-right">{star}★</span>
                <div className="flex-1 h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} transition-all group-hover:opacity-80`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-stone-700 w-9 text-left tabular-nums">{c}</span>
              </button>
            );
          })}
        </div>

        {/* Action callouts */}
        <div className="flex flex-col gap-2">
          <ActionCallout
            urgent={needsReplyCount > 0}
            count={needsReplyCount}
            label="Awaiting reply"
            description="Buyers who'd love to hear back"
            onClick={onJumpToNeedsReply}
            disabled={needsReplyCount === 0}
          />
          <ActionCallout
            urgent={lowRatedCount > 0}
            tone="red"
            count={lowRatedCount}
            label="Low ratings (1–2★)"
            description="Address these to win them back"
            onClick={onJumpToLow}
            disabled={lowRatedCount === 0}
          />
        </div>
      </div>
    </Card>
  );
}

function ActionCallout({
  count,
  label,
  description,
  onClick,
  urgent,
  disabled,
  tone = 'amber',
}: {
  count: number;
  label: string;
  description: string;
  onClick: () => void;
  urgent: boolean;
  disabled: boolean;
  tone?: 'amber' | 'red';
}) {
  const idle = 'border-stone-200 bg-stone-50 text-stone-500';
  const active =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
        urgent ? active : idle
      } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">{count}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`text-[11px] mt-0.5 ${urgent ? 'opacity-90' : 'text-stone-500'}`}>
        {description}
      </div>
    </button>
  );
}

function FilterBar({
  status,
  onStatus,
  ratingFilter,
  onRating,
  sort,
  onSort,
  search,
  onSearch,
  counts,
}: {
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  ratingFilter: RatingFilter;
  onRating: (r: RatingFilter) => void;
  sort: SortOrder;
  onSort: (s: SortOrder) => void;
  search: string;
  onSearch: (s: string) => void;
  counts: { all: number; needs_reply: number; replied: number };
}) {
  return (
    <div className="space-y-2 mb-4">
      <div className="flex flex-wrap gap-2 items-center">
        {([
          { key: 'all', label: 'All', count: counts.all },
          { key: 'needs_reply', label: 'Needs reply', count: counts.needs_reply },
          { key: 'replied', label: 'Replied', count: counts.replied },
        ] as { key: StatusFilter; label: string; count: number }[]).map((t) => {
          const on = status === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onStatus(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                on ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 ${on ? 'text-teal-100' : 'text-stone-400'}`}>{t.count}</span>
            </button>
          );
        })}
        <div className="hidden sm:block w-px h-6 bg-stone-200 mx-1" />
        {([1, 2, 3, 4, 5] as const).map((r) => {
          const on = ratingFilter === r;
          return (
            <button
              key={r}
              onClick={() => onRating(on ? 'all' : r)}
              className={`inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                on ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {r}★
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <IcSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by buyer, product, or words…"
            className="w-full h-9 pl-9 pr-3 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as SortOrder)}
          className="h-9 px-3 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
          <option value="lowest">Sort: Lowest rated</option>
          <option value="highest">Sort: Highest rated</option>
        </select>
      </div>
    </div>
  );
}

function EmptyAllState() {
  return (
    <Card className="p-12 text-center" hover={false}>
      <div className="text-3xl mb-2">⭐</div>
      <div className="text-sm font-medium text-stone-700 mb-1">No reviews yet</div>
      <div className="text-xs text-stone-500">
        Once buyers receive their orders, they can leave reviews from their order page.
      </div>
    </Card>
  );
}

function EmptyFilterState({ onClear }: { onClear: () => void }) {
  return (
    <Card className="p-10 text-center" hover={false}>
      <div className="text-sm font-medium text-stone-700 mb-1">No reviews match these filters</div>
      <div className="text-xs text-stone-500 mb-3">Try widening your search.</div>
      <Button variant="neutral" size="sm" onClick={onClear}>Clear filters</Button>
    </Card>
  );
}

interface ReviewRowProps {
  review: OwnerReview;
  onReplied: () => void;
  locale: 'en' | 'bn';
}

function ReviewRow({ review, onReplied, locale }: ReviewRowProps) {
  const [replyDraft, setReplyDraft] = useState(review.owner_reply ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showEditor = editing || !review.owner_reply;
  const lowRating = review.rating <= 2;
  const midRating = review.rating === 3;
  const highRating = review.rating >= 4;

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

  const phoneDigits = review.customer_phone.replace(/\D/g, '');
  const waPhone = phoneDigits.startsWith('0') ? `880${phoneDigits.slice(1)}` : phoneDigits;

  // Color the left edge by sentiment so the seller can scan a long list and
  // immediately spot complaints versus praise.
  const accent = lowRating
    ? 'border-l-4 border-l-red-500'
    : midRating
      ? 'border-l-4 border-l-amber-500'
      : 'border-l-4 border-l-emerald-500';

  const templates = pickReplyTemplates(review.rating, review.customer_name);

  return (
    <Card className={`p-4 ${accent}`} hover={false}>
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full grid place-items-center font-semibold flex-shrink-0 ${
            lowRating
              ? 'bg-red-100 text-red-700'
              : midRating
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {review.customer_name.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-900">{review.customer_name}</span>
            <RatingChip rating={review.rating} />
            {!review.owner_reply && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Needs reply
              </span>
            )}
            <span className="text-[11px] text-stone-400 ml-auto">
              {formatDateTime(review.created_at, locale)}
            </span>
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            On{' '}
            <Link
              href={`/dashboard/products/${review.product_id}`}
              className="font-medium text-stone-700 hover:text-teal-600"
            >
              {review.product_name}
            </Link>
            {review.customer_phone && (
              <>
                {' · '}
                <span className="text-stone-500">{review.customer_phone}</span>
              </>
            )}
          </div>

          {/* Body */}
          {review.body && (
            <p className="text-[13.5px] text-stone-700 leading-relaxed mt-2 whitespace-pre-line">
              &ldquo;{review.body}&rdquo;
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

          {/* Contact buyer (only useful for low/mid-rated for follow-up) */}
          {review.customer_phone && (lowRating || midRating || !review.owner_reply) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(buildContactGreeting(review))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700"
              >
                WhatsApp buyer
              </a>
              <a
                href={`tel:${review.customer_phone}`}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium bg-teal-50 text-teal-700 hover:bg-teal-100"
              >
                Call
              </a>
              <Link
                href={`/dashboard/orders/${review.order_id}`}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              >
                View their order
              </Link>
            </div>
          )}

          {/* Existing reply (read-only display when not editing) */}
          {review.owner_reply && !editing && (
            <div className="mt-3 bg-teal-50/60 border-l-2 border-teal-500 px-3 py-2 rounded-r-md">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                  Your reply
                  {review.owner_replied_at && (
                    <span className="text-stone-400 ml-1.5 font-normal normal-case tracking-normal">
                      · {formatDateTime(review.owner_replied_at, locale)}
                    </span>
                  )}
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
              <div className="text-[13px] text-stone-700 whitespace-pre-line">
                {review.owner_reply}
              </div>
            </div>
          )}

          {/* Reply editor */}
          {showEditor && (
            <div className="mt-3">
              {templates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 self-center mr-1">
                    Suggestions:
                  </span>
                  {templates.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setReplyDraft(t.body)}
                      title={t.body}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                        highRating
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : midRating
                            ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                rows={3}
                placeholder={
                  lowRating
                    ? 'Apologise and offer to fix it. Buyers notice when sellers care.'
                    : highRating
                      ? 'Thank them — a quick reply makes loyal customers.'
                      : 'Reply to keep the buyer engaged…'
                }
                className="w-full text-sm border border-stone-300 rounded-md px-3 py-2 focus:outline-none focus:border-teal-500"
              />
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-[11px] text-stone-400">{replyDraft.length} characters</span>
                <div className="flex gap-2">
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
                  <Button variant="primary" size="sm" onClick={submit} disabled={saving}>
                    {saving ? 'Saving…' : review.owner_reply ? 'Update reply' : 'Send reply'}
                  </Button>
                </div>
              </div>
              {error && <div className="text-[12px] text-red-600 mt-1">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function RatingChip({ rating }: { rating: number }) {
  const tone =
    rating >= 4
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : rating === 3
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-red-100 text-red-800 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${tone}`}>
      {rating}.0 ★
    </span>
  );
}

// pickReplyTemplates returns rating-aware suggested replies. Templates are
// short, friendly, and personalized with the buyer's first name. The seller
// taps one to fill the textarea, then can edit before sending.
function pickReplyTemplates(rating: number, customerName: string): { label: string; body: string }[] {
  const first = (customerName || 'there').split(' ')[0];
  if (rating >= 5) {
    return [
      {
        label: 'Thank you',
        body: `Thank you so much, ${first}! 🙏 We're thrilled you loved it. Looking forward to your next order!`,
      },
      {
        label: 'Thanks + ask referral',
        body: `Thank you, ${first}! Reviews like yours mean the world. If you know anyone who'd enjoy our shop, please share us with them!`,
      },
    ];
  }
  if (rating === 4) {
    return [
      {
        label: 'Thank you',
        body: `Thanks for the kind review, ${first}! Glad you're happy with your purchase.`,
      },
      {
        label: 'Ask what to improve',
        body: `Thank you for the review, ${first}! We'd love to know what we could do to earn that 5th star next time. Just reply here!`,
      },
    ];
  }
  if (rating === 3) {
    return [
      {
        label: 'Acknowledge',
        body: `Thank you for the honest feedback, ${first}. We'd love to know what could have made it a 5-star experience — we read every reply.`,
      },
      {
        label: 'Offer follow-up',
        body: `Thanks for sharing your thoughts, ${first}. Could you tell us a bit more about what fell short? We want to make it right for you.`,
      },
    ];
  }
  // 1–2 stars
  return [
    {
      label: 'Apologise + offer help',
      body: `So sorry to hear this, ${first}. We'd really like to make it right — please reply here or on WhatsApp and we'll sort it out for you straight away.`,
    },
    {
      label: 'Offer replacement',
      body: `${first}, we're really sorry. If the product arrived damaged or wasn't as expected, we'd like to send a replacement or refund. Please reply with what happened.`,
    },
    {
      label: 'Thank for honest feedback',
      body: `Thank you for the honest feedback, ${first}. We're taking it seriously and will reach out shortly to make this right.`,
    },
  ];
}

function buildContactGreeting(review: OwnerReview): string {
  const first = (review.customer_name || 'there').split(' ')[0];
  if (review.rating <= 2) {
    return `Hello ${first}, I just saw your review on "${review.product_name}". I'm really sorry it didn't meet your expectations. Could we sort this out? — your shop`;
  }
  if (review.rating === 3) {
    return `Hello ${first}, thank you for your review on "${review.product_name}". I'd love to hear what we could do better next time — your shop`;
  }
  return `Hello ${first}, thank you so much for your lovely review on "${review.product_name}"! 🙏 — your shop`;
}
