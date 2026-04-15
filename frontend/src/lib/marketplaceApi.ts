// Public marketplace API — no auth required.
// These endpoints fetch data across all shops for the marketplace homepage.

import type { ProductImage, Pagination } from './productApi';
import type { Order } from './storefrontApi';

// --- Types ---

export interface MarketplaceProduct {
  id: string;
  name: string;
  description: string;
  price_bdt: string;
  stock: number;
  category_id: string | null;
  discount_type: string | null;
  discount_value: string | null;
  delivery_charge_dhaka: string | null;
  delivery_charge_outside: string | null;
  images: ProductImage[];
  shop_name: string;
  shop_slug: string;
  shop_logo_url: string;
}

export interface PaginatedMarketplaceProducts {
  data: MarketplaceProduct[];
  pagination: Pagination;
}

export interface MarketplaceShop {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  contact_phone: string;
}

export interface PaginatedMarketplaceShops {
  data: MarketplaceShop[];
  pagination: Pagination;
}

// --- Helpers ---

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

// --- Products ---

export function getMarketplaceProducts(
  params: { q?: string; category?: string; page?: number; page_size?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const query = qs.toString();
  return publicFetchEnvelope<PaginatedMarketplaceProducts>(`/api/marketplace/products${query ? `?${query}` : ''}`);
}

// --- Shops ---

export function getMarketplaceShops(
  params: { q?: string; page?: number; page_size?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const query = qs.toString();
  return publicFetchEnvelope<PaginatedMarketplaceShops>(`/api/marketplace/shops${query ? `?${query}` : ''}`);
}

// --- Categories ---

export function getMarketplaceCategories() {
  return publicFetch<string[]>('/api/marketplace/categories');
}

// --- Order Lookup ---

export function lookupOrdersByPhone(phone: string) {
  return publicFetch<Order[]>('/api/marketplace/orders/lookup', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}
