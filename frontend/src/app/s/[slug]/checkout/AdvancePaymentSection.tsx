"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  PaymentMethod,
  getPublicPaymentMethods,
  numberTypeLabel,
  providerLabel,
  uploadReceipt,
} from "@/lib/paymentMethodApi";

export interface AdvanceProofState {
  methodId: string;
  txnRef: string;
  receiptUrl: string;
  acknowledged: boolean;
}

export const emptyProof: AdvanceProofState = {
  methodId: "",
  txnRef: "",
  receiptUrl: "",
  acknowledged: false,
};

interface Props {
  shopSlug: string;
  locale: "en" | "bn";
  instructions?: string;
  value: AdvanceProofState;
  onChange: (next: AdvanceProofState) => void;
}

export default function AdvancePaymentSection({
  shopSlug,
  locale,
  instructions,
  value,
  onChange,
}: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPublicPaymentMethods(shopSlug)
      .then((m) => {
        if (cancelled) return;
        setMethods(m);
        // Auto-select if only one method exists.
        if (m.length === 1 && !value.methodId) {
          onChange({ ...value, methodId: m[0].id });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSlug]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadError(null);
    if (f.size > 5 * 1024 * 1024) {
      setUploadError(
        locale === "bn"
          ? "ফাইলের আকার ৫ MB-এর কম হতে হবে।"
          : "File must be 5 MB or smaller.",
      );
      return;
    }
    setUploading(true);
    try {
      const url = await uploadReceipt(shopSlug, f);
      onChange({ ...value, receiptUrl: url });
    } catch {
      setUploadError(
        locale === "bn"
          ? "আপলোড ব্যর্থ — আবার চেষ্টা করুন।"
          : "Upload failed — please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="p-5" hover={false}>
      <h2 className="text-base font-semibold mb-1">
        {locale === "bn" ? "অগ্রিম ডেলিভারি ফি" : "Advance delivery fee"}
      </h2>
      <p className="text-sm text-stone-600 mb-3.5">
        {locale === "bn"
          ? "অর্ডার দেওয়ার আগে নিচের যেকোনো একটি মাধ্যমে ডেলিভারি ফি পাঠান এবং রসিদ আপলোড করুন।"
          : "Send the delivery fee using one of the methods below, then upload your receipt before placing the order."}
      </p>

      {instructions && (
        <div className="mb-4 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900 whitespace-pre-line">
          {instructions}
        </div>
      )}

      {/* Step 1 — choose method */}
      <div className="mb-4">
        <div className="text-[13px] font-semibold text-stone-900 mb-2">
          {locale === "bn"
            ? "১. একটি পেমেন্ট মাধ্যম বেছে নিন"
            : "1. Choose a payment method you used"}
        </div>
        {loading ? (
          <p className="text-sm text-stone-500">
            {locale === "bn" ? "লোড হচ্ছে…" : "Loading…"}
          </p>
        ) : methods.length === 0 ? (
          <div className="px-3.5 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {locale === "bn"
              ? "এই দোকানের কোনো পেমেন্ট মাধ্যম এখনো সেট করা হয়নি। দয়া করে দোকানের সাথে যোগাযোগ করুন।"
              : "This shop hasn't published any payment methods yet. Please contact the seller."}
          </div>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <MethodOption
                key={m.id}
                m={m}
                selected={value.methodId === m.id}
                locale={locale}
                onSelect={() => onChange({ ...value, methodId: m.id })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — txn ref */}
      <div className="mb-4">
        <div className="text-[13px] font-semibold text-stone-900 mb-2">
          {locale === "bn"
            ? "২. ট্রানজেকশন আইডি লিখুন"
            : "2. Enter the transaction ID / reference"}
        </div>
        <Input
          value={value.txnRef}
          onChange={(e) => onChange({ ...value, txnRef: e.target.value })}
          placeholder={
            locale === "bn"
              ? "যেমন TX1A2B3C"
              : "e.g. TX1A2B3C"
          }
        />
      </div>

      {/* Step 3 — receipt upload */}
      <div className="mb-4">
        <div className="text-[13px] font-semibold text-stone-900 mb-2">
          {locale === "bn"
            ? "৩. পেমেন্ট রসিদ আপলোড করুন"
            : "3. Upload your payment receipt"}
        </div>
        <p className="text-xs text-stone-500 mb-2">
          {locale === "bn"
            ? "JPG, PNG, WebP, বা PDF — সর্বোচ্চ ৫ MB।"
            : "JPG, PNG, WebP or PDF — 5 MB max."}
        </p>
        {value.receiptUrl ? (
          <div className="flex items-center gap-3 px-3.5 py-3 bg-green-50 border border-green-200 rounded-md">
            <span className="w-7 h-7 rounded-full bg-green-600 text-white grid place-items-center text-xs font-bold">
              ✓
            </span>
            <div className="flex-1 text-sm text-green-900 font-medium truncate">
              {locale === "bn"
                ? "রসিদ আপলোড হয়েছে"
                : "Receipt uploaded"}
            </div>
            <a
              href={value.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              {locale === "bn" ? "দেখুন" : "View"}
            </a>
            <button
              type="button"
              onClick={() => onChange({ ...value, receiptUrl: "" })}
              className="text-xs font-semibold text-stone-600 hover:underline"
            >
              {locale === "bn" ? "পরিবর্তন" : "Change"}
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 h-11 px-4 border-[1.5px] border-dashed border-stone-300 rounded-md cursor-pointer text-sm text-stone-700 hover:border-teal-400 hover:text-teal-700 transition-colors">
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
        {uploadError && (
          <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>
        )}
      </div>

      {/* Step 4 — confirm */}
      <label className="flex items-start gap-2 text-sm text-stone-800 pt-3 border-t border-stone-100">
        <input
          type="checkbox"
          checked={value.acknowledged}
          onChange={(e) =>
            onChange({ ...value, acknowledged: e.target.checked })
          }
          className="accent-teal-600 mt-1"
        />
        {locale === "bn"
          ? "আমি নিশ্চিত করছি যে ডেলিভারি ফি পরিশোধ করেছি।"
          : "I confirm that I have paid the delivery fee."}
      </label>
    </Card>
  );
}

function MethodOption({
  m,
  selected,
  locale,
  onSelect,
}: {
  m: PaymentMethod;
  selected: boolean;
  locale: "en" | "bn";
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    });
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3.5 rounded-[10px] border-[1.5px] transition-colors ${
        selected
          ? "border-teal-500 bg-teal-50"
          : "border-stone-200 hover:border-stone-300 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-[8px] grid place-items-center flex-shrink-0 text-white text-[11px] font-bold ${
            m.method_type === "bank" ? "bg-blue-600" : "bg-coral-500"
          }`}
        >
          {m.method_type === "bank" ? "BANK" : "MB"}
        </div>
        <div className="flex-1 min-w-0">
          {m.method_type === "bank" ? (
            <>
              <div className="font-semibold text-[14px] text-stone-900">
                {m.bank_name}
                {m.branch ? ` · ${m.branch}` : ""}
              </div>
              <div className="text-[12.5px] text-stone-700 mt-1 grid gap-0.5">
                <CopyLine
                  label={locale === "bn" ? "অ্যাকাউন্ট নং" : "Account #"}
                  value={m.account_number ?? ""}
                  onCopy={(v) => copy(v, "account")}
                  copied={copied === "account"}
                />
                <div>
                  <span className="text-stone-500 mr-1.5">
                    {locale === "bn" ? "নাম" : "Name"}:
                  </span>
                  {m.account_name}
                </div>
                {m.routing_number && (
                  <CopyLine
                    label={locale === "bn" ? "রাউটিং" : "Routing"}
                    value={m.routing_number}
                    onCopy={(v) => copy(v, "routing")}
                    copied={copied === "routing"}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-[14px] text-stone-900">
                {providerLabel(m.mb_provider)}
                <span className="ml-2 text-[11.5px] font-medium text-stone-500">
                  {numberTypeLabel(m.mb_number_type)}
                </span>
              </div>
              <div className="text-[12.5px] text-stone-700 mt-1">
                <CopyLine
                  label={locale === "bn" ? "নম্বর" : "Number"}
                  value={m.mb_phone ?? ""}
                  onCopy={(v) => copy(v, "phone")}
                  copied={copied === "phone"}
                />
              </div>
            </>
          )}
        </div>
        <span
          className={`w-5 h-5 rounded-full border-[2px] flex-shrink-0 mt-0.5 ${
            selected
              ? "border-teal-600 bg-teal-600 ring-4 ring-teal-100"
              : "border-stone-300"
          }`}
        />
      </div>
    </button>
  );
}

function CopyLine({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-stone-500">{label}:</span>
      <code className="font-mono font-semibold text-stone-900">{value}</code>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(value);
        }}
        className="text-[11px] font-semibold text-teal-700 hover:underline"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}
