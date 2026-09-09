'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatBDT } from '@/lib/format';

type Coupon = { id: string; code: string; amount_bdt: string; buyer_phone: string; expires_at: string; is_active: boolean; redeemed_at: string | null };
const endpoint = '/api/shops/me/coupons';

export default function Coupons() {
  const qc = useQueryClient();
  const { data = [], isPending, isError, refetch } = useQuery({ queryKey: ['coupons'], queryFn: () => apiFetch<Coupon[]>(endpoint) });
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const c = await apiFetch<Coupon>(endpoint, { method: 'POST', body: JSON.stringify({ amount_bdt: amount, buyer_phone: phone, expires_at: new Date(Date.now() + Number(days) * 86400000).toISOString() }) });
      qc.setQueryData<Coupon[]>(['coupons'], old => [c, ...(old ?? [])]);
      setMessage(`Created ${c.code}. Copy it below and send it to your buyer.`); setAmount(''); setPhone('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create coupon.'); }
    finally { setBusy(false); }
  }
  async function disable(id: string) {
    setBusy(true); setError(''); setMessage('');
    try { await apiFetch<void>(`${endpoint}/${id}`, { method: 'DELETE' }); await qc.invalidateQueries({ queryKey: ['coupons'] }); setMessage('Coupon disabled.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not disable coupon.'); }
    finally { setBusy(false); }
  }
  return <>
    <h1 className="text-2xl font-semibold">Discount codes</h1>
    <p className="text-sm text-stone-500 mt-1 mb-5">Create a code and send it privately. Each code works for one order in your shop and reduces the product total, up to the amount you choose. Delivery fees stay the same.</p>
    <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 rounded-lg border border-stone-200 bg-white p-5">
      <Input label="Discount amount (৳)" type="number" min="0.01" max="9999999" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} />
      <label className="text-sm">Valid for<select value={days} onChange={e => setDays(e.target.value)} className="mt-2 w-full rounded-md border border-stone-300 bg-white p-2.5"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
      <div><Input label="Buyer’s phone number (optional)" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01712345678" /><p className="text-xs text-stone-500 mt-2">If entered, the same number must be used at checkout. Otherwise, anyone with the code can use it once.</p></div>
      <div className="sm:self-end"><Button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Generate discount code'}</Button></div>
    </form>
    {error && <p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}
    {message && <p role="status" className="text-sm text-teal-700 mt-3">{message}</p>}
    <div className="mt-5 divide-y divide-stone-200">
      {isPending && <p className="text-sm text-stone-500">Loading codes…</p>}
      {isError && <p role="alert" className="text-sm text-red-700">Could not load codes. <button onClick={() => refetch()} className="underline">Try again</button></p>}
      {!isPending && !isError && !data.length && <p className="text-sm text-stone-500">No discount codes yet.</p>}
      {data.map(c => {
        const status = c.redeemed_at ? 'Used' : !c.is_active ? 'Disabled' : new Date(c.expires_at) <= new Date() ? 'Expired' : 'Available';
        return <div key={c.id} className="py-4 flex flex-wrap justify-between gap-3 items-center">
          <div><code className="text-sm font-semibold break-all">{c.code}</code><p className="text-sm text-stone-600 mt-1">{formatBDT(c.amount_bdt)} off · {c.buyer_phone || 'Anyone with this code'} · {status}</p><p className="text-xs text-stone-500 mt-1">Expires {new Date(c.expires_at).toLocaleString()}</p></div>
          {status === 'Available' && <div className="flex gap-4 text-sm"><button className="underline underline-offset-2" onClick={async () => { try { await navigator.clipboard.writeText(c.code); setMessage('Code copied.'); } catch { setError('Copy the code manually from the list.'); } }}>Copy code</button><button disabled={busy} className="text-stone-500 hover:text-red-700" onClick={() => disable(c.id)}>Disable</button></div>}
        </div>;
      })}
    </div>
  </>;
}
