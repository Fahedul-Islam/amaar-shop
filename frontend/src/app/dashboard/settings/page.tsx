"use client";
import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IcCheck } from '@/components/icons/Icons';
import { useShop } from '@/hooks/useShop';
import { updateMyShop, uploadLogo, uploadBanner } from '@/lib/shopApi';
import { ApiRequestError } from '@/lib/api';
import { SettingsSection, FieldRow, PrettyInput, UploadTile } from './SettingsSections';
const DESC_MAX = 150;
export default function ShopSettingsPage() {
 const { shop, refetch } = useShop();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shop) {
      setName(shop.name);
      setDescription(shop.description ?? '');
      setPhone(shop.contact_phone ?? '');
    }
  }, [shop]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await updateMyShop({
        name: name.trim(),
        description: description.trim(),
        contact_phone: phone.trim(),
      });
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

  const copyURL = async () => {
    if (!shop || typeof window === 'undefined') return;
    const url = `${window.location.origin}/s/${shop.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore — clipboard may be unavailable in non-secure contexts
    }
  };

  useEffect(() => {
    const target = { '#courier': '/dashboard/settings/courier', '#meta': '/dashboard/settings/tracking', '#tracking': '/dashboard/settings/tracking' }[window.location.hash];
    if (target) window.location.replace(target);
  }, []);
 if (!shop) return null;
 return <div className="max-w-3xl px-5 py-7 md:px-8">
   <h1 className="text-2xl font-semibold">Shop details</h1>
   <p className="text-sm text-stone-500 mt-2 mb-6">Your shop name, customer contact number, and storefront images.</p>
   <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4 mb-6">
     <div className="min-w-0"><p className="text-sm font-medium">Your storefront link</p><p className="text-sm text-stone-500 break-all">/s/{shop.slug}</p></div>
     <Button variant="neutral" onClick={copyURL}>{copied ? 'Copied' : 'Copy shop link'}</Button>
   </div>
   <div className="space-y-6">          {/* Shop details */}
          <SettingsSection
            id="shop-details"
          >
            <form onSubmit={save} className="grid gap-5">
              <FieldRow
                label="Shop name"
              >
                <PrettyInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rihad Jersey Store"
                />
              </FieldRow>

              <FieldRow
                label="Short description"
                meta={
                  <span
                    className={`text-xs ${
                      description.length >= DESC_MAX
                        ? 'text-red-500'
                        : 'text-stone-400'
                    }`}
                  >
                    {description.length}/{DESC_MAX}
                  </span>
                }
              >
                <Textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value.slice(0, DESC_MAX))
                  }
                  placeholder="Authentic football jerseys, fast Dhaka delivery."
                />
              </FieldRow>

              <FieldRow
                label="Contact phone"
                hint="Customers can call this number from your storefront."
              >
                <PrettyInput
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01712 345 678"
                  inputMode="tel"
                />
              </FieldRow>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
              {msg && (
                <div className="text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500 text-white grid place-items-center flex-shrink-0">
                    <IcCheck size={12} />
                  </span>
                  {msg}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </SettingsSection>

          {/* Branding */}
          <SettingsSection
            id="branding"
            title="Shop images"
            subtitle="Upload or replace your logo and banner."
          >
            <div className="grid md:grid-cols-2 gap-5">
              <UploadTile
                label="Logo"
                hint="Square image · 200×200 or larger"
                imageUrl={shop.logo_url}
                aspect="square"
                onFile={onLogo}
              />
              <UploadTile
                label="Banner"
                hint="Wide image · 1200×400 recommended"
                imageUrl={shop.banner_url}
                aspect="wide"
                onFile={onBanner}
              />
            </div>
          </SettingsSection>

</div>
 </div>;
}
