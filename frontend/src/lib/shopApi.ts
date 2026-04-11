import { apiFetch } from './api';

// --- Types ---

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

// --- Seller endpoints ---

export function createShop(data: {
  name: string;
  slug: string;
  description?: string;
  contact_phone?: string;
}) {
  return apiFetch<Shop>('/api/shops', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getMyShop() {
  return apiFetch<Shop>('/api/shops/me');
}

export function updateMyShop(data: {
  name?: string;
  description?: string;
  contact_phone?: string;
}) {
  return apiFetch<Shop>('/api/shops/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function uploadLogo(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<{ url: string }>('/api/shops/me/logo', {
    method: 'POST',
    body: form,
  });
}

export function uploadBanner(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<{ url: string }>('/api/shops/me/banner', {
    method: 'POST',
    body: form,
  });
}

export function checkSlug(slug: string) {
  return apiFetch<{ available: boolean }>(`/api/shops/check-slug?slug=${encodeURIComponent(slug)}`);
}

export function getDeliverySettings() {
  return apiFetch<DeliverySettings>('/api/shops/me/delivery-settings');
}

export function updateDeliverySettings(data: {
  cod_enabled: boolean;
  delivery_charge: string;
  free_delivery_threshold?: string | null;
  advance_payment_required: boolean;
  advance_payment_instructions?: string;
  delivery_areas: string[];
}) {
  return apiFetch<DeliverySettings>('/api/shops/me/delivery-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Public endpoints ---

export function getPublicShop(slug: string) {
  return apiFetch<PublicShop>(`/api/shops/by-slug/${encodeURIComponent(slug)}`);
}

export function getPublicDeliverySettings(slug: string) {
  return apiFetch<PublicDeliverySettings>(`/api/shops/by-slug/${encodeURIComponent(slug)}/delivery-settings`);
}
