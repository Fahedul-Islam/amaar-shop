import { apiFetch, publicFetch, publicFetchEnvelope } from './api';
import type { Pagination } from './productApi';

export interface Review {
  id: string;
  shop_id: string;
  product_id: string;
  product_name: string;
  order_id: string;
  order_item_id: string;
  customer_name: string;
  rating: number;
  body: string;
  image_url: string | null;
  owner_reply: string | null;
  owner_replied_at: string | null;
  created_at: string;
}

// OwnerReview is the seller-only view: includes the buyer's phone so the
// shop owner can follow up on a low rating or thank a happy buyer directly.
export interface OwnerReview extends Review {
  customer_phone: string;
}

export interface ShopRating {
  average: number;
  count: number;
}

export interface ProductRating {
  average: number;
  count: number;
}

export interface ShopReviewsPage {
  data: { rating: ShopRating; reviews: Review[] };
  pagination: Pagination;
}

export interface ProductReviewsPage {
  data: { rating: ProductRating; reviews: Review[] };
  pagination: Pagination;
}

export const getShopReviews = (slug: string, page = 1, pageSize = 20) =>
  publicFetchEnvelope<ShopReviewsPage>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/reviews?page=${page}&page_size=${pageSize}`,
  );

export const getProductReviews = (productId: string, page = 1, pageSize = 20) =>
  publicFetchEnvelope<ProductReviewsPage>(
    `/api/products/${encodeURIComponent(productId)}/reviews?page=${page}&page_size=${pageSize}`,
  );

export interface CreateReviewInput {
  order_item_id: string;
  customer_phone: string;
  rating: number;
  body: string;
  image_url?: string | null;
}

export const createReview = (input: CreateReviewInput) =>
  publicFetch<Review>('/api/marketplace/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export function uploadReviewImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  return publicFetch<{ url: string }>('/api/marketplace/reviews/image', {
    method: 'POST',
    body: form,
  });
}

// Owner-side
export const getOwnerReviews = (page = 1, pageSize = 20) =>
  apiFetch<{ rating: ShopRating; reviews: OwnerReview[] }>(
    `/api/shops/me/reviews?page=${page}&page_size=${pageSize}`,
  );

export const replyToReview = (reviewId: string, reply: string) =>
  apiFetch<OwnerReview>(`/api/shops/me/reviews/${encodeURIComponent(reviewId)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ reply }),
  });
