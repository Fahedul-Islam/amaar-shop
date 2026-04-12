import { apiFetch, apiFetchEnvelope } from './api';

// --- Types ---

export interface Category {
  id: string;
  shop_id: string;
  name: string;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id?: string;
  url: string;
  sort_order: number;
  created_at?: string;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  description: string;
  price_bdt: string;
  stock: number;
  is_active: boolean;
  is_archived: boolean;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface PaginatedProducts {
  data: Product[];
  pagination: Pagination;
}

export interface ProductListFilter {
  q?: string;
  category_id?: string;
  is_active?: boolean;
  is_archived?: boolean;
  page?: number;
  page_size?: number;
}

// --- Categories ---

export function listCategories() {
  return apiFetch<Category[]>('/api/shops/me/categories');
}

export function createCategory(name: string) {
  return apiFetch<Category>('/api/shops/me/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateCategory(id: string, name: string) {
  return apiFetch<Category>(`/api/shops/me/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteCategory(id: string) {
  return apiFetch<void>(`/api/shops/me/categories/${id}`, { method: 'DELETE' });
}

// --- Products ---

export function listProducts(filter: ProductListFilter = {}) {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.category_id) params.set('category_id', filter.category_id);
  if (filter.is_active !== undefined) params.set('is_active', String(filter.is_active));
  if (filter.is_archived !== undefined) params.set('is_archived', String(filter.is_archived));
  if (filter.page) params.set('page', String(filter.page));
  if (filter.page_size) params.set('page_size', String(filter.page_size));

  const qs = params.toString();
  const path = qs ? `/api/shops/me/products?${qs}` : '/api/shops/me/products';
  return apiFetchEnvelope<PaginatedProducts>(path);
}

export function getProduct(id: string) {
  return apiFetch<Product>(`/api/shops/me/products/${id}`);
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price_bdt: string;
  stock: number;
  category_id?: string | null;
  is_active?: boolean;
}

export function createProduct(input: CreateProductInput) {
  return apiFetch<Product>('/api/shops/me/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price_bdt?: string;
  stock?: number;
  category_id?: string | null;
  is_active?: boolean;
}

export function updateProduct(id: string, input: UpdateProductInput) {
  return apiFetch<Product>(`/api/shops/me/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: string) {
  return apiFetch<void>(`/api/shops/me/products/${id}`, { method: 'DELETE' });
}

export function archiveProduct(id: string) {
  return apiFetch<{ id: string; is_archived: boolean }>(
    `/api/shops/me/products/${id}/archive`,
    { method: 'POST' },
  );
}

// --- Product images ---

export function uploadProductImage(productID: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<ProductImage>(`/api/shops/me/products/${productID}/images`, {
    method: 'POST',
    body: form,
  });
}

export function deleteProductImage(productID: string, imageID: string) {
  return apiFetch<void>(`/api/shops/me/products/${productID}/images/${imageID}`, {
    method: 'DELETE',
  });
}

export function reorderProductImages(productID: string, imageIDs: string[]) {
  return apiFetch<ProductImage[]>(
    `/api/shops/me/products/${productID}/images/reorder`,
    {
      method: 'PATCH',
      body: JSON.stringify({ image_ids: imageIDs }),
    },
  );
}
