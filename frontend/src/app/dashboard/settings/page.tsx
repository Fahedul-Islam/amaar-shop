'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useShop } from '@/hooks/useShop';
import { updateMyShop, uploadLogo, uploadBanner, getDeliverySettings } from '@/lib/shopApi';
import { ApiRequestError } from '@/lib/api';

const DESC_MAX = 150;

export default function ShopSettingsPage() {
  const { shop, refetch } = useShop();
  const { data: delivery } = useQuery({
    queryKey: ['delivery'],
    queryFn: getDeliverySettings,
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shop) {
      setName(shop.name);
      setDescription(shop.description);
      setPhone(shop.contact_phone);
    }
  }, [shop]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await updateMyShop({ name: name.trim(), description: description.trim(), contact_phone: phone.trim() });
      refetch();
      setMsg('Settings saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (f: File) => {
    try {
      await uploadLogo(f);
      refetch();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Logo upload failed');
    }
  };

  const onBanner = async (f: File) => {
    try {
      await uploadBanner(f);
      refetch();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Banner upload failed');
    }
  };

  if (!shop) return null;

  const checklist = [
    { label: 'Shop name & description', done: !!shop.name && !!shop.description },
    { label: 'Upload logo', done: !!shop.logo_url },
    { label: 'Upload banner', done: !!shop.banner_url },
    { label: 'Delivery zones configured', done: !!(delivery?.delivery_zones && delivery.delivery_zones.length > 0) },
    { label: 'Advance payment setup', done: !!delivery?.advance_payment_required },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-3xl">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mb-1">Settings</h1>
      <p className="text-stone-500 mb-5">Shop details, delivery, and branding.</p>

      <div className="grid gap-4">
        {/* Setup checklist */}
        {!allDone && (
          <Card className="p-5" hover={false}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Shop setup checklist</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Complete these to get the most out of your shop.
                </p>
              </div>
              <div className="text-sm font-semibold text-teal-700">
                {doneCount}/{checklist.length}
              </div>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{ width: `${(doneCount / checklist.length) * 100}%` }}
              />
            </div>
            <ul className="grid gap-1.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-4 h-4 rounded-full grid place-items-center text-[10px] font-bold ${
                      item.done
                        ? 'bg-teal-500 text-white'
                        : 'bg-stone-200 text-stone-400'
                    }`}
                    aria-hidden
                  >
                    {item.done ? '✓' : ''}
                  </span>
                  <span className={item.done ? 'text-stone-500 line-through' : 'text-stone-700'}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Shop details */}
        <Card className="p-5 grid gap-3.5" hover={false}>
          <h3 className="text-sm font-semibold">Shop details</h3>
          <form onSubmit={save} className="grid gap-3.5">
            <Input label="Shop name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <Textarea
                label="Short description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                placeholder="What makes your shop unique?"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-stone-500">
                  💡 Mention what makes your shop special.
                </p>
                <span className={`text-xs ${description.length >= DESC_MAX ? 'text-red-500' : 'text-stone-400'}`}>
                  {description.length}/{DESC_MAX}
                </span>
              </div>
            </div>
            <Input label="Contact phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Shop URL" value={`/s/${shop.slug}`} readOnly helper="Contact support to change this." />
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
                {error}
              </div>
            )}
            {msg && (
              <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-4 py-3">
                ✅ {msg}
              </div>
            )}
            <div>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Branding */}
        <Card className="p-5 grid gap-4" hover={false}>
          <div>
            <h3 className="text-sm font-semibold">Branding</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Make your storefront recognizable with a logo and banner.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <UploadTile
              label="Logo"
              hint="Recommended 200×200px, PNG or JPG"
              imageUrl={shop.logo_url}
              aspect="square"
              onFile={onLogo}
            />
            <UploadTile
              label="Banner"
              hint="Recommended 1200×400px, PNG or JPG"
              imageUrl={shop.banner_url}
              aspect="wide"
              onFile={onBanner}
            />
          </div>
        </Card>

        {/* Delivery link */}
        <Card className="p-5" hover={false}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-0.5">Delivery & payments</h3>
              <p className="text-sm text-stone-500">
                Configure delivery zones, charges, and advance payment rules.
              </p>
            </div>
            {!checklist[3].done && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                Setup needed
              </span>
            )}
          </div>
          <div className="mt-3">
            <Link href="/dashboard/settings/delivery">
              <Button variant="secondary" size="sm">Open delivery settings</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function UploadTile({
  label,
  hint,
  imageUrl,
  aspect,
  onFile,
}: {
  label: string;
  hint: string;
  imageUrl?: string | null;
  aspect: 'square' | 'wide';
  onFile: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = `upload-${label.toLowerCase()}`;
  const aspectClass = aspect === 'square' ? 'aspect-square' : 'aspect-[3/1]';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  };

  return (
    <div>
      <label className="text-sm font-medium text-stone-700 block mb-1.5">{label}</label>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`block w-full ${aspectClass} rounded-lg border-2 border-dashed cursor-pointer overflow-hidden transition-colors ${
          dragging
            ? 'border-teal-400 bg-teal-50'
            : imageUrl
              ? 'border-stone-200'
              : 'border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-stone-400'
        }`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-center px-3">
            <div>
              <div className="text-stone-400 text-2xl mb-1">🖼️</div>
              <div className="text-xs font-medium text-stone-600">
                Drag & drop or click to upload
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">{hint}</div>
            </div>
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>
      {imageUrl && (
        <label htmlFor={inputId} className="text-xs text-teal-600 hover:underline cursor-pointer mt-1.5 inline-block">
          Replace {label.toLowerCase()}
        </label>
      )}
    </div>
  );
}
