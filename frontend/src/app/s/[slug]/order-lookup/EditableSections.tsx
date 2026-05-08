"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  buyerEditOrder,
  submitAdvanceProof,
  type Order,
} from "@/lib/storefrontApi";
import {
  PaymentMethod,
  getPublicPaymentMethods,
  numberTypeLabel,
  providerLabel,
  uploadReceipt,
} from "@/lib/paymentMethodApi";
import { ApiRequestError } from "@/lib/api";
import { BD_DIVISIONS, BD_DISTRICTS, type Division } from "@/lib/bdGeo";

/** Edit delivery details (address/note) while order is pre-confirmation. */
export function EditDeliveryDetails({
  shopSlug,
  order,
  customerPhone,
  locale,
  onSaved,
}: {
  shopSlug: string;
  order: Order;
  customerPhone: string;
  locale: "en" | "bn";
  onSaved: (o: Order) => void;
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(order.delivery_address);
  const [division, setDivision] = useState<Division | "">(
    (order.delivery_division as Division) ?? "",
  );
  const [district, setDistrict] = useState(order.delivery_district ?? "");
  const [note, setNote] = useState(order.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAddress(order.delivery_address);
      setDivision((order.delivery_division as Division) ?? "");
      setDistrict(order.delivery_district ?? "");
      setNote(order.note ?? "");
      setError(null);
    }
  }, [open, order]);

  async function save() {
    if (address.trim().length < 8) {
      setError(
        locale === "bn"
          ? "ঠিকানাটি খুব ছোট।"
          : "Address looks too short — include house, road, and area.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await buyerEditOrder(shopSlug, order.id, {
        customer_phone: customerPhone,
        delivery_address: address.trim(),
        delivery_division: division || undefined,
        delivery_district: district || undefined,
        note: note.trim() || undefined,
      });
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not save changes",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 mt-4" hover={false}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">
          {locale === "bn" ? "ডেলিভারি বিবরণ এডিট" : "Edit delivery details"}
        </h3>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {locale === "bn" ? "এডিট" : "Edit"}
          </Button>
        )}
      </div>
      <p className="text-[12.5px] text-stone-500 mb-3">
        {locale === "bn"
          ? "অর্ডার কনফার্ম হওয়ার আগ পর্যন্ত পরিবর্তন করতে পারবেন।"
          : "You can change these until the seller confirms your order."}
      </p>

      {open && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-stone-700 block mb-1">
                {locale === "bn" ? "বিভাগ" : "Division"}
              </label>
              <select
                value={division}
                onChange={(e) => {
                  setDivision(e.target.value as Division);
                  setDistrict("");
                }}
                className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white"
              >
                <option value="">—</option>
                {BD_DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700 block mb-1">
                {locale === "bn" ? "জেলা" : "District"}
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!division}
                className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white disabled:bg-stone-50 disabled:text-stone-400"
              >
                <option value="">—</option>
                {division &&
                  BD_DISTRICTS[division as Division].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <Textarea
            label={
              locale === "bn"
                ? "বিস্তারিত ঠিকানা"
                : "Detailed address"
            }
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Textarea
            label={locale === "bn" ? "নোট" : "Note"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              {locale === "bn" ? "বাতিল" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={saving}
            >
              {saving
                ? locale === "bn"
                  ? "সেভ হচ্ছে…"
                  : "Saving…"
                : locale === "bn"
                  ? "সেভ করুন"
                  : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Allow buyer to (re)submit advance payment proof while order is pending. */
export function EditAdvancePayment({
  shopSlug,
  order,
  customerPhone,
  locale,
  onSaved,
}: {
  shopSlug: string;
  order: Order;
  customerPhone: string;
  locale: "en" | "bn";
  onSaved: (o: Order) => void;
}) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState(
    order.advance_payment_method_id ?? "",
  );
  const [txnRef, setTxnRef] = useState(order.advance_payment_txn_ref ?? "");
  const [receiptUrl, setReceiptUrl] = useState(
    order.advance_payment_receipt ?? "",
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicPaymentMethods(shopSlug)
      .then(setMethods)
      .catch(() => {});
  }, [shopSlug]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError(
        locale === "bn"
          ? "ফাইল ৫ MB-এর কম হতে হবে।"
          : "File must be 5 MB or smaller.",
      );
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadReceipt(shopSlug, f);
      setReceiptUrl(url);
    } catch {
      setError(
        locale === "bn" ? "আপলোড ব্যর্থ।" : "Upload failed — please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!methodId) {
      setError(
        locale === "bn" ? "মাধ্যম বেছে নিন।" : "Please choose a method.",
      );
      return;
    }
    if (!txnRef.trim()) {
      setError(
        locale === "bn"
          ? "ট্রানজেকশন আইডি দিন।"
          : "Please enter the transaction ID.",
      );
      return;
    }
    if (!receiptUrl) {
      setError(
        locale === "bn"
          ? "রসিদ আপলোড করুন।"
          : "Please upload your receipt.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await submitAdvanceProof(shopSlug, order.id, {
        customer_phone: customerPhone,
        payment_method_id: methodId,
        txn_ref: txnRef.trim(),
        receipt: receiptUrl,
      });
      onSaved(updated);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not save proof",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 mt-4" hover={false}>
      <h3 className="text-sm font-semibold mb-1">
        {locale === "bn" ? "অগ্রিম পেমেন্ট প্রমাণ" : "Advance payment proof"}
      </h3>
      <p className="text-[12.5px] text-stone-500 mb-3">
        {locale === "bn"
          ? "বিক্রেতা কনফার্ম করার আগ পর্যন্ত আপডেট করতে পারবেন।"
          : "You can update this until the seller confirms your order."}
      </p>

      <div className="grid gap-3">
        <div>
          <label className="text-xs font-medium text-stone-700 block mb-1.5">
            {locale === "bn" ? "যে মাধ্যমে পেমেন্ট করেছেন" : "Method used"}
          </label>
          <select
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white"
          >
            <option value="">
              {locale === "bn" ? "মাধ্যম বেছে নিন…" : "Choose a method…"}
            </option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.method_type === "bank"
                  ? `${m.bank_name} · A/C ${m.account_number}`
                  : `${providerLabel(m.mb_provider)} · ${m.mb_phone} (${numberTypeLabel(m.mb_number_type)})`}
              </option>
            ))}
          </select>
        </div>

        <Input
          label={locale === "bn" ? "ট্রানজেকশন আইডি" : "Transaction ID"}
          value={txnRef}
          onChange={(e) => setTxnRef(e.target.value)}
          placeholder="TX1A2B3C"
        />

        <div>
          <label className="text-xs font-medium text-stone-700 block mb-1.5">
            {locale === "bn" ? "রসিদ" : "Receipt"}
          </label>
          {receiptUrl ? (
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-green-50 border border-green-200 rounded-md text-sm">
              <span className="font-medium text-green-900 flex-1">
                ✓ {locale === "bn" ? "রসিদ যুক্ত আছে" : "Receipt attached"}
              </span>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                {locale === "bn" ? "দেখুন" : "View"}
              </a>
              <button
                type="button"
                onClick={() => setReceiptUrl("")}
                className="text-xs font-semibold text-stone-600 hover:underline"
              >
                {locale === "bn" ? "পরিবর্তন" : "Change"}
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center h-10 px-3 border-[1.5px] border-dashed border-stone-300 rounded-md cursor-pointer text-sm text-stone-700 hover:border-teal-400">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFile}
                disabled={uploading}
              />
              {uploading
                ? locale === "bn"
                  ? "আপলোড হচ্ছে…"
                  : "Uploading…"
                : locale === "bn"
                  ? "ফাইল বেছে নিন"
                  : "Choose a file"}
            </label>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={saving}
          >
            {saving
              ? locale === "bn"
                ? "সেভ হচ্ছে…"
                : "Saving…"
              : order.advance_payment_receipt
                ? locale === "bn"
                  ? "প্রমাণ আপডেট করুন"
                  : "Update proof"
                : locale === "bn"
                  ? "প্রমাণ পাঠান"
                  : "Submit proof"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
