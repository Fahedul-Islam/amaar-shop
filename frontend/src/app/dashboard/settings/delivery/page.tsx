"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IcArrowLeft, IcPlus, IcTrash } from "@/components/icons/Icons";
import {
  getDeliverySettings,
  updateDeliverySettings,
  type DeliveryZone,
} from "@/lib/shopApi";
import { ApiRequestError } from "@/lib/api";
import { BD_DIVISIONS } from "@/lib/bdGeo";

export default function DeliverySettingsPage() {
  const { data, refetch } = useQuery({
    queryKey: ["delivery"],
    queryFn: getDeliverySettings,
  });
  const [cod, setCod] = useState(true);
  const [charge, setCharge] = useState("60");
  const [threshold, setThreshold] = useState("");
  const [advance, setAdvance] = useState(false);
  const [advanceText, setAdvanceText] = useState("");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [newDivision, setNewDivision] = useState("");
  const [newFee, setNewFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setCod(data.cod_enabled);
      setCharge(data.delivery_charge);
      setThreshold(data.free_delivery_threshold ?? "");
      setAdvance(data.advance_payment_required);
      setAdvanceText(data.advance_payment_instructions);
      setZones(data.delivery_zones ?? []);
    }
  }, [data]);

  const addZone = () => {
    if (!newDivision || !newFee) return;
    if (zones.some((z) => z.division === newDivision)) return;
    setZones([...zones, { division: newDivision, delivery_charge: newFee }]);
    setNewDivision("");
    setNewFee("");
  };

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
        delivery_zones: zones,
      });
      refetch();
      setMsg("Delivery settings saved.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const availableDivisions = BD_DIVISIONS.filter(
    (d) => !zones.some((z) => z.division === d),
  );

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-3xl">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium mb-3.5"
      >
        <IcArrowLeft size={14} /> Back to settings
      </Link>
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mb-1">
        Delivery
      </h1>
      <p className="text-stone-500 mb-5">
        Set your delivery areas and what you charge for each.
      </p>

      <form onSubmit={submit} className="grid gap-4">
        {/* Basic charges */}
        <Card className="p-5 grid gap-4" hover={false}>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={cod}
              onChange={(e) => setCod(e.target.checked)}
              className="accent-teal-600 mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">Cash on delivery</div>
              <div className="text-xs text-stone-500 mt-0.5">
                Customer pays when they receive the order.
              </div>
            </div>
          </label>

          <Input
            label="Charge for all other areas (৳)"
            value={charge}
            onChange={(e) => setCharge(e.target.value)}
            helper="Any area not listed in your zones below will be charged this amount."
          />

          <div>
            <Input
              label="Free delivery above (৳) — optional"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 1500"
            />
            <p className="text-xs text-teal-700 mt-1.5">
              💡 Orders above this amount will get free delivery automatically.
            </p>
          </div>
        </Card>

        {/* Advance payment */}
        <Card className="p-5 grid gap-3" hover={false}>
          <div>
            <h3 className="text-sm font-semibold mb-0.5">
              Advance Payment (bKash / Nagad)
            </h3>
            <p className="text-xs text-stone-500">
              Ask customers to pay a portion upfront before you confirm the
              order. Useful for new customers or high-value orders.
            </p>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={advance}
              onChange={(e) => setAdvance(e.target.checked)}
              className="accent-teal-600 mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">
                Require advance payment
              </div>
              {!advance && (
                <div className="text-xs text-stone-400 mt-0.5">
                  Currently off — customers can order without paying upfront.
                </div>
              )}
            </div>
          </label>

          {advance && (
            <>
              <Textarea
                label="Payment instructions"
                value={advanceText}
                onChange={(e) => setAdvanceText(e.target.value)}
                placeholder="e.g. Send ৳200 advance to bKash 01712345678 before we confirm your order."
              />
              <p className="text-xs text-amber-600">
                ⚠️ These instructions will be shown to every customer at
                checkout.
              </p>
            </>
          )}
        </Card>

        {/* Delivery zones */}
        <Card className="p-5" hover={false}>
          <h3 className="text-sm font-semibold mb-0.5">
            Delivery zones by division
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            Add divisions where you charge a different amount. Any area not
            listed here will use the default charge above.
          </p>

          <div className="grid gap-2 mb-4">
            {zones.map((z, i) => (
              <div
                key={`${z.division}-${i}`}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-md"
              >
                <div className="flex-1 text-sm font-medium">{z.division}</div>
                <div className="text-sm font-semibold text-teal-700">
                  ৳{z.delivery_charge}
                </div>
                <button
                  type="button"
                  onClick={() => setZones(zones.filter((_, idx) => idx !== i))}
                  className="text-stone-400 hover:text-red-500 transition-colors"
                  aria-label="Remove zone"
                >
                  <IcTrash size={16} />
                </button>
              </div>
            ))}

            {/* Default fallback row — always visible */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-stone-300 rounded-md">
              <div className="flex-1 text-sm text-stone-500">
                All other areas
              </div>
              <div className="text-sm font-semibold text-stone-600">
                ৳{charge || "—"}
              </div>
              <div className="w-4" />
            </div>
          </div>

          {availableDivisions.length > 0 ? (
            <div className="flex gap-2 items-end pt-1 border-t border-stone-100">
              <div className="flex-1">
                <label className="text-xs font-medium text-stone-700 block mb-1">
                  Division
                </label>
                <select
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value)}
                  className="w-full h-10 px-3 border border-stone-300 rounded-md text-sm bg-white"
                >
                  <option value="">Select division…</option>
                  {availableDivisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Fee (৳)"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
                placeholder="60"
                className="w-28"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addZone}
                disabled={!newDivision || !newFee}
              >
                <IcPlus size={14} /> Add
              </Button>
            </div>
          ) : (
            <p className="text-xs text-stone-500 pt-1 border-t border-stone-100">
              All divisions have been added.
            </p>
          )}
        </Card>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
            {error}
          </div>
        )}
        {msg && (
          <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-4 py-3">
            ✅ {msg}
          </div>
        )}

        <div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save delivery settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
