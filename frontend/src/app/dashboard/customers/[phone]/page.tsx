'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge, statusTone } from '@/components/ui/Badge';
import { prettyOrderStatus } from '@/lib/orderApi';
import { SegmentBadge } from '@/components/ui/SegmentBadge';
import { Button } from '@/components/ui/Button';
import { IcChevL, IcChevR } from '@/components/icons/Icons';
import {
  type CustomerSegment,
  SEGMENT_DESCRIPTIONS,
  deleteCustomerNote,
  getCustomer,
  getCustomerOrders,
  upsertCustomerNote,
} from '@/lib/customerApi';
import { ApiRequestError } from '@/lib/api';
import { formatBDT, formatDate, formatDateTime } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

export default function CustomerDetailPage() {
  const params = useParams<{ phone: string }>();
  const router = useRouter();
  const { locale } = useI18n();
  const phone = params?.phone ?? '';

  const customerQ = useQuery({
    queryKey: ['customer', phone],
    queryFn: () => getCustomer(phone),
    enabled: !!phone,
    retry: false,
  });
  const ordersQ = useQuery({
    queryKey: ['customer-orders', phone],
    queryFn: () => getCustomerOrders(phone),
    enabled: !!phone,
  });

  if (customerQ.isLoading) {
    return <div className="px-6 md:px-8 py-10 text-stone-500 text-sm">Loading customer…</div>;
  }

  if (customerQ.isError) {
    const err = customerQ.error;
    const notFound = err instanceof ApiRequestError && err.status === 404;
    return (
      <div className="px-6 md:px-8 py-10">
        <Link href="/dashboard/customers" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4">
          <IcChevL size={14} /> Back to customers
        </Link>
        <Card className="p-8 text-center" hover={false}>
          <div className="text-sm font-medium text-stone-700 mb-1">
            {notFound ? 'Customer not found' : 'Could not load customer'}
          </div>
          <div className="text-xs text-stone-500">
            {notFound ? 'No orders match this phone number for your shop.' : 'Try refreshing the page.'}
          </div>
        </Card>
      </div>
    );
  }

  const c = customerQ.data!;
  const orders = ordersQ.data ?? [];
  const phoneDigits = c.normalized_phone;
  // Bangladesh: WhatsApp expects E.164. Phone numbers stored as 01... start
  // with the local trunk zero; replace with 880 country code so wa.me/...
  // resolves.
  const waPhone = phoneDigits.startsWith('0') ? `880${phoneDigits.slice(1)}` : phoneDigits;

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-5xl">
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4"
      >
        <IcChevL size={14} /> Back to customers
      </Link>

      <Card className="p-5 md:p-6 mb-5" hover={false}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full bg-teal-100 text-teal-700 grid place-items-center text-xl font-bold flex-shrink-0">
            {c.name.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{c.name}</h1>
              <SegmentBadge segment={c.segment} />
            </div>
            <div className="text-sm text-stone-600">{c.display_phone}</div>
            {c.delivery_area && (
              <div className="text-xs text-stone-500 mt-0.5">Area: {c.delivery_area}</div>
            )}
            <SegmentExplainer segment={c.segment} />
          </div>
          <ContactButtons phone={c.display_phone} waPhone={waPhone} customerName={c.name} />
        </div>
      </Card>

      <div className="grid gap-3.5 mb-5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        <KPI label="Total orders" value={String(c.total_orders)} />
        <KPI label="Total spent" value={formatBDT(c.total_spent_bdt, locale)} accent="text-teal-700" />
        <KPI label="Avg order value" value={formatBDT(c.avg_order_bdt, locale)} />
        <KPI
          label="First order"
          value={c.first_order_at ? formatDate(c.first_order_at, locale) : '—'}
        />
        <KPI
          label="Last order"
          value={c.last_order_at ? formatDate(c.last_order_at, locale) : '—'}
        />
      </div>

      <NoteCard phone={phone} initialNote={c.note} updatedAt={c.note_updated_at} />

      <Card className="p-0 overflow-hidden" hover={false}>
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-semibold">Order history</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            All {orders.length} order{orders.length === 1 ? '' : 's'} from this customer.
          </p>
        </div>
        {ordersQ.isLoading ? (
          <div className="p-8 text-center text-stone-500 text-sm">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">No orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-left">
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Items</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                  <Th>{''}</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.order_id}
                    onClick={() => router.push(`/dashboard/orders/${o.order_id}`)}
                    className="border-t border-stone-100 cursor-pointer hover:bg-teal-50/60 group"
                  >
                    <Td>
                      <span className="font-mono text-stone-700 group-hover:text-teal-700">
                        {o.order_id.slice(0, 8)}
                      </span>
                    </Td>
                    <Td className="text-stone-500">{formatDateTime(o.created_at, locale)}</Td>
                    <Td>{o.items_count}</Td>
                    <Td className="font-semibold">{formatBDT(o.total_bdt, locale)}</Td>
                    <Td>
                      <Badge tone={statusTone(o.status)}>{prettyOrderStatus(o.status)}</Badge>
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-teal-700 group-hover:text-teal-800">
                        Open <IcChevR size={12} />
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function KPI({ label, value, accent = 'text-stone-900' }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-4" hover={false}>
      <div className="text-[11px] text-stone-500 font-medium uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold tracking-tight mt-1.5 ${accent}`}>{value}</div>
    </Card>
  );
}

function SegmentExplainer({ segment }: { segment: CustomerSegment }) {
  return (
    <p className="text-[11px] text-stone-500 mt-2 max-w-md">{SEGMENT_DESCRIPTIONS[segment]}</p>
  );
}

function ContactButtons({
  phone,
  waPhone,
  customerName,
}: {
  phone: string;
  waPhone: string;
  customerName: string;
}) {
  const greeting = encodeURIComponent(`Hello ${customerName}, this is your order update from our shop.`);
  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={`tel:${phone}`}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
      >
        <PhoneIcon /> Call
      </a>
      <a
        href={`sms:${phone}`}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-sm font-medium border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition-colors"
      >
        <MsgIcon /> SMS
      </a>
      <a
        href={`https://wa.me/${waPhone}?text=${greeting}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
      >
        <WhatsAppIcon /> WhatsApp
      </a>
    </div>
  );
}

function NoteCard({
  phone,
  initialNote,
  updatedAt,
}: {
  phone: string;
  initialNote: string;
  updatedAt: string | null;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(initialNote);
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialNote);

  useEffect(() => {
    setDraft(initialNote);
    lastSaved.current = initialNote;
    setSavedAt(updatedAt);
  }, [initialNote, updatedAt]);

  const saveMut = useMutation({
    mutationFn: (note: string) => upsertCustomerNote(phone, note),
    onSuccess: (data) => {
      lastSaved.current = data.note;
      setSavedAt(data.note_updated_at);
      qc.setQueryData(['customer', phone], data);
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCustomerNote(phone),
    onSuccess: () => {
      lastSaved.current = '';
      setSavedAt(null);
      qc.invalidateQueries({ queryKey: ['customer', phone] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  // Autosave on idle. Skip if value already saved or empty (delete handled separately).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (draft === lastSaved.current) return;
    if (draft.trim() === '' && lastSaved.current === '') return;
    debounceRef.current = setTimeout(() => {
      if (draft.trim() === '') return; // don't autosave empty as a save — user must press Clear
      saveMut.mutate(draft);
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="p-5 mb-5" hover={false}>
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Private notes</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Only you can see these. Useful for delivery preferences, payment habits, or reminders.
          </p>
        </div>
        <div className="text-[11px] text-stone-500">
          {saveMut.isPending ? (
            <span>Saving…</span>
          ) : savedAt ? (
            <span>Saved {formatDateTime(savedAt, 'en')}</span>
          ) : (
            <span className="text-stone-400">Not saved yet</span>
          )}
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. Prefers cash on delivery. Call before 6pm."
        rows={3}
        maxLength={1000}
        className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-y"
      />
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[11px] text-stone-400">{draft.length}/1000</span>
        <div className="flex gap-2">
          {lastSaved.current !== '' && (
            <Button
              variant="neutral"
              size="sm"
              onClick={() => {
                setDraft('');
                deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
            >
              Clear note
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => draft.trim() && saveMut.mutate(draft)}
            disabled={saveMut.isPending || draft === lastSaved.current || draft.trim() === ''}
          >
            Save now
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>{children}</td>;
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function MsgIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.249.397-1 3.648 3.731-.973zM18.46 14.46c-.075-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.173.198-.297.297-.495.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.207-.242-.579-.487-.501-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}
