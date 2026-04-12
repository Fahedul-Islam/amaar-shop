// Public storefront API — no auth required.
// These endpoints fetch by shop slug and are used by the customer-facing pages.

import type { PublicShop, PublicDeliverySettings } from './shopApi';
import type { ProductImage, Pagination } from './productApi';

// --- Types ---

export interface PublicProduct {
  id: string;
  name: string;
  description: string;
  price_bdt: string;
  stock: number;
  category_id: string | null;
  images: ProductImage[];
}

export interface PublicCategory {
  id: string;
  name: string;
}

export interface PaginatedPublicProducts {
  data: PublicProduct[];
  pagination: Pagination;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price_snapshot_bdt: string;
  quantity: number;
  line_total_bdt: string;
}

export interface Order {
  id: string;
  shop_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_area: string;
  note: string;
  subtotal_bdt: string;
  delivery_charge_bdt: string;
  total_bdt: string;
  status: string;
  advance_payment_required: boolean;
  advance_payment_received: boolean;
  cancelled_reason: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface PlaceOrderInput {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_area: string;
  note?: string;
  items: { product_id: string; quantity: number }[];
}

// --- Helpers ---

// Public endpoints don't need auth tokens so we use plain fetch.
async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Request failed' } }));
    throw body.error;
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return body.data as T;
}

async function publicFetchEnvelope<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Request failed' } }));
    throw body.error;
  }
  return (await res.json()) as T;
}

// --- Shop ---

export function getShop(slug: string) {
  return publicFetch<PublicShop>(`/api/shops/by-slug/${encodeURIComponent(slug)}`);
}

export function getDeliverySettings(slug: string) {
  return publicFetch<PublicDeliverySettings>(`/api/shops/by-slug/${encodeURIComponent(slug)}/delivery-settings`);
}

// --- Categories ---

export function getCategories(slug: string) {
  return publicFetch<PublicCategory[]>(`/api/shops/by-slug/${encodeURIComponent(slug)}/categories`);
}

// --- Products ---

export function getProducts(
  slug: string,
  params: { q?: string; category_id?: string; page?: number; page_size?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category_id) qs.set('category_id', params.category_id);
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const query = qs.toString();
  const path = `/api/shops/by-slug/${encodeURIComponent(slug)}/products${query ? `?${query}` : ''}`;
  return publicFetchEnvelope<PaginatedPublicProducts>(path);
}

export function getProduct(slug: string, productId: string) {
  return publicFetch<PublicProduct>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`,
  );
}

// --- Orders ---

export function placeOrder(slug: string, input: PlaceOrderInput) {
  return publicFetch<Order>(`/api/shops/by-slug/${encodeURIComponent(slug)}/orders`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function lookupOrder(slug: string, orderID: string, customerPhone: string) {
  return publicFetch<Order>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderID)}/lookup`,
    {
      method: 'POST',
      body: JSON.stringify({ customer_phone: customerPhone }),
    },
  );
}
