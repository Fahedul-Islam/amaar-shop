"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  IcChevR,
  IcInfo,
  IcMapPin,
  IcPlus,
  IcStore,
  IcTrash,
  IcImage,
  IcTruck,
  IcBanknote,
  IcGift,
} from "@/components/icons/Icons";
import {
  getDeliverySettings,
  updateDeliverySettings,
  type DeliveryZone,
} from "@/lib/shopApi";
import { ApiRequestError } from "@/lib/api";
import { BD_DIVISIONS } from "@/lib/bdGeo";
import { useShop } from "@/hooks/useShop";

interface FormState {
  charge: string;
  cod: boolean;
  thresholdEnabled: boolean;
  threshold: string;
  advance: boolean;
  advanceText: string;
  zones: DeliveryZone[];
}

const emptyState: FormState = {
  charge: "60",
  cod: true,
  thresholdEnabled: false,
  threshold: "",
  advance: false,
  advanceText: "",
  zones: [],
};

export default function DeliverySettingsPage() {
  const { shop } = useShop();
  const { data, refetch } = useQuery({
    queryKey: ["delivery"],
    queryFn: getDeliverySettings,
  });

  const [form, setForm] = useState<FormState>(emptyState);
  const [snapshot, setSnapshot] = useState<FormState>(emptyState);

  const [newDivision, setNewDivision] = useState("");
  const [newFee, setNewFee] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Hydrate form + snapshot on first server response.
  useEffect(() => {
    if (!data) return;
    const next: FormState = {
      charge: data.delivery_charge ?? "60",
      cod: data.cod_enabled,
      thresholdEnabled: !!data.free_delivery_threshold,
      threshold: data.free_delivery_threshold ?? "",
      advance: data.advance_payment_required,
      advanceText: data.advance_payment_instructions,
      zones: data.delivery_zones ?? [],
    };
    setForm(next);
    setSnapshot(next);
  }, [data]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(snapshot),
    [form, snapshot],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const addZone = () => {
    if (!newDivision || !newFee) return;
    if (form.zones.some((z) => z.division === newDivision)) return;
    update("zones", [
      ...form.zones,
      { division: newDivision, delivery_charge: newFee },
    ]);
    setNewDivision("");
    setNewFee("");
  };

  const removeZone = (i: number) =>
    update(
      "zones",
      form.zones.filter((_, idx) => idx !== i),
    );

  const updateZoneFee = (i: number, fee: string) =>
    update(
      "zones",
      form.zones.map((z, idx) => (idx === i ? { ...z, delivery_charge: fee } : z)),
    );

  const discard = () => setForm(snapshot);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDeliverySettings({
        cod_enabled: form.cod,
        delivery_charge: form.charge,
        free_delivery_threshold:
          form.thresholdEnabled && form.threshold ? form.threshold : null,
        advance_payment_required: form.advance,
        advance_payment_instructions: form.advance ? form.advanceText : "",
        delivery_zones: form.zones,
      });
      const next: FormState = {
        charge: updated.delivery_charge ?? "60",
        cod: updated.cod_enabled,
        thresholdEnabled: !!updated.free_delivery_threshold,
        threshold: updated.free_delivery_threshold ?? "",
        advance: updated.advance_payment_required,
        advanceText: updated.advance_payment_instructions,
        zones: updated.delivery_zones ?? [],
      };
      setForm(next);
      setSnapshot(next);
      refetch();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const availableDivisions = BD_DIVISIONS.filter(
    (d) => !form.zones.some((z) => z.division === d),
  );

  return (
    <div className="px-6 md:px-10 py-8 md:py-9 max-w-[980px] pb-32">
      {/* ── Page head ─────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-1.5">
          <Link href="/dashboard/settings" className="hover:text-stone-700">
            Settings
          </Link>
          <IcChevR size={12} className="text-stone-300" />
          <span className="text-stone-700">Delivery</span>
        </div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-stone-900 mb-1.5">
          Delivery settings
        </h1>
        <p className="text-sm text-stone-600">
          Set up where you ship and what you charge buyers. These show on every
          product page.
        </p>
      </div>

      {/* ── Settings tabs ─────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-stone-200 mb-7 -mx-1 overflow-x-auto no-scrollbar">
        <Tab href="/dashboard/settings" icon={<IcStore size={16} />}>
          Shop details
        </Tab>
        <Tab href="/dashboard/settings#branding" icon={<IcImage size={16} />}>
          Branding
        </Tab>
        <Tab active icon={<IcTruck size={16} />}>
          Delivery
        </Tab>
      </div>

      {/* ── Card 1 — Free delivery promo ──────────────────── */}
      <SCard
        icon={<IcGift size={22} />}
        iconBg="bg-amber-100 text-amber-700"
        title="Free delivery promo"
        description="Offer free delivery above a cart total to encourage bigger orders."
        rightAdornment={
          <Switch
            on={form.thresholdEnabled}
            onClick={() =>
              update("thresholdEnabled", !form.thresholdEnabled)
            }
            label="Toggle free delivery promo"
          />
        }
      >
        {form.thresholdEnabled ? (
          <>
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 bg-teal-50 border border-teal-200 rounded-[12px] mb-5">
              <div>
                <div className="text-sm font-semibold text-teal-900">
                  Free delivery on orders over ৳
                  {form.threshold ? formatNum(form.threshold) : "—"}
                </div>
                <div className="text-[12.5px] text-teal-700 mt-0.5">
                  Applies to all delivery zones — buyers see this on every
                  product page.
                </div>
              </div>
            </div>
            <Field label="Minimum order amount" required>
              <LeadInput
                lead="৳"
                value={form.threshold}
                onChange={(e) => update("threshold", e.target.value)}
                placeholder="1500"
                inputMode="numeric"
              />
            </Field>
          </>
        ) : (
          <p className="text-sm text-stone-500">
            Toggle this on to give buyers free delivery once their cart hits a
            minimum amount.
          </p>
        )}
      </SCard>

      {/* ── Card 2 — Delivery zones ───────────────────────── */}
      <SCard
        icon={<IcMapPin size={22} />}
        iconBg="bg-teal-50 text-teal-700"
        title="Delivery zones"
        description="Define your shipping rates by area. Buyers see the right rate based on the division they pick at checkout."
      >
        {/* Zone table header (desktop only) */}
        <div className="hidden md:grid grid-cols-[1.4fr_1fr_auto] gap-3.5 px-4 pb-2.5 border-b border-stone-100 text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
          <div>Zone</div>
          <div>Charge</div>
          <div></div>
        </div>

        {/* Fallback row — "All other areas" → maps to default charge */}
        <ZoneRow
          tone="green"
          icon={<IcMapPin size={18} />}
          name="All other areas"
          areas="Anywhere not listed below"
          fee={form.charge}
          onFeeChange={(v) => update("charge", v)}
          deletable={false}
        />

        {/* Configured zones */}
        {form.zones.map((z, i) => (
          <ZoneRow
            key={`${z.division}-${i}`}
            tone={zoneTone(z.division)}
            icon={zoneIcon(z.division)}
            name={z.division}
            areas="Division-specific rate"
            fee={z.delivery_charge}
            onFeeChange={(v) => updateZoneFee(i, v)}
            onDelete={() => removeZone(i)}
            deletable
          />
        ))}

        {/* Add zone control */}
        {availableDivisions.length > 0 ? (
          <div className="mt-3.5 p-4 border-[1.5px] border-dashed border-stone-300 rounded-[12px]">
            <div className="text-[13px] font-semibold text-stone-700 mb-2.5 flex items-center gap-1.5">
              <IcPlus size={15} /> Add a delivery zone
            </div>
            <div className="grid gap-2.5 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
              <div>
                <label className="block text-[12px] font-medium text-stone-600 mb-1">
                  Division
                </label>
                <select
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white border-[1.5px] border-stone-200 rounded-[10px] text-sm text-stone-900 hover:border-stone-300 focus:outline-none focus:border-teal-500 focus:ring-[3px] focus:ring-teal-100 transition-colors"
                >
                  <option value="">Choose a division…</option>
                  {availableDivisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-stone-600 mb-1">
                  Charge (৳)
                </label>
                <LeadInput
                  lead="৳"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  placeholder="100"
                  inputMode="numeric"
                />
              </div>
              <button
                type="button"
                onClick={addZone}
                disabled={!newDivision || !newFee}
                className="h-11 px-4 rounded-[10px] bg-teal-600 hover:bg-teal-700 disabled:bg-stone-200 disabled:text-stone-500 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <IcPlus size={16} /> Add zone
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 px-4 py-3 text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-[12px]">
            All divisions have a zone configured.
          </div>
        )}

        {/* Card footer */}
        <SCardFoot
          helper="Buyers see these rates at checkout based on their delivery address."
          rightSlot={
            shop ? (
              <Link
                href={`/s/${shop.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
              >
                Preview at checkout <IcChevR size={13} />
              </Link>
            ) : null
          }
        />
      </SCard>

      {/* ── Card 3 — Payment options ──────────────────────── */}
      <SCard
        icon={<IcBanknote size={22} />}
        iconBg="bg-purple-100 text-purple-700"
        title="Payment options"
        description="How buyers pay you. Cash on delivery covers most orders; advance payment is great for new customers or larger orders."
      >
        {/* COD row */}
        <PayRow
          on={form.cod}
          onToggle={() => update("cod", !form.cod)}
          color="bg-teal-600"
          short="COD"
          name="Cash on delivery"
          meta="Customers pay you when they receive the order."
          badge={form.cod ? "Active" : null}
        />

        {/* Advance payment row */}
        <PayRow
          on={form.advance}
          onToggle={() => update("advance", !form.advance)}
          color="bg-coral-500"
          short="বিকাশ"
          name="Advance payment"
          meta="Ask for partial bKash/Nagad payment before confirming."
          badge={form.advance ? "Active" : null}
        />

        {form.advance && (
          <div className="mt-2 px-4 py-4 bg-stone-50 border border-stone-200 rounded-[12px]">
            <Field
              label="Payment instructions"
              hint="Shown to every customer at checkout when they choose advance payment."
            >
              <textarea
                value={form.advanceText}
                onChange={(e) => update("advanceText", e.target.value)}
                placeholder="e.g. Send ৳200 advance to bKash 01712345678 before we confirm your order."
                className="w-full min-h-[96px] px-3.5 py-3 bg-white border-[1.5px] border-stone-200 rounded-[10px] text-sm text-stone-900 placeholder-stone-400 leading-[1.5] resize-y hover:border-stone-300 focus:outline-none focus:border-teal-500 focus:ring-[3px] focus:ring-teal-100 transition-colors"
              />
            </Field>
          </div>
        )}
      </SCard>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* ── Sticky save bar ───────────────────────────────── */}
      <div
        className={`sticky bottom-4 bg-white border border-stone-200 rounded-[14px] px-5 py-3.5 flex items-center justify-between gap-4 transition-all ${
          isDirty || savedFlash
            ? "shadow-[0_12px_28px_-12px_rgba(28,25,23,0.18)] opacity-100"
            : "opacity-0 pointer-events-none translate-y-2"
        }`}
      >
        <div className="flex items-center gap-2.5 text-sm font-medium text-stone-700">
          {savedFlash ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.18)]" />
              Saved
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_0_4px_#FEF3C7]" />
              You have unsaved changes
            </>
          )}
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={discard}
            disabled={!isDirty || saving}
            className="h-[42px] px-[18px] rounded-[10px] border-[1.5px] border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || saving}
            className="h-[42px] px-[18px] rounded-[10px] bg-teal-600 hover:bg-teal-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Subcomponents ────────────────────────────────────────── */

function Tab({
  active,
  href,
  icon,
  children,
}: {
  active?: boolean;
  href?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls = `inline-flex items-center gap-2 px-[18px] py-3 -mb-px text-sm transition-colors border-b-2 ${
    active
      ? "text-teal-700 border-teal-600 font-semibold"
      : "text-stone-500 border-transparent hover:text-stone-900 font-medium"
  }`;
  if (href && !active) {
    return (
      <Link href={href} className={cls}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
}

function SCard({
  icon,
  iconBg,
  title,
  description,
  rightAdornment,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  rightAdornment?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-[14px] mb-5 overflow-hidden">
      <div className="px-5 md:px-[26px] pt-[22px] pb-[18px] border-b border-stone-100 flex gap-4 items-start">
        <div
          className={`w-[42px] h-[42px] rounded-[10px] grid place-items-center flex-shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-stone-900 leading-tight">
            {title}
          </h2>
          <p className="text-[13px] text-stone-600 leading-[1.5] mt-1">
            {description}
          </p>
        </div>
        {rightAdornment && (
          <div className="flex-shrink-0 self-start">{rightAdornment}</div>
        )}
      </div>
      <div className="px-5 md:px-[26px] pt-[22px] pb-[26px]">{children}</div>
    </div>
  );
}

function SCardFoot({
  helper,
  rightSlot,
}: {
  helper: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="-mx-5 md:-mx-[26px] -mb-[26px] mt-[22px] px-5 md:px-[26px] py-4 bg-stone-50 border-t border-stone-200 flex justify-between items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-[12.5px] text-stone-600">
        <IcInfo size={16} className="text-stone-400" />
        {helper}
      </div>
      {rightSlot}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[18px] last:mb-0">
      <label className="flex items-center gap-1.5 text-[13.5px] font-semibold text-stone-900 tracking-[-0.005em] mb-1.5">
        {label}
        {required && <span className="text-coral-500">*</span>}
      </label>
      {hint && <p className="text-[12.5px] text-stone-600 mb-2 leading-[1.45]">{hint}</p>}
      {children}
    </div>
  );
}

function LeadInput({
  lead,
  ...rest
}: { lead: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-sm pointer-events-none">
        {lead}
      </span>
      <input
        {...rest}
        className="w-full h-11 pl-[42px] pr-3.5 bg-white border-[1.5px] border-stone-200 rounded-[10px] text-sm text-stone-900 placeholder-stone-400 hover:border-stone-300 focus:outline-none focus:border-teal-500 focus:ring-[3px] focus:ring-teal-100 transition-colors"
      />
    </div>
  );
}

function ZoneRow({
  tone,
  icon,
  name,
  areas,
  fee,
  onFeeChange,
  onDelete,
  deletable,
}: {
  tone: "teal" | "coral" | "blue" | "green" | "amber" | "purple";
  icon: React.ReactNode;
  name: string;
  areas: string;
  fee: string;
  onFeeChange: (v: string) => void;
  onDelete?: () => void;
  deletable: boolean;
}) {
  const toneMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    coral: "bg-coral-50 text-coral-600",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <div className="grid md:grid-cols-[1.4fr_1fr_auto] gap-3 md:gap-3.5 items-center px-4 py-3.5 border-[1.5px] border-stone-200 rounded-[12px] mt-2.5 hover:border-stone-300 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-[9px] grid place-items-center flex-shrink-0 ${toneMap[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[14.5px] text-stone-900 leading-tight">
            {name}
          </div>
          <div className="text-xs text-stone-500 mt-0.5 truncate">{areas}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-stone-500 text-sm md:hidden">৳</span>
        <input
          value={fee}
          onChange={(e) => onFeeChange(e.target.value)}
          inputMode="numeric"
          placeholder="0"
          className="w-full md:w-28 h-10 px-3 bg-white border-[1.5px] border-stone-200 rounded-[10px] text-[15px] font-bold text-stone-900 hover:border-stone-300 focus:outline-none focus:border-teal-500 focus:ring-[3px] focus:ring-teal-100 transition-colors"
          aria-label={`${name} delivery charge`}
        />
      </div>
      <div className="flex justify-end">
        {deletable && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="w-[34px] h-[34px] rounded-md grid place-items-center text-stone-500 hover:bg-coral-50 hover:text-coral-600 transition-colors"
            aria-label={`Remove ${name}`}
            title="Remove zone"
          >
            <IcTrash size={16} />
          </button>
        ) : (
          <span
            className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 px-2"
            title="Default fallback — applies when none of your zones match"
          >
            Default
          </span>
        )}
      </div>
    </div>
  );
}

function Switch({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative w-[42px] h-6 rounded-full transition-colors ${
        on ? "bg-teal-600" : "bg-stone-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(28,25,23,0.2)] transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function PayRow({
  on,
  onToggle,
  color,
  short,
  name,
  meta,
  badge,
}: {
  on: boolean;
  onToggle: () => void;
  color: string;
  short: string;
  name: string;
  meta: string;
  badge: string | null;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3.5 border-[1.5px] rounded-[12px] mb-2.5 transition-colors ${
        on
          ? "border-teal-500 bg-teal-50"
          : "border-stone-200 hover:border-stone-300"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-[9px] grid place-items-center flex-shrink-0 text-white font-bold text-[12px] ${color}`}
      >
        {short}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14.5px] font-semibold text-stone-900">
            {name}
          </span>
          {badge && (
            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[12.5px] text-stone-500 mt-0.5">{meta}</div>
      </div>
      <Switch on={on} onClick={onToggle} label={`Toggle ${name}`} />
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function zoneTone(division: string): "teal" | "coral" | "blue" | "amber" | "purple" {
  const tones: ("teal" | "coral" | "blue" | "amber" | "purple")[] = [
    "coral",
    "blue",
    "amber",
    "purple",
    "teal",
  ];
  let h = 0;
  for (let i = 0; i < division.length; i++)
    h = (h * 31 + division.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}

function zoneIcon(division: string) {
  if (division === "Dhaka")
    return (
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  if (division === "Chattogram") return <IcTruck size={18} />;
  return <IcMapPin size={18} />;
}

function formatNum(n: string) {
  const x = Number(n);
  if (!Number.isFinite(x)) return n;
  return x.toLocaleString("en-US");
}
