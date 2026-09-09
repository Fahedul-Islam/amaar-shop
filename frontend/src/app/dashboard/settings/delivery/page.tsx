'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDeliverySettings, updateDeliverySettings, type DeliverySettings } from '@/lib/shopApi';
import { BD_DIVISIONS } from '@/lib/bdGeo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import PaymentMethods from './PaymentMethods';

const fieldClass = 'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600';

export default function DeliverySettingsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['delivery'], queryFn: getDeliverySettings });
  const [form, setForm] = useState<DeliverySettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [division, setDivision] = useState('');
  const [fee, setFee] = useState('');

  useEffect(() => { if (data && !dirty) setForm(data); }, [data, dirty]);
  function change(patch: Partial<DeliverySettings>) {
    setForm(current => current ? { ...current, ...patch } : current);
    setDirty(true);
    setMessage('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (division || fee) { setError('Add the division rate or clear its fields before saving.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const updated = await updateDeliverySettings({
        cod_enabled: form.cod_enabled,
        delivery_charge: form.delivery_charge,
        free_delivery_threshold: form.free_delivery_threshold,
        advance_payment_required: form.advance_payment_required,
        advance_payment_instructions: form.advance_payment_instructions,
        delivery_zones: form.delivery_zones,
      });
      queryClient.setQueryData(['delivery'], updated);
      setForm(updated); setDirty(false); setMessage('Delivery settings saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  }

  if (isPending) return <p className="p-8 text-stone-500">Loading delivery settings…</p>;
  if (isError) return <div className="p-8"><p role="alert">Could not load delivery settings.</p><Button onClick={() => refetch()}>Try again</Button></div>;
  if (!form) return null;

  return (
    <div className="max-w-4xl px-5 py-8 md:px-10 md:py-10">
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Delivery & payments</h1>
      <p className="mt-2 mb-8 text-sm text-stone-600">Set delivery fees and choose when buyers pay them.</p>

      <form onSubmit={save} className="rounded-lg border border-stone-200 bg-white">
        <fieldset disabled={saving}>
          <section className="p-5 md:p-6 border-b border-stone-200">
            <h2 className="font-semibold">Delivery charges</h2>
            <p className="text-sm text-stone-500 mt-1 mb-5">Charged once per order. Enter 0 for free delivery.</p>
            <div className="max-w-xs"><Input label="Standard delivery fee (৳)" type="number" min="0" step="0.01" required value={form.delivery_charge} onChange={e => change({ delivery_charge: e.target.value })} /></div>
            <p className="text-xs text-stone-500 mt-2">Used for any division without a separate rate below.</p>
            <div className="mt-6 space-y-3">
              {form.delivery_zones.map((zone, index) => (
                <div key={zone.division} className="grid grid-cols-[1fr_110px_auto] items-end gap-3">
                  <span className="self-center text-sm">{zone.division}</span>
                  <Input aria-label={`${zone.division} delivery fee in taka`} type="number" min="0" step="0.01" required value={zone.delivery_charge} onChange={e => change({ delivery_zones: form.delivery_zones.map((z, i) => i === index ? { ...z, delivery_charge: e.target.value } : z) })} />
                  <button type="button" className="py-2 text-sm text-stone-500 hover:text-red-700" onClick={() => change({ delivery_zones: form.delivery_zones.filter((_, i) => i !== index) })} aria-label={`Remove ${zone.division} rate`}>Remove</button>
                </div>
              ))}
            </div>
            {form.delivery_zones.length < BD_DIVISIONS.length && (
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_130px_auto] items-end">
                <label className="text-sm">Separate rate for a division
                  <select className={`${fieldClass} mt-2`} value={division} onChange={e => setDivision(e.target.value)}>
                    <option value="">Choose division</option>
                    {BD_DIVISIONS.filter(d => !form.delivery_zones.some(z => z.division === d)).map(d => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <Input label="Fee (৳)" type="number" min="0" step="0.01" value={fee} onChange={e => setFee(e.target.value)} />
                <Button type="button" disabled={!division || fee === '' || !Number.isFinite(Number(fee)) || Number(fee) < 0} onClick={() => {
                  change({ delivery_zones: [...form.delivery_zones, { division, delivery_charge: fee }] }); setDivision(''); setFee(''); setError('');
                }}>Add rate</Button>
              </div>
            )}
            <label className="flex items-start gap-3 text-sm mt-6 cursor-pointer">
              <input type="checkbox" className="mt-1 accent-teal-700" checked={form.free_delivery_threshold !== null} onChange={e => change({ free_delivery_threshold: e.target.checked ? '' : null })} />
              <span>Offer free delivery above a minimum order amount</span>
            </label>
            {form.free_delivery_threshold !== null && <div className="max-w-xs mt-3"><Input label="Minimum product total (৳)" type="number" min={Number(form.delivery_charge) + 0.01} step="0.01" required value={form.free_delivery_threshold} onChange={e => change({ free_delivery_threshold: e.target.value })} /><p className="text-xs text-stone-500 mt-2">Calculated before any coupon discount.</p></div>}
          </section>

          <section className="p-5 md:p-6 border-b border-stone-200">
            <h2 className="font-semibold">When should buyers pay?</h2>
            <p className="text-sm text-stone-500 mt-1 mb-5">Product prices are paid on delivery. Choose when to collect the delivery fee.</p>
            <div className="space-y-4">
              <label className="flex gap-3 cursor-pointer text-sm"><input className="mt-1 self-start accent-teal-700" type="radio" name="payment-timing" checked={!form.advance_payment_required} onChange={() => change({ advance_payment_required: false })} /><span><span className="font-medium block">Collect everything on delivery</span><span className="text-stone-500 block mt-1">Buyers can order without a transaction ID or payment receipt.</span></span></label>
              <label className="flex gap-3 cursor-pointer text-sm"><input className="mt-1 self-start accent-teal-700" type="radio" name="payment-timing" checked={form.advance_payment_required} onChange={() => change({ advance_payment_required: true })} /><span><span className="font-medium block">Collect the delivery fee before the order</span><span className="text-stone-500 block mt-1">Buyers send the fee and provide a transaction ID and receipt at checkout.</span></span></label>
            </div>
            <p className="text-sm text-stone-600 mt-5">You can allow payment on arrival for individual products in <Link href="/dashboard/products" className="underline underline-offset-2">Products → Edit → Delivery</Link>. If an order includes another product that requires advance payment, the delivery fee is still collected in advance. No proof is needed for free delivery.</p>
            {form.advance_payment_required && <label className="block text-sm mt-5">Instructions for buyers<textarea className={`${fieldClass} mt-2 min-h-24`} value={form.advance_payment_instructions} onChange={e => change({ advance_payment_instructions: e.target.value })} placeholder="Send the delivery fee to one of the accounts below." /></label>}
          </section>
          <section className="p-5 md:p-6">
            <label className="flex gap-3 text-sm cursor-pointer"><input className="accent-teal-700" type="checkbox" checked={form.cod_enabled} onChange={e => change({ cod_enabled: e.target.checked })} /><span className="font-medium">Accept new orders</span></label>
            <p className="text-sm text-stone-500 mt-2">Turn this off to pause checkout. Your shop stays visible.</p>
          </section>
          <div className="border-t border-stone-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm" aria-live="polite">{error ? <span role="alert" className="text-red-700">{error}</span> : message || (dirty ? 'Unsaved changes' : 'Settings are up to date')}</div>
            <Button type="submit" disabled={saving || (!dirty && form.is_configured)}>{saving ? 'Saving…' : 'Save delivery settings'}</Button>
          </div>
        </fieldset>
      </form>
      <section className="mt-8 border-t border-stone-200 pt-7">
        <h2 className="font-semibold">Accounts for advance payments</h2>
        <p className="text-sm text-stone-500 mt-1 mb-4">Manage where buyers send the delivery fee. Account changes save separately.</p>
        <PaymentMethods advanceEnabled={form.advance_payment_required} />
      </section>
    </div>
  );
}
