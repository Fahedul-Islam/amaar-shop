import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  listProducts,
  listCategories,
  archiveProduct,
  deleteProduct,
  type ProductListFilter,
  type Product,
} from '@/lib/productApi';
import { ApiRequestError } from '@/lib/api';

type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';

const PAGE_SIZE = 20;

export default function Products() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [categoryID, setCategoryID] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const filter: ProductListFilter = {
    q: search || undefined,
    category_id: categoryID || undefined,
    page,
    page_size: PAGE_SIZE,
  };
  if (status === 'active') filter.is_active = true;
  if (status === 'inactive') filter.is_active = false;
  if (status === 'archived') filter.is_archived = true;

  const productsQuery = useQuery({
    queryKey: ['products', filter],
    queryFn: () => listProducts(filter),
    placeholderData: keepPreviousData,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const archiveMutation = useMutation({
    mutationFn: archiveProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onError: (err) => setError(translateError(err, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onError: (err) => setError(translateError(err, t)),
  });

  const products = productsQuery.data?.data ?? [];
  const pagination = productsQuery.data?.pagination;
  const totalPages = pagination?.total_pages ?? 1;

  const handleArchive = (p: Product) => {
    const msg = p.is_archived ? t('products.confirm_unarchive') : t('products.confirm_archive');
    if (!window.confirm(msg)) return;
    archiveMutation.mutate(p.id);
  };

  const handleDelete = (p: Product) => {
    if (!window.confirm(t('products.confirm_delete'))) return;
    deleteMutation.mutate(p.id);
  };

  const hasFilters = Boolean(search || categoryID || status !== 'all');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('products.title')}</h2>
        <Link
          to="/dashboard/products/new"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
        >
          {t('products.new')}
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="search"
          placeholder={t('products.search_placeholder')}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={categoryID}
          onChange={(e) => {
            setPage(1);
            setCategoryID(e.target.value);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('products.all_categories')}</option>
          {categoriesQuery.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as StatusFilter);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">{t('products.all_status')}</option>
          <option value="active">{t('products.active_only')}</option>
          <option value="inactive">{t('products.inactive_only')}</option>
          <option value="archived">{t('products.show_archived')}</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {productsQuery.isLoading ? (
          <div className="p-8 text-center text-gray-500">...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasFilters ? t('products.empty_filtered') : t('products.empty')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium w-16"></th>
                <th className="px-4 py-3 font-medium">{t('products.name')}</th>
                <th className="px-4 py-3 font-medium">{t('products.price')}</th>
                <th className="px-4 py-3 font-medium">{t('products.stock')}</th>
                <th className="px-4 py-3 font-medium">{t('products.status')}</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    {p.images[0] ? (
                      <img
                        src={p.images[0].url}
                        alt={p.name}
                        className="w-10 h-10 rounded object-cover border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 border" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/dashboard/products/${p.id}`}
                      className="font-medium text-gray-900 hover:text-primary-700"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">৳ {p.price_bdt}</td>
                  <td className="px-4 py-3 text-gray-700">{p.stock}</td>
                  <td className="px-4 py-3">
                    <StatusBadge product={p} t={t} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleArchive(p)}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 mr-3"
                    >
                      {p.is_archived ? t('products.unarchive') : t('products.archive')}
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      {t('products.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            {pagination.total} · {pagination.page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              ‹
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ product, t }: { product: Product; t: (key: string) => string }) {
  if (product.is_archived) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        {t('products.archived')}
      </span>
    );
  }
  if (!product.is_active) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        {t('products.inactive')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      {t('products.active')}
    </span>
  );
}

function translateError(err: unknown, t: (key: string, opts?: object) => string): string {
  if (err instanceof ApiRequestError) {
    return t(`errors.${err.code}`, { defaultValue: err.message });
  }
  return t('errors.unknown');
}
