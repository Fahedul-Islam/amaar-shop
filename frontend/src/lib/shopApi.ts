import { apiFetch, publicFetch } from './api';

export interface Shop {
  id: string;
  owner_user_id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  contact_phone: string;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicShop {
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

export interface DeliverySettings {
  shop_id: string;
  cod_enabled: boolean;
  delivery_charge: string;
  free_delivery_threshold: string | null;
  advance_payment_required: boolean;
  advance_payment_instructions: string;
  delivery_areas: string[];
  updated_at: string;
}

export interface PublicDeliverySettings {
  cod_enabled: boolean;
  delivery_charge: string;
  free_delivery_threshold: string | null;
  advance_payment_required: boolean;
  advance_payment_instructions: string;
  delivery_areas: string[];
}

export const createShop = (d: { name: string; slug: string; description?: string; contact_phone?: string }) =>
  apiFetch<Shop>('/api/shops', { method: 'POST', body: JSON.stringify(d) });

export const getMyShop = () => apiFetch<Shop>('/api/shops/me');

export const updateMyShop = (d: { name?: string; description?: string; contact_phone?: string }) =>
  apiFetch<Shop>('/api/shops/me', { method: 'PATCH', body: JSON.stringify(d) });

export function uploadLogo(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<{ url: string }>('/api/shops/me/logo', { method: 'POST', body: form });
}

export function uploadBanner(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<{ url: string }>('/api/shops/me/banner', { method: 'POST', body: form });
}

export const checkSlug = (slug: string) =>
  apiFetch<{ available: boolean }>(`/api/shops/check-slug?slug=${encodeURIComponent(slug)}`);

export const getDeliverySettings = () =>
  apiFetch<DeliverySettings>('/api/shops/me/delivery-settings');

export const updateDeliverySettings = (d: {
  cod_enabled: boolean;
  delivery_charge: string;
  free_delivery_threshold?: string | null;
  advance_payment_required: boolean;
  advance_payment_instructions?: string;
  delivery_areas: string[];
}) => apiFetch<DeliverySettings>('/api/shops/me/delivery-settings', { method: 'PUT', body: JSON.stringify(d) });

export const getPublicShop = (slug: string) =>
  publicFetch<PublicShop>(`/api/shops/by-slug/${encodeURIComponent(slug)}`);

export const getPublicDeliverySettings = (slug: string) =>
  publicFetch<PublicDeliverySettings>(`/api/shops/by-slug/${encodeURIComponent(slug)}/delivery-settings`);
