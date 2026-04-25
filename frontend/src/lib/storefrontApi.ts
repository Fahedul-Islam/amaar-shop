import { publicFetch, publicFetchEnvelope } from './api';
import type { PublicShop, PublicDeliverySettings } from './shopApi';
import type { ProductImage, Pagination } from './productApi';

export interface PublicProduct {
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

export const getShop = (slug: string) =>
  publicFetch<PublicShop>(`/api/shops/by-slug/${encodeURIComponent(slug)}`);

export const getDeliverySettings = (slug: string) =>
  publicFetch<PublicDeliverySettings>(`/api/shops/by-slug/${encodeURIComponent(slug)}/delivery-settings`);

export const getCategories = (slug: string) =>
  publicFetch<PublicCategory[]>(`/api/shops/by-slug/${encodeURIComponent(slug)}/categories`);

export function getProducts(
  slug: string,
  params: { q?: string; category_id?: string; page?: number; page_size?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category_id) qs.set('category_id', params.category_id);
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  const q = qs.toString();
  return publicFetchEnvelope<PaginatedPublicProducts>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/products${q ? `?${q}` : ''}`,
  );
}

export const getProduct = (slug: string, productId: string) =>
  publicFetch<PublicProduct>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`,
  );

export const placeOrder = (slug: string, input: PlaceOrderInput) =>
  publicFetch<Order>(`/api/shops/by-slug/${encodeURIComponent(slug)}/orders`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const lookupOrder = (slug: string, orderID: string, customerPhone: string) =>
  publicFetch<Order>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderID)}/lookup`,
    { method: 'POST', body: JSON.stringify({ customer_phone: customerPhone }) },
  );

export const buyerCancelOrder = (
  slug: string,
  orderID: string,
  customerPhone: string,
  cancellationReason: string,
) =>
  publicFetch<Order>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderID)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({
        customer_phone: customerPhone,
        cancellation_reason: cancellationReason,
      }),
    },
  );
