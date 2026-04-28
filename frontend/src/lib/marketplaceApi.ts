import { publicFetch, publicFetchEnvelope } from './api';
import type { ProductImage, Pagination } from './productApi';
import type { Order } from './storefrontApi';

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
  rating_average: number;
  rating_count: number;
}

export interface PaginatedMarketplaceShops {
  data: MarketplaceShop[];
  pagination: Pagination;
}

export function getMarketplaceProducts(
  params: { q?: string; category?: string; page?: number; page_size?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const q = qs.toString();
  return publicFetchEnvelope<PaginatedMarketplaceProducts>(`/api/marketplace/products${q ? `?${q}` : ''}`);
}

export function getMarketplaceShops(params: { q?: string; page?: number; page_size?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const q = qs.toString();
  return publicFetchEnvelope<PaginatedMarketplaceShops>(`/api/marketplace/shops${q ? `?${q}` : ''}`);
}

export const getMarketplaceCategories = () => publicFetch<string[]>('/api/marketplace/categories');

export const lookupOrdersByPhone = (phone: string) =>
  publicFetch<Order[]>('/api/marketplace/orders/lookup', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
