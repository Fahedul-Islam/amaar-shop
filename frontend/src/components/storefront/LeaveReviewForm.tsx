'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { createReview, uploadReviewImage } from '@/lib/reviewApi';
import { ApiRequestError } from '@/lib/api';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  orderItemId: string;
  productName: string;
  customerPhone: string;
  // alreadyReviewed indicates that the order item already has a review,
  // in which case we render a small "thanks" line instead of the form.
  alreadyReviewed?: boolean;
  onDone?: () => void;
}

export function LeaveReviewForm({ orderItemId, productName, customerPhone, alreadyReviewed, onDone }: Props) {
  const { locale } = useI18n();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyReviewed ?? false);

  if (done) {
    return (
      <div className="text-[13px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
        {locale === 'bn' ? 'রিভিউয়ের জন্য ধন্যবাদ!' : 'Thanks for your review!'}
      </div>
    );
  }

  const handleImage = async (file: File) => {
    setError(null);
    try {
      const { url } = await uploadReviewImage(file);
      setImageURL(url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Image upload failed');
    }
  };

  const submit = async () => {
    setError(null);
    if (rating < 1) {
      setError(locale === 'bn' ? 'অনুগ্রহ করে রেটিং দিন' : 'Please pick a rating');
      return;
    }
    setSubmitting(true);
    try {
      await createReview({
        order_item_id: orderItemId,
        customer_phone: customerPhone,
        rating,
        body: body.trim(),
        image_url: imageURL,
      });
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4" hover={false}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-sm font-medium text-stone-900 truncate">{productName}</div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <StarRating value={rating} size={22} onChange={setRating} />
        {rating > 0 && (
          <span className="text-[12px] text-stone-500">
            {rating}/5
          </span>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={locale === 'bn' ? 'আপনার অভিজ্ঞতা শেয়ার করুন (ঐচ্ছিক)' : 'Share your experience (optional)'}
        className="w-full text-sm border border-stone-300 rounded-md px-3 py-2 mb-2 focus:outline-none focus:border-teal-500"
      />

      <div className="flex items-center gap-3 mb-2">
        <label className="text-xs text-teal-700 font-medium cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImage(f);
            }}
          />
          {imageURL
            ? (locale === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change photo')
            : (locale === 'bn' ? '+ ছবি যোগ করুন (ঐচ্ছিক)' : '+ Add photo (optional)')}
        </label>
        {imageURL && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageURL} alt="" className="w-12 h-12 rounded-md object-cover border border-stone-200" />
        )}
      </div>

      {error && <div className="text-[12px] text-red-600 mb-2">{error}</div>}

      <Button variant="primary" size="sm" onClick={submit} disabled={submitting}>
        {submitting
          ? (locale === 'bn' ? 'পাঠানো হচ্ছে…' : 'Submitting…')
          : (locale === 'bn' ? 'রিভিউ পাঠান' : 'Submit review')}
      </Button>
    </Card>
  );
}
