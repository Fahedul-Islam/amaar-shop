import { apiFetch, publicFetch } from "./api";

export type PaymentMethodType = "bank" | "mobile_banking";
export type MBNumberType = "personal" | "agent" | "merchant";

export interface PaymentMethod {
  id: string;
  shop_id?: string;
  method_type: PaymentMethodType;
  display_order: number;
  is_active: boolean;

  // Bank fields
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  branch?: string;
  routing_number?: string;

  // Mobile banking fields
  mb_provider?: string;
  mb_phone?: string;
  mb_number_type?: MBNumberType;

  created_at?: string;
  updated_at?: string;
}

export interface PaymentMethodInput {
  method_type: PaymentMethodType;
  display_order?: number;
  is_active?: boolean;

  bank_name?: string;
  account_number?: string;
  account_name?: string;
  branch?: string;
  routing_number?: string;

  mb_provider?: string;
  mb_phone?: string;
  mb_number_type?: MBNumberType;
}

// Seller (authenticated)
export const listPaymentMethods = () =>
  apiFetch<PaymentMethod[]>("/api/shops/me/payment-methods");

export const createPaymentMethod = (input: PaymentMethodInput) =>
  apiFetch<PaymentMethod>("/api/shops/me/payment-methods", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updatePaymentMethod = (id: string, input: PaymentMethodInput) =>
  apiFetch<PaymentMethod>(
    `/api/shops/me/payment-methods/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export const deletePaymentMethod = (id: string) =>
  apiFetch<void>(`/api/shops/me/payment-methods/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

// Public (storefront / checkout)
export const getPublicPaymentMethods = (slug: string) =>
  publicFetch<PaymentMethod[]>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/payment-methods`,
  );

// Receipt upload (storefront, public)
export async function uploadReceipt(slug: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await publicFetch<{ url: string }>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/receipt-upload`,
    { method: "POST", body: form },
  );
  return res.url;
}

// Display label for the provider, e.g. "Bkash", "Nagad", "Rocket".
export function providerLabel(p?: string): string {
  if (!p) return "";
  switch (p.toLowerCase()) {
    case "bkash":
      return "bKash";
    case "nagad":
      return "Nagad";
    case "rocket":
      return "Rocket";
    case "upay":
      return "Upay";
    default:
      return p[0].toUpperCase() + p.slice(1);
  }
}

// Friendly label for an MB number type.
export function numberTypeLabel(t?: string): string {
  switch (t) {
    case "personal":
      return "Personal";
    case "agent":
      return "Agent";
    case "merchant":
      return "Merchant";
    default:
      return t ?? "";
  }
}
