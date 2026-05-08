"use client";

import { useEffect, useState } from "react";
import { IcPlus, IcTrash } from "@/components/icons/Icons";
import {
  PaymentMethod,
  PaymentMethodInput,
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  numberTypeLabel,
  providerLabel,
  updatePaymentMethod,
} from "@/lib/paymentMethodApi";
import { ApiRequestError } from "@/lib/api";

const MB_PROVIDERS = ["bkash", "nagad", "rocket", "upay"];

interface DraftBank {
  bank_name: string;
  account_number: string;
  account_name: string;
  branch: string;
  routing_number: string;
}
interface DraftMobile {
  mb_provider: string;
  mb_phone: string;
  mb_number_type: "personal" | "agent" | "merchant";
}

const emptyBank: DraftBank = {
  bank_name: "",
  account_number: "",
  account_name: "",
  branch: "",
  routing_number: "",
};
const emptyMobile: DraftMobile = {
  mb_provider: "bkash",
  mb_phone: "",
  mb_number_type: "personal",
};

interface Props {
  /** Whether advance-payment toggle is on. The list is rendered regardless,
   * but the empty-state hint changes based on this. */
  advanceEnabled: boolean;
}

export default function PaymentMethods({ advanceEnabled }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [adding, setAdding] = useState<"bank" | "mobile_banking" | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      setLoading(true);
      const list = await listPaymentMethods();
      setMethods(list);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not load payment methods",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this payment method? Buyers won't see it anymore.")) return;
    try {
      await deletePaymentMethod(id);
      setMethods((m) => m.filter((x) => x.id !== id));
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not remove method",
      );
    }
  }

  async function handleToggleActive(m: PaymentMethod) {
    try {
      const updated = await updatePaymentMethod(m.id, {
        method_type: m.method_type,
        display_order: m.display_order,
        is_active: !m.is_active,
        bank_name: m.bank_name,
        account_number: m.account_number,
        account_name: m.account_name,
        branch: m.branch,
        routing_number: m.routing_number,
        mb_provider: m.mb_provider,
        mb_phone: m.mb_phone,
        mb_number_type: m.mb_number_type,
      });
      setMethods((list) => list.map((x) => (x.id === m.id ? updated : x)));
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not update method",
      );
    }
  }

  return (
    <div className="mt-3">
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Loading payment methods…</p>
      ) : methods.length === 0 ? (
        <div className="px-4 py-5 text-sm text-stone-600 bg-amber-50 border border-amber-200 rounded-[12px] mb-4">
          {advanceEnabled
            ? "Buyers won't see anything until you add at least one payment method."
            : "No payment methods configured yet."}
        </div>
      ) : (
        <div className="space-y-2.5 mb-4">
          {methods.map((m) => (
            <MethodRow
              key={m.id}
              m={m}
              onEdit={() => setEditing(m)}
              onDelete={() => handleDelete(m.id)}
              onToggleActive={() => handleToggleActive(m)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAdding("bank")}
          className="h-10 px-4 rounded-[10px] border-[1.5px] border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-800 text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors"
        >
          <IcPlus size={15} /> Add bank
        </button>
        <button
          type="button"
          onClick={() => setAdding("mobile_banking")}
          className="h-10 px-4 rounded-[10px] border-[1.5px] border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-800 text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors"
        >
          <IcPlus size={15} /> Add mobile banking
        </button>
      </div>

      {(adding || editing) && (
        <MethodModal
          mode={editing ? "edit" : "add"}
          existing={editing ?? undefined}
          methodType={editing ? editing.method_type : adding!}
          onClose={() => {
            setAdding(null);
            setEditing(null);
          }}
          onSaved={(saved) => {
            setMethods((list) => {
              const i = list.findIndex((x) => x.id === saved.id);
              if (i === -1) return [...list, saved];
              const copy = [...list];
              copy[i] = saved;
              return copy;
            });
            setAdding(null);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MethodRow({
  m,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  m: PaymentMethod;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 border-[1.5px] rounded-[12px] transition-colors ${
        m.is_active
          ? "border-stone-200 bg-white"
          : "border-stone-200 bg-stone-50 opacity-70"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-[9px] grid place-items-center flex-shrink-0 text-white text-[12px] font-bold ${
          m.method_type === "bank" ? "bg-blue-600" : "bg-coral-500"
        }`}
      >
        {m.method_type === "bank" ? "BANK" : "MB"}
      </div>
      <div className="flex-1 min-w-0">
        {m.method_type === "bank" ? (
          <>
            <div className="font-semibold text-[14.5px] text-stone-900 leading-tight">
              {m.bank_name}
              {m.branch ? ` · ${m.branch}` : ""}
            </div>
            <div className="text-xs text-stone-600 mt-0.5">
              A/C {m.account_number} · {m.account_name}
              {m.routing_number ? ` · Routing ${m.routing_number}` : ""}
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-[14.5px] text-stone-900 leading-tight">
              {providerLabel(m.mb_provider)} ·{" "}
              {numberTypeLabel(m.mb_number_type)}
            </div>
            <div className="text-xs text-stone-600 mt-0.5">{m.mb_phone}</div>
          </>
        )}
        {!m.is_active && (
          <span className="inline-flex mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
            Hidden from buyers
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleActive}
          className="h-8 px-3 text-[12.5px] font-semibold rounded-md border border-stone-200 hover:bg-stone-50 text-stone-700"
        >
          {m.is_active ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="h-8 px-3 text-[12.5px] font-semibold rounded-md border border-stone-200 hover:bg-stone-50 text-stone-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-8 h-8 grid place-items-center rounded-md text-stone-500 hover:bg-coral-50 hover:text-coral-600"
          aria-label="Delete payment method"
        >
          <IcTrash size={15} />
        </button>
      </div>
    </div>
  );
}

function MethodModal({
  mode,
  methodType,
  existing,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  methodType: "bank" | "mobile_banking";
  existing?: PaymentMethod;
  onClose: () => void;
  onSaved: (m: PaymentMethod) => void;
}) {
  const [bank, setBank] = useState<DraftBank>(() =>
    existing && existing.method_type === "bank"
      ? {
          bank_name: existing.bank_name ?? "",
          account_number: existing.account_number ?? "",
          account_name: existing.account_name ?? "",
          branch: existing.branch ?? "",
          routing_number: existing.routing_number ?? "",
        }
      : emptyBank,
  );
  const [mobile, setMobile] = useState<DraftMobile>(() =>
    existing && existing.method_type === "mobile_banking"
      ? {
          mb_provider: existing.mb_provider ?? "bkash",
          mb_phone: existing.mb_phone ?? "",
          mb_number_type:
            (existing.mb_number_type as DraftMobile["mb_number_type"]) ??
            "personal",
        }
      : emptyMobile,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: PaymentMethodInput =
        methodType === "bank"
          ? { method_type: "bank", is_active: existing?.is_active ?? true, ...bank }
          : {
              method_type: "mobile_banking",
              is_active: existing?.is_active ?? true,
              ...mobile,
            };
      const saved = existing
        ? await updatePaymentMethod(existing.id, payload)
        : await createPaymentMethod(payload);
      onSaved(saved);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not save method",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-stone-900/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-white rounded-[14px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="text-[17px] font-bold text-stone-900">
            {mode === "edit" ? "Edit" : "Add"}{" "}
            {methodType === "bank" ? "bank account" : "mobile banking"}
          </h3>
          <p className="text-[12.5px] text-stone-600 mt-0.5">
            Buyers will see these details at checkout.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {methodType === "bank" ? (
            <>
              <Field label="Bank name" required>
                <Input
                  value={bank.bank_name}
                  onChange={(e) =>
                    setBank({ ...bank, bank_name: e.target.value })
                  }
                  placeholder="e.g. Dutch-Bangla Bank"
                />
              </Field>
              <Field label="Account number" required>
                <Input
                  value={bank.account_number}
                  onChange={(e) =>
                    setBank({ ...bank, account_number: e.target.value })
                  }
                  placeholder="123-456-78901"
                />
              </Field>
              <Field label="Account holder name" required>
                <Input
                  value={bank.account_name}
                  onChange={(e) =>
                    setBank({ ...bank, account_name: e.target.value })
                  }
                  placeholder="Name as on the account"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Branch">
                  <Input
                    value={bank.branch}
                    onChange={(e) => setBank({ ...bank, branch: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Routing number">
                  <Input
                    value={bank.routing_number}
                    onChange={(e) =>
                      setBank({ ...bank, routing_number: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Provider" required>
                <select
                  value={mobile.mb_provider}
                  onChange={(e) =>
                    setMobile({ ...mobile, mb_provider: e.target.value })
                  }
                  className="w-full h-11 px-3.5 bg-white border-[1.5px] border-stone-200 rounded-[10px] text-sm text-stone-900 focus:outline-none focus:border-teal-500 focus:ring-[3px] focus:ring-teal-100"
                >
                  {MB_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {providerLabel(p)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Phone number" required>
                <Input
                  value={mobile.mb_phone}
                  onChange={(e) =>
                    setMobile({ ...mobile, mb_phone: e.target.value })
                  }
                  placeholder="01712345678"
                  inputMode="tel"
                />
              </Field>
              <Field label="Number type" required>
                <div className="flex gap-2">
                  {(["personal", "agent", "merchant"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setMobile({ ...mobile, mb_number_type: t })
                      }
                      className={`flex-1 h-10 rounded-[10px] border-[1.5px] text-[13px] font-semibold transition-colors ${
                        mobile.mb_number_type === t
                          ? "border-teal-500 bg-teal-50 text-teal-800"
                          : "border-stone-200 hover:border-stone-300 text-stone-700"
                      }`}
                    >
                      {numberTypeLabel(t)}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-stone-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 px-4 rounded-[10px] border-[1.5px] border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 px-4 rounded-[10px] bg-teal-600 hover:bg-teal-700 disabled:bg-stone-300 text-white text-sm font-semibold"
          >
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add method"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-900 mb-1.5">
        {label}
        {required && <span className="text-coral-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-11 px-3.5 bg-white border-[1.5px] border-stone-200 rounded-[10px] text-sm text-stone-900 placeholder-stone-400 hover:border-stone-300 focus:outline-none focus:border-teal-500 focus:ring-[3px] focus:ring-teal-100 transition-colors"
    />
  );
}
