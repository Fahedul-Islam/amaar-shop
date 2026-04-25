'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { checkSlug, createShop } from '@/lib/shopApi';
import { ApiRequestError } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

export default function ShopSetupPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [slugAvail, setSlugAvail] = useState<'unknown' | 'checking' | 'ok' | 'taken'>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();

  // Derive slug from name if user hasn't touched it
  const [slugTouched, setSlugTouched] = useState(false);
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Slug availability check
  useEffect(() => {
    if (!slug) {
      setSlugAvail('unknown');
      return;
    }
    let cancelled = false;
    setSlugAvail('checking');
    const t = setTimeout(() => {
      checkSlug(slug)
        .then((r) => !cancelled && setSlugAvail(r.available ? 'ok' : 'taken'))
        .catch(() => !cancelled && setSlugAvail('unknown'));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      await createShop({
        name: name.trim(),
        slug,
        description: description.trim(),
        contact_phone: phone.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: ['my-shop'] });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create shop');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-57px)] py-8 px-4 bg-stone-50">
      <div className="max-w-[560px] mx-auto">
        <div className="mb-5">
          <Logo size={26} />
          <div className="flex gap-1.5 mt-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-teal-600' : 'bg-stone-200'}`} />
            ))}
          </div>
          <div className="text-xs text-stone-500 mt-2">Step {step} of 3</div>
        </div>

        <Card className="p-6" hover={false}>
          {step === 1 && (
            <>
              <h1 className="text-[22px] font-bold tracking-tight mb-1.5">Let&rsquo;s set up your shop</h1>
              <p className="text-stone-500 text-sm mb-5">Start with what people will see.</p>
              <div className="grid gap-3">
                <Input
                  label="Shop name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rifat's Store"
                />
                <Input
                  label="Shop URL"
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                  placeholder="rifats-store"
                  helper={
                    slug
                      ? slugAvail === 'checking' ? 'Checking…'
                      : slugAvail === 'ok' ? `Available: /s/${slug}`
                      : slugAvail === 'taken' ? 'This URL is already taken'
                      : `/s/${slug}`
                      : 'Used in your shop link.'
                  }
                />
                <Textarea
                  label="Short description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Everyday clothing, thoughtfully made"
                />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-[22px] font-bold tracking-tight mb-1.5">Contact details</h1>
              <p className="text-stone-500 text-sm mb-5">Buyers may reach out if they have questions.</p>
              <Input label="Contact phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01712 345 678" />
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="text-[22px] font-bold tracking-tight mb-1.5">Ready to launch</h1>
              <p className="text-stone-500 text-sm mb-5">You can add products and configure delivery once your shop is created.</p>
              <ul className="text-sm text-stone-700 list-disc pl-5 space-y-1.5">
                <li>Name: <strong>{name}</strong></li>
                <li>URL: <code className="font-mono">/s/{slug}</code></li>
                {description && <li>Description: {description}</li>}
                {phone && <li>Phone: {phone}</li>}
              </ul>
            </>
          )}

          {error && <div className="text-sm text-red-600 mt-3">{error}</div>}

          <div className="flex gap-2.5 mt-6">
            {step > 1 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>}
            <div className="flex-1" />
            {step < 3 ? (
              <Button
                variant="primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && (!name.trim() || !slug || slugAvail === 'taken' || slugAvail === 'checking')}
              >
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={create} disabled={saving}>
                {saving ? 'Creating…' : 'Create shop'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
