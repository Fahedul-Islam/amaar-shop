'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IcX, IcCheck } from '@/components/icons/Icons';
import { ApiRequestError } from '@/lib/api';
import { REPORT_REASONS, submitShopReport } from '@/lib/reportApi';
import { useI18n } from '@/hooks/useI18n';

// ReportShopButton renders a quiet "Report this shop" link plus a modal that
// lets a buyer submit a complaint anonymously or with contact info.
// Submitted reports show up on the admin dashboard for review.
export function ReportShopButton({ shopSlug, shopName }: { shopSlug: string; shopName: string }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setReason('');
    setDescription('');
    setName('');
    setPhone('');
    setError(null);
    setSubmitted(false);
    setSubmitting(false);
  };

  const close = () => {
    setOpen(false);
    // Reset after the close animation completes — gives the user a moment
    // to see the success state if it just rendered.
    setTimeout(reset, 200);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason) {
      setError(locale === 'bn' ? 'একটি কারণ নির্বাচন করুন' : 'Pick a reason');
      return;
    }
    if (description.trim().length < 10) {
      setError(
        locale === 'bn'
          ? 'অনুগ্রহ করে কমপক্ষে ১০ অক্ষরের বিবরণ লিখুন'
          : 'Please describe what happened (at least 10 characters)',
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitShopReport(shopSlug, {
        reason,
        description: description.trim(),
        reporter_name: name.trim() || undefined,
        reporter_phone: phone.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError(
          locale === 'bn'
            ? 'রিপোর্ট জমা দেওয়া যায়নি। পরে চেষ্টা করুন।'
            : "We couldn't submit your report. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-stone-500 hover:text-red-600 underline underline-offset-2 transition-colors"
      >
        {locale === 'bn' ? 'এই দোকান সম্পর্কে রিপোর্ট করুন' : 'Report this shop'}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-5 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold flex-1">
                {locale === 'bn' ? 'দোকান সম্পর্কে রিপোর্ট করুন' : 'Report a shop'}
              </h2>
              <button
                onClick={close}
                className="text-stone-400 hover:text-stone-700"
                aria-label="Close"
              >
                <IcX size={18} />
              </button>
            </div>

            {submitted ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-3">
                  <IcCheck size={26} />
                </div>
                <h3 className="text-base font-semibold text-stone-900">
                  {locale === 'bn' ? 'রিপোর্ট জমা হয়েছে' : 'Report submitted'}
                </h3>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                  {locale === 'bn'
                    ? 'আপনার রিপোর্টের জন্য ধন্যবাদ। আমাদের টিম এটি পর্যালোচনা করবে এবং প্রয়োজনে ব্যবস্থা নেবে।'
                    : "Thanks for letting us know. Our team will review your report and take action if needed."}
                </p>
                <Button variant="primary" className="mt-5 w-full" onClick={close}>
                  {locale === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 grid gap-4">
                <p className="text-sm text-stone-600 leading-relaxed">
                  {locale === 'bn' ? (
                    <>
                      আপনার রিপোর্ট <strong>{shopName}</strong> সম্পর্কে আমাদের অ্যাডমিন
                      টিমকে জানাবে। অপব্যবহার রিপোর্ট অজ্ঞাতনামাও জমা দেওয়া যায়।
                    </>
                  ) : (
                    <>
                      Tell our admin team what's wrong with <strong>{shopName}</strong>.
                      You can report anonymously, or share your contact details if you want
                      a follow-up.
                    </>
                  )}
                </p>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {locale === 'bn' ? 'কারণ' : 'Reason'}
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-white border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100"
                  >
                    <option value="">
                      {locale === 'bn' ? '— একটি কারণ নির্বাচন করুন —' : '— Choose a reason —'}
                    </option>
                    {REPORT_REASONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {locale === 'bn' ? 'কী হয়েছিল?' : 'What happened?'}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      locale === 'bn'
                        ? 'অনুগ্রহ করে যত বিস্তারিত সম্ভব ব্যাখ্যা করুন…'
                        : 'Please describe in detail — the more we know, the better we can help.'
                    }
                    rows={4}
                    minLength={10}
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={locale === 'bn' ? 'আপনার নাম (ঐচ্ছিক)' : 'Your name (optional)'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={locale === 'bn' ? 'যেমন: করিম' : 'e.g. Karim'}
                  />
                  <Input
                    label={locale === 'bn' ? 'ফোন (ঐচ্ছিক)' : 'Phone (optional)'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    type="tel"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="neutral" onClick={close} disabled={submitting}>
                    {locale === 'bn' ? 'বাতিল' : 'Cancel'}
                  </Button>
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting
                      ? locale === 'bn'
                        ? 'জমা হচ্ছে…'
                        : 'Submitting…'
                      : locale === 'bn'
                        ? 'রিপোর্ট জমা দিন'
                        : 'Submit report'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
