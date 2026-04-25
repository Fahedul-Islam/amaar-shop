'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useShop } from '@/hooks/useShop';
import { updateMyShop, uploadLogo, uploadBanner } from '@/lib/shopApi';
import { ApiRequestError } from '@/lib/api';

export default function ShopSettingsPage() {
  const { shop, refetch } = useShop();
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

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-3xl">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mb-1">Settings</h1>
      <p className="text-stone-500 mb-5">Shop details, delivery, and branding.</p>

      <div className="grid gap-4">
        <Card className="p-5 grid gap-3.5" hover={false}>
          <h3 className="text-sm font-semibold">Shop details</h3>
          <form onSubmit={save} className="grid gap-3.5">
            <Input label="Shop name" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea label="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input label="Contact phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Shop URL" value={`/s/${shop.slug}`} readOnly helper="Contact support to change this." />
            {error && <div className="text-sm text-red-600">{error}</div>}
            {msg && <div className="text-sm text-teal-700">{msg}</div>}
            <div>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5 grid gap-4" hover={false}>
          <h3 className="text-sm font-semibold">Branding</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1.5">Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg border border-stone-200 overflow-hidden bg-stone-100">
                  {shop.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shop.logo_url} alt="logo" className="w-full h-full object-cover" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
                  <Button type="button" variant="secondary" size="sm" onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement)?.click()}>
                    Upload
                  </Button>
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1.5">Banner</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-14 rounded-md border border-stone-200 overflow-hidden bg-stone-100">
                  {shop.banner_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shop.banner_url} alt="banner" className="w-full h-full object-cover" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onBanner(e.target.files[0])} />
                  <Button type="button" variant="secondary" size="sm" onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement)?.click()}>
                    Upload
                  </Button>
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5" hover={false}>
          <h3 className="text-sm font-semibold mb-1.5">Delivery & payments</h3>
          <p className="text-sm text-stone-500 mb-3">Configure delivery zones, charges, and advance payment rules.</p>
          <Link href="/dashboard/settings/delivery">
            <Button variant="secondary" size="sm">Open delivery settings</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
