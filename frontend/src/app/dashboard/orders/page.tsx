"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { IcChevR } from "@/components/icons/Icons";
import { ReportDownloadButton } from "@/components/ui/ReportDownloadButton";
import { listOrders, prettyOrderStatus } from "@/lib/orderApi";
import { formatBDT, formatDateTime } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";

// Tab keys are the raw status sent to the API; labels are seller-friendly.
const tabs: { key: string; label: string }[] = [
  { key: "All", label: "All" },
  { key: "pending", label: "Awaiting confirmation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "With courier" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function OrdersPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const validTabs = new Set(tabs.map((t) => t.key));
  const initialTab = params?.get("status");
  const [tab, setTab] = useState(
    initialTab && validTabs.has(initialTab) ? initialTab : "All",
  );

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", tab],
    queryFn: () =>
      listOrders({ status: tab === "All" ? undefined : tab, page_size: 100 }),
  });

  // Pass the active status tab to the report so it matches the seller's view.
  const reportExtraParams = tab !== "All" ? { status: tab } : undefined;

  return (
    <div className="px-6 md:px-8 py-6 md:py-7">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">
            Orders
          </h1>
          <p className="text-stone-500 mt-1 mb-4">
            Manage incoming orders across all zones.
          </p>
        </div>
        <ReportDownloadButton
          endpoint="/api/shops/me/exports/orders.pdf"
          filename="orders-report"
          label="Download report"
          extraParams={reportExtraParams}
        />
      </div>

      <div className="flex gap-1.5 mb-4 overflow-auto no-scrollbar">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                on
                  ? "bg-teal-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden" hover={false}>
        {isLoading ? (
          <div className="p-8 text-center text-stone-500 text-sm">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-stone-500 text-sm">
            No orders in this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-left">
                  <Th>Order</Th>
                  <Th>Buyer</Th>
                  <Th>Items</Th>
                  <Th>Total</Th>
                  <Th>Zone</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const area = [o.delivery_district, o.delivery_division]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                      className="border-t border-stone-100 cursor-pointer hover:bg-teal-50/60 group"
                    >
                      <Td>
                        <span className="font-mono text-stone-700 group-hover:text-teal-700">
                          {o.id.slice(0, 8)}
                        </span>
                      </Td>
                      <Td>
                        <div className="font-medium">{o.customer_name}</div>
                        <div className="text-[11px] text-stone-500">
                          {o.customer_phone}
                        </div>
                      </Td>
                      <Td>{o.items.length}</Td>
                      <Td className="font-semibold">
                        {formatBDT(o.total_bdt, locale)}
                      </Td>
                      <Td className="text-stone-600">{area || "—"}</Td>
                      <Td>
                        <Badge tone={statusTone(o.status)}>
                          {prettyOrderStatus(o.status)}
                        </Badge>
                      </Td>
                      <Td className="text-stone-500">
                        {formatDateTime(o.created_at, locale)}
                      </Td>
                      <Td className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-colors whitespace-nowrap">
                          Manage <IcChevR size={12} />
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-middle text-stone-900 ${className}`}>
      {children}
    </td>
  );
}
