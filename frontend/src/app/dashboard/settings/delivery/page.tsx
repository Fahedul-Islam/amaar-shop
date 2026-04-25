'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IcArrowLeft, IcPlus, IcTrash } from '@/components/icons/Icons';
import { getDeliverySettings, updateDeliverySettings } from '@/lib/shopApi';
import { ApiRequestError } from '@/lib/api';

export default function DeliverySettingsPage() {
  const { data, refetch } = useQuery({ queryKey: ['delivery'], queryFn: getDeliverySettings });
  const [cod, setCod] = useState(true);
  const [charge, setCharge] = useState('60');
  const [threshold, setThreshold] = useState('');
  const [advance, setAdvance] = useState(false);
  const [advanceText, setAdvanceText] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setCod(data.cod_enabled);
      setCharge(data.delivery_charge);
      setThreshold(data.free_delivery_threshold ?? '');
      setAdvance(data.advance_payment_required);
      setAdvanceText(data.advance_payment_instructions);
      setAreas(data.delivery_areas ?? []);
    }
  }, [data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await updateDeliverySettings({
        cod_enabled: cod,
        delivery_charge: charge,
        free_delivery_threshold: threshold || null,
        advance_payment_required: advance,
        advance_payment_instructions: advanceText,
        delivery_areas: areas,
      });
      refetch();
      setMsg('Delivery settings saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-3xl">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-3.5">
        <IcArrowLeft size={14} /> Back to settings
      </Link>
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mb-1">Delivery</h1>
      <p className="text-stone-500 mb-5">Where you deliver and what it costs.</p>

      <form onSubmit={submit} className="grid gap-4">
        <Card className="p-5 grid gap-3.5" hover={false}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} className="accent-teal-600" />
            Cash on delivery
          </label>
          <Input label="Delivery charge (৳)" value={charge} onChange={(e) => setCharge(e.target.value)} />
          <Input label="Free delivery above (৳, optional)" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </Card>

        <Card className="p-5 grid gap-3.5" hover={false}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} className="accent-teal-600" />
            Require advance payment (bKash / Nagad)
          </label>
          {advance && (
            <Textarea
              label="Payment instructions"
              value={advanceText}
              onChange={(e) => setAdvanceText(e.target.value)}
              placeholder="Send ৳200 advance to bKash 01712345678"
            />
          )}
        </Card>

        <Card className="p-5" hover={false}>
          <h3 className="text-sm font-semibold mb-3">Delivery areas</h3>
          <div className="grid gap-2 mb-3">
            {areas.map((a) => (
              <div key={a} className="flex items-center gap-2 px-3.5 py-2.5 border border-stone-200 rounded-md">
                <div className="flex-1 text-sm">{a}</div>
                <button
                  type="button"
                  onClick={() => setAreas(areas.filter((x) => x !== a))}
                  className="text-stone-400 hover:text-red-600"
                >
                  <IcTrash size={16} />
                </button>
              </div>
            ))}
            {areas.length === 0 && <div className="text-sm text-stone-500">No delivery areas yet.</div>}
          </div>
          <div className="flex gap-2">
            <Input
              label=""
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="e.g. Inside Dhaka"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const v = newArea.trim();
                if (v && !areas.includes(v)) setAreas([...areas, v]);
                setNewArea('');
              }}
            >
              <IcPlus size={14} /> Add
            </Button>
          </div>
        </Card>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {msg && <div className="text-sm text-teal-700">{msg}</div>}
        <div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save delivery settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
