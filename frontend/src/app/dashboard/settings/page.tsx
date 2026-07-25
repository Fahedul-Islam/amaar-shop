'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { hueFromString } from '@/components/ui/ProductImage';
import {
  IcStore,
  IcImage,
  IcTruck,
  IcCheck,
  IcCopy,
  IcChevR,
  IcTag,
  IcPackage,
  IcFacebook,
} from '@/components/icons/Icons';
import { useShop } from '@/hooks/useShop';
import {
  updateMyShop,
  uploadLogo,
  uploadBanner,
  getDeliverySettings,
} from '@/lib/shopApi';
import { getCourierSettings, updateCourierSettings } from '@/lib/courierApi';
import { getMetaSettings, updateMetaSettings } from '@/lib/trackingApi';
import { ApiRequestError } from '@/lib/api';
import type { ReactNode } from 'react';

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
  const [copied, setCopied] = useState(false);

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

  if (!shop) return null;

  const checklist = [
    {
      label: 'Shop name & description',
      done: !!shop.name && !!shop.description,
      href: '#shop-details',
    },
    { label: 'Upload logo', done: !!shop.logo_url, href: '#branding' },
    { label: 'Upload banner', done: !!shop.banner_url, href: '#branding' },
    {
      label: 'Delivery configured',
      done: !!delivery?.is_configured,
      href: '/dashboard/settings/delivery',
    },
    {
      label: 'Advance payment setup',
      done: !!delivery?.advance_payment_required,
      href: '/dashboard/settings/delivery',
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;
  const progressPct = Math.round((doneCount / checklist.length) * 100);
  const hue = hueFromString(shop.id);

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-[1180px]">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-amber-50 mb-6 md:mb-7">
        {shop.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.banner_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-15"
          />
        )}
        <div className="relative px-5 md:px-7 py-6 md:py-7 flex flex-col md:flex-row md:items-center gap-5">
          <div
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-white shadow-md grid place-items-center font-bold overflow-hidden flex-shrink-0"
            style={{
              background: `hsl(${hue},32%,88%)`,
              color: `hsl(${hue},32%,28%)`,
              fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
            }}
          >
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logo_url}
                alt={shop.name}
                className="w-full h-full object-cover"
              />
            ) : (
              shop.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 mb-1">
              Shop settings
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900 truncate">
              {shop.name}
            </h1>
            <p className="text-sm text-stone-600 mt-0.5">
              amaarshop.com<span className="text-stone-400">/s/</span>
              <span className="font-semibold text-stone-800">{shop.slug}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:flex-shrink-0">
            <Link href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">
              <Button variant="primary" size="md">
                <IcStore size={16} /> View storefront
              </Button>
            </Link>
            <Button variant="neutral" size="md" onClick={copyURL}>
              {copied ? (
                <>
                  <IcCheck size={16} className="text-teal-600" /> Copied
                </>
              ) : (
                <>
                  <IcCopy size={16} /> Copy URL
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* MAIN COLUMN */}
        <div className="grid gap-5">
          {/* Shop details */}
          <SettingsSection
            id="shop-details"
            icon={<IcStore size={18} />}
            iconColor="teal"
            title="Shop details"
            subtitle="Shown on your storefront and on the marketplace."
          >
            <form onSubmit={save} className="grid gap-5">
              <FieldRow
                label="Shop name"
                hint="The name customers will see at the top of your storefront."
              >
                <PrettyInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rihad Jersey Store"
                />
              </FieldRow>

              <FieldRow
                label="Short description"
                hint="One line that explains what makes your shop special."
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
            icon={<IcImage size={18} />}
            iconColor="amber"
            title="Branding"
            subtitle="A logo and banner help your storefront stand out."
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

          {/* Delivery */}
          <SettingsSection
            icon={<IcTruck size={18} />}
            iconColor="indigo"
            title="Delivery & payments"
            subtitle="What customers pay for delivery at checkout."
            badge={
              !delivery?.is_configured ? (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-800 bg-amber-100 px-2 py-1 rounded-full">
                  Setup needed
                </span>
              ) : null
            }
          >
            {delivery?.is_configured ? (
              <>
                <div className="grid gap-1.5 mb-4">
                  {(delivery.delivery_zones ?? []).map((z) => (
                    <SummaryRow
                      key={`${z.division}-${z.id ?? ''}`}
                      label={z.division}
                      value={`৳${Number(z.delivery_charge).toFixed(0)}`}
                      accent
                    />
                  ))}
                  <SummaryRow
                    label="All other areas"
                    value={
                      parseFloat(delivery.delivery_charge) > 0
                        ? `৳${Number(delivery.delivery_charge).toFixed(0)}`
                        : 'Free'
                    }
                    muted={parseFloat(delivery.delivery_charge) <= 0}
                  />
                </div>
                {(delivery.free_delivery_threshold ||
                  delivery.advance_payment_required) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {delivery.free_delivery_threshold && (
                      <Pill>
                        🎁 Free delivery above ৳
                        {Number(delivery.free_delivery_threshold).toFixed(0)}
                      </Pill>
                    )}
                    {delivery.advance_payment_required && (
                      <Pill>💳 Advance payment required</Pill>
                    )}
                  </div>
                )}
                <Link href="/dashboard/settings/delivery">
                  <Button variant="secondary" size="sm">
                    Edit delivery settings <IcChevR size={14} />
                  </Button>
                </Link>
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm text-amber-900 font-medium mb-2">
                  Delivery isn&apos;t configured yet.
                </p>
                <p className="text-sm text-amber-800 mb-3">
                  Customers can&apos;t place orders until you set this up.
                </p>
                <Link href="/dashboard/settings/delivery">
                  <Button variant="primary" size="sm">
                    Set up delivery
                  </Button>
                </Link>
              </div>
            )}
          </SettingsSection>

          {/* Courier */}
          <CourierSettingsSection />

          {/* Meta conversion tracking */}
          <MetaTrackingSection />
        </div>

        {/* SIDEBAR */}
        <div className="grid gap-5 lg:sticky lg:top-6 lg:self-start">
          {/* Setup progress with donut */}
          <Card className="p-5 md:p-6 bg-gradient-to-br from-white to-teal-50/40 border-teal-100" hover={false}>
            <div className="flex items-center gap-4 mb-4">
              <ProgressRing pct={progressPct} />
              <div className="min-w-0">
                <h3 className="text-base font-bold text-stone-900">
                  {allDone ? 'All set!' : 'Setup progress'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {allDone
                    ? 'Your shop is ready to take orders.'
                    : `${checklist.length - doneCount} step${
                        checklist.length - doneCount === 1 ? '' : 's'
                      } left to a complete shop.`}
                </p>
              </div>
            </div>
            <ul className="grid gap-1">
              {checklist.map((item) => {
                const inner = (
                  <span
                    className={`flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-md ${
                      item.done
                        ? 'text-stone-400'
                        : 'text-stone-800 hover:bg-white hover:shadow-sm cursor-pointer transition-shadow'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full grid place-items-center flex-shrink-0 ${
                        item.done
                          ? 'bg-teal-500 text-white'
                          : 'border-2 border-stone-300 bg-white'
                      }`}
                      aria-hidden
                    >
                      {item.done ? <IcCheck size={12} /> : null}
                    </span>
                    <span className={item.done ? 'line-through' : 'font-medium'}>
                      {item.label}
                    </span>
                  </span>
                );
                return (
                  <li key={item.label}>
                    {item.done ? (
                      inner
                    ) : item.href.startsWith('/') ? (
                      <Link href={item.href}>{inner}</Link>
                    ) : (
                      <a href={item.href}>{inner}</a>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Quick links — large, icon-led tiles */}
          <Card className="p-5 md:p-6" hover={false}>
            <h3 className="text-base font-bold text-stone-900 mb-1">Manage</h3>
            <p className="text-xs text-stone-500 mb-4">
              Jump to other parts of your shop.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <QuickTile
                href="/dashboard/products"
                icon={<IcPackage size={18} />}
                label="Products"
                color="teal"
              />
              <QuickTile
                href="/dashboard/categories"
                icon={<IcTag size={18} />}
                label="Categories"
                color="amber"
              />
              <QuickTile
                href="/dashboard/settings/delivery"
                icon={<IcTruck size={18} />}
                label="Delivery"
                color="indigo"
              />
              <QuickTile
                href="/dashboard/facebook"
                icon={<IcFacebook size={18} />}
                label="Facebook"
                color="blue"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Courier settings ────────────────────────────────────────── */

function CourierSettingsSection() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['courier-settings'],
    queryFn: getCourierSettings,
  });
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setEnabled(settings.enabled);
  }, [settings]);

  const configured = !!settings?.configured;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await updateCourierSettings({
        api_key: apiKey.trim(),
        secret_key: secretKey.trim(),
        enabled,
      });
      setApiKey('');
      setSecretKey('');
      qc.invalidateQueries({ queryKey: ['courier-settings'] });
      setMsg('Courier settings saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      icon={<IcTruck size={18} />}
      iconColor="blue"
      title="Courier — Steadfast"
      subtitle="Book parcels and pull tracking IDs automatically from any confirmed order."
      badge={
        configured ? (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-teal-800 bg-teal-100 px-2 py-1 rounded-full">
            <IcCheck size={11} /> Connected
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 bg-stone-100 px-2 py-1 rounded-full">
            Optional
          </span>
        )
      }
    >
      <p className="text-sm text-stone-600 mb-5 leading-relaxed">
        Paste the <strong className="font-semibold text-stone-800">Api-Key</strong> and{' '}
        <strong className="font-semibold text-stone-800">Secret-Key</strong> from your Steadfast
        merchant portal (Settings → API). Your keys are stored securely and never shown again.{' '}
        <a
          href="https://steadfast.com.bd"
          target="_blank"
          rel="noreferrer"
          className="text-teal-700 font-medium hover:underline"
        >
          Steadfast portal ↗
        </a>
      </p>

      <form onSubmit={save} className="grid gap-5">
        <FieldRow
          label="Api-Key"
          hint={configured ? 'Leave blank to keep your saved key.' : undefined}
        >
          <PrettyInput
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={configured ? '•••••••• (saved)' : 'Your Steadfast Api-Key'}
            autoComplete="off"
          />
        </FieldRow>

        <FieldRow
          label="Secret-Key"
          hint={configured ? 'Leave blank to keep your saved secret.' : undefined}
        >
          <PrettyInput
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder={configured ? '•••••••• (saved)' : 'Your Steadfast Secret-Key'}
            autoComplete="off"
          />
        </FieldRow>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-stone-800">
            Enable one-click Steadfast booking on order pages
          </span>
        </label>

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
            {saving ? 'Saving…' : 'Save courier settings'}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

/* ── Meta conversion tracking ────────────────────────────────── */

function MetaTrackingSection() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['meta-settings'],
    queryFn: getMetaSettings,
  });
  const [pixelId, setPixelId] = useState('');
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [trackDelivered, setTrackDelivered] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setTrackDelivered(settings.track_delivered);
    }
  }, [settings]);

  const configured = !!settings?.configured;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await updateMetaSettings({
        pixel_id: pixelId.trim(),
        access_token: token.trim(),
        enabled,
        track_delivered: trackDelivered,
      });
      setPixelId('');
      setToken('');
      qc.invalidateQueries({ queryKey: ['meta-settings'] });
      setMsg('Meta tracking settings saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      icon={<IcFacebook size={18} />}
      iconColor="blue"
      title="Facebook ad tracking"
      subtitle="Tell Meta which orders actually turned into money, so your ads find more buyers like them."
      badge={
        configured ? (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-teal-800 bg-teal-100 px-2 py-1 rounded-full">
            <IcCheck size={11} /> Connected
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 bg-stone-100 px-2 py-1 rounded-full">
            Optional
          </span>
        )
      }
    >
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 mb-5">
        <p className="text-[13px] text-blue-900 leading-relaxed">
          Find both values in{' '}
          <strong className="font-semibold">
            Meta Events Manager → your dataset → Settings
          </strong>
          . Copy the <strong className="font-semibold">Dataset (Pixel) ID</strong>, then scroll to
          Conversions API and press <strong className="font-semibold">Generate access token</strong>.
        </p>
      </div>

      <form onSubmit={save} className="grid gap-5">
        <FieldRow
          label="Pixel / Dataset ID"
          hint={configured ? 'Leave blank to keep the saved ID.' : undefined}
        >
          <PrettyInput
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            placeholder={configured ? '•••••••• (saved)' : 'e.g. 1234567890123456'}
            autoComplete="off"
            inputMode="numeric"
          />
        </FieldRow>

        <FieldRow
          label="Conversions API access token"
          hint={configured ? 'Leave blank to keep the saved token.' : undefined}
        >
          <PrettyInput
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={configured ? '•••••••• (saved)' : 'Paste the generated token'}
            autoComplete="off"
          />
        </FieldRow>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-stone-800">
            Send conversions to Meta
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-teal-100 bg-teal-50/50 px-3.5 py-3">
          <input
            type="checkbox"
            checked={trackDelivered}
            onChange={(e) => setTrackDelivered(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-stone-800">
            <strong className="font-semibold">Also report deliveries</strong> — recommended
            <span className="block text-xs text-stone-600 mt-0.5 leading-relaxed">
              Cash on delivery means an order isn&rsquo;t money until the buyer accepts it.
              Reporting deliveries teaches Meta to find people who actually take the parcel,
              instead of ones who refuse it at the door.
            </span>
          </span>
        </label>

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

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <p className="text-xs text-stone-500 max-w-sm">
            Customer phone and name are encrypted (hashed) before sending — Meta never
            receives readable customer details.
          </p>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save tracking settings'}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

/* ── Subcomponents ───────────────────────────────────────────── */

const iconBgMap: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-700',
  amber: 'bg-amber-100 text-amber-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  blue: 'bg-blue-100 text-blue-700',
};

function SettingsSection({
  id,
  icon,
  iconColor,
  title,
  subtitle,
  badge,
  children,
}: {
  id?: string;
  icon: ReactNode;
  iconColor: 'teal' | 'amber' | 'indigo' | 'blue';
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="p-5 md:p-6" hover={false}>
      <div className="flex items-start gap-3 mb-5">
        <div
          className={`w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 ${iconBgMap[iconColor]}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight text-stone-900">
              {title}
            </h2>
            {badge}
          </div>
          <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function FieldRow({
  label,
  hint,
  meta,
  children,
}: {
  label: string;
  hint?: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label className="block text-sm font-semibold text-stone-900">
          {label}
        </label>
        {meta}
      </div>
      {children}
      {hint && <p className="text-xs text-stone-500 mt-1.5">{hint}</p>}
    </div>
  );
}

function PrettyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-11 px-3.5 bg-white border border-stone-300 rounded-lg text-[15px] text-stone-900 placeholder-stone-400 transition-colors duration-150 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 ${
        props.className ?? ''
      }`}
    />
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
  accent = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border ${
        accent
          ? 'bg-teal-50/60 border-teal-100'
          : 'bg-stone-50 border-stone-100'
      }`}
    >
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <span
        className={`text-sm font-bold ${
          muted ? 'text-stone-500' : 'text-stone-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-medium">
      {children}
    </span>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={r}
          stroke="#e7e5e4"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          stroke="#0d9488"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold text-stone-900">
        {pct}%
      </span>
    </div>
  );
}

const tileColorMap: Record<string, string> = {
  teal: 'bg-teal-50 text-teal-700 group-hover:bg-teal-100',
  amber: 'bg-amber-50 text-amber-700 group-hover:bg-amber-100',
  indigo: 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100',
  blue: 'bg-blue-50 text-blue-700 group-hover:bg-blue-100',
};

function QuickTile({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  color: 'teal' | 'amber' | 'indigo' | 'blue';
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-2 px-3.5 py-3.5 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all"
    >
      <div
        className={`w-9 h-9 rounded-lg grid place-items-center transition-colors ${tileColorMap[color]}`}
      >
        {icon}
      </div>
      <span className="text-sm font-semibold text-stone-900">{label}</span>
    </Link>
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
      <div className="flex items-baseline justify-between mb-2">
        <label className="block text-sm font-semibold text-stone-900">
          {label}
        </label>
        {imageUrl && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
          >
            Replace
          </label>
        )}
      </div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`block w-full ${aspectClass} rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-colors ${
          dragging
            ? 'border-teal-400 bg-teal-50'
            : imageUrl
              ? 'border-stone-200'
              : 'border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-stone-400'
        }`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-center px-3">
            <div>
              <div className="text-stone-400 text-3xl mb-1.5">🖼️</div>
              <div className="text-sm font-semibold text-stone-700">
                Drag & drop or click
              </div>
              <div className="text-xs text-stone-500 mt-0.5">{hint}</div>
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
    </div>
  );
}
