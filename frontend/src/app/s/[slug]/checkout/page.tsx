'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStorefront } from '../StorefrontShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { IcArrowLeft } from '@/components/icons/Icons';
import { formatBDT } from '@/lib/format';
import { placeOrder } from '@/lib/storefrontApi';
import { ApiRequestError } from '@/lib/api';
import { useI18n } from '@/hooks/useI18n';

export default function CheckoutPage() {
  const { shop, delivery, cart } = useStorefront();
  const { locale, t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState(delivery?.delivery_areas?.[0] ?? '');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliveryCharge = useMemo(() => {
    if (!delivery) return 0;
    const base = parseFloat(delivery.delivery_charge);
    if (delivery.free_delivery_threshold) {
      const threshold = parseFloat(delivery.free_delivery_threshold);
      if (cart.subtotal >= threshold) return 0;
    }
    return Number.isFinite(base) ? base : 0;
  }, [delivery, cart.subtotal]);

  const total = cart.subtotal + deliveryCharge;
  const disabled =
    cart.items.length === 0 ||
    !name.trim() ||
    !phone.trim() ||
    !address.trim() ||
    !area ||
    (delivery?.advance_payment_required && !ack);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await placeOrder(shop.slug, {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_address: address.trim(),
        delivery_area: area,
        note: note.trim() || undefined,
        items: cart.items.map((it) => ({ product_id: it.productId, quantity: it.quantity })),
      });
      cart.clearCart();
      router.push(`/s/${shop.slug}/order-confirmed/${order.id}?phone=${encodeURIComponent(phone.trim())}`);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(t(`errors.${err.code}`, err.message));
      else setError(t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">{locale === 'bn' ? 'আপনার কার্ট খালি' : 'Your cart is empty'}</h1>
        <Link href={`/s/${shop.slug}`} className="text-teal-600">← Back to shop</Link>
      </div>
    );
  }

  return (
    <section className="max-w-[1000px] mx-auto px-4 py-6 pb-16">
      <Link href={`/s/${shop.slug}`} className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-4">
        <IcArrowLeft size={14} /> {locale === 'bn' ? 'ফিরে যান' : 'Back to shopping'}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-5">{locale === 'bn' ? 'চেকআউট' : 'Checkout'}</h1>

      <form onSubmit={submit} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Card className="p-5" hover={false}>
            <h2 className="text-base font-semibold mb-3.5">{locale === 'bn' ? 'যোগাযোগ' : 'Contact details'}</h2>
            <div className="grid gap-3">
              <Input label={locale === 'bn' ? 'পুরো নাম' : 'Full name'} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rifat Ahmed" required />
              <Input label={locale === 'bn' ? 'ফোন নম্বর' : 'Phone number'} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01712 345 678" required />
              <Input label={locale === 'bn' ? 'ঠিকানা' : 'Delivery address'} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / Road / Area" required />
              <Textarea label={locale === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </Card>

          {delivery && delivery.delivery_areas.length > 0 && (
            <Card className="p-5" hover={false}>
              <h2 className="text-base font-semibold">{locale === 'bn' ? 'ডেলিভারি এলাকা' : 'Delivery zone'}</h2>
              <p className="text-sm text-stone-500 mt-1 mb-3.5">
                {locale === 'bn' ? 'আপনার অবস্থান নির্বাচন করুন' : 'Pick where to deliver'}
              </p>
              <div className="grid gap-2">
                {delivery.delivery_areas.map((a) => {
                  const sel = area === a;
                  return (
                    <label
                      key={a}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-lg cursor-pointer transition-colors ${
                        sel ? 'bg-teal-50 border-l-[3px] border-teal-500 pl-3' : 'bg-white border border-stone-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="area"
                        checked={sel}
                        onChange={() => setArea(a)}
                        className="accent-teal-600 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{a}</div>
                      </div>
                      <div className="font-semibold">{formatBDT(deliveryCharge, locale)}</div>
                    </label>
                  );
                })}
              </div>
            </Card>
          )}

          {delivery?.advance_payment_required && (
            <Card className="p-5" hover={false}>
              <h2 className="text-base font-semibold mb-2">{locale === 'bn' ? 'অগ্রিম পেমেন্ট' : 'Advance payment'}</h2>
              <p className="text-sm text-stone-600 mb-3 whitespace-pre-line">{delivery.advance_payment_instructions}</p>
              <label className="flex items-start gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-teal-600 mt-1" />
                {locale === 'bn'
                  ? 'আমি বুঝেছি যে অগ্রিম পেমেন্ট প্রয়োজন।'
                  : 'I understand advance payment is required.'}
              </label>
            </Card>
          )}
        </div>

        <div>
          <Card className="p-5 md:sticky md:top-20" hover={false}>
            <h2 className="text-base font-semibold mb-3.5">{locale === 'bn' ? 'অর্ডার সারাংশ' : 'Order summary'}</h2>
            <div className="grid gap-2.5 mb-3.5">
              {cart.items.map((it) => (
                <div key={it.productId} className="flex gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug line-clamp-1">{it.name}</div>
                    <div className="text-[11px] text-stone-500">Qty {it.quantity}</div>
                  </div>
                  <div className="text-sm font-medium">{formatBDT(parseFloat(it.price) * it.quantity, locale)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-200 pt-3 grid gap-1.5">
              <div className="flex justify-between text-sm text-stone-600">
                <span>{locale === 'bn' ? 'উপমোট' : 'Subtotal'}</span>
                <span>{formatBDT(cart.subtotal, locale)}</span>
              </div>
              <div className="flex justify-between text-sm text-stone-600">
                <span>{locale === 'bn' ? 'ডেলিভারি' : 'Delivery'}</span>
                <span>{deliveryCharge === 0 ? (locale === 'bn' ? 'ফ্রি' : 'Free') : formatBDT(deliveryCharge, locale)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold mt-1.5">
                <span>{locale === 'bn' ? 'মোট পরিশোধ' : 'Total'}</span>
                <span>{formatBDT(total, locale)}</span>
              </div>
            </div>
            {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
            <Button type="submit" variant="primary" className="w-full mt-4" disabled={disabled || submitting}>
              {submitting ? (locale === 'bn' ? 'অর্ডার হচ্ছে…' : 'Placing order…') : locale === 'bn' ? 'অর্ডার কনফার্ম করুন' : 'Place order'}
            </Button>
          </Card>
        </div>
      </form>
    </section>
  );
}
