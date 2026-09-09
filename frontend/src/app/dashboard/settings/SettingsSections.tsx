"use client";
import { useState, useEffect, useId, cloneElement, isValidElement, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IcCheck } from '@/components/icons/Icons';
import { getCourierSettings, updateCourierSettings } from '@/lib/courierApi';
import { getMetaSettings, updateMetaSettings } from '@/lib/trackingApi';
import { ApiRequestError } from '@/lib/api';
export function CourierSettingsSection() {
  const qc = useQueryClient();
  const { data: settings, isPending, isError, refetch } = useQuery({
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

  if (isPending) return <p className="text-sm text-stone-500">Loading settings…</p>;
  if (isError) return <div role="alert"><p className="mb-3">Could not load settings.</p><Button onClick={() => refetch()}>Try again</Button></div>;
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

export function MetaTrackingSection() {
  const qc = useQueryClient();
  const { data: settings, isPending, isError, refetch } = useQuery({
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

  if (isPending) return <p className="text-sm text-stone-500">Loading settings…</p>;
  if (isError) return <div role="alert"><p className="mb-3">Could not load settings.</p><Button onClick={() => refetch()}>Try again</Button></div>;
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
            Customer phone and name are hashed before sending — Meta never
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

export function SettingsSection({
  id,
  title,
  subtitle,
  badge,
  children,
}: {
  id?: string;
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="p-5 md:p-6" hover={false}>
      {title && <div className="flex items-start gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight text-stone-900">
              {title}
            </h2>
            {badge}
          </div>
          <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>
        </div>
      </div>}
      {children}
    </Card>
  );
}

export function FieldRow({
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
  const fieldId = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label htmlFor={fieldId} className="block text-sm font-semibold text-stone-900">
          {label}
        </label>
        {meta}
      </div>
      {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id: fieldId }) : children}
      {hint && <p className="text-xs text-stone-500 mt-1.5">{hint}</p>}
    </div>
  );
}

export function PrettyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-11 px-3.5 bg-white border border-stone-300 rounded-lg text-[15px] text-stone-900 placeholder-stone-400 transition-colors duration-150 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 ${
        props.className ?? ''
      }`}
    />
  );
}

export function UploadTile({
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
  const aspectClass = aspect === 'square' ? 'aspect-square max-w-44' : 'aspect-[3/1]';

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
