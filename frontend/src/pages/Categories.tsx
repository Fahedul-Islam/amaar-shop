import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from '@/lib/productApi';
import { ApiRequestError } from '@/lib/api';

export default function Categories() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState('');
  const [editingID, setEditingID] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const createMutation = useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => {
      setNewName('');
      setError('');
      invalidate();
    },
    onError: (err) => setError(translateError(err, t)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, name),
    onSuccess: () => {
      setEditingID(null);
      setEditingName('');
      setError('');
      invalidate();
    },
    onError: (err) => setError(translateError(err, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (err) => setError(translateError(err, t)),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const startEdit = (c: Category) => {
    setEditingID(c.id);
    setEditingName(c.name);
  };

  const saveEdit = () => {
    if (!editingID) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id: editingID, name: trimmed });
  };

  const handleDelete = (c: Category) => {
    if (!window.confirm(t('categories.confirm_delete'))) return;
    deleteMutation.mutate(c.id);
  };

  const categories = categoriesQuery.data ?? [];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('categories.title')}</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-white rounded-lg shadow-sm border p-4 mb-4 flex gap-3"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('categories.name_placeholder')}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {createMutation.isPending ? t('categories.adding') : t('categories.add')}
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border divide-y">
        {categoriesQuery.isLoading ? (
          <div className="p-6 text-center text-gray-500">...</div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-center text-gray-500">{t('categories.empty')}</div>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              {editingID === c.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditingID(null);
                    }}
                    autoFocus
                    className="flex-1 mr-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={updateMutation.isPending}
                      className="rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {t('categories.save')}
                    </button>
                    <button
                      onClick={() => setEditingID(null)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t('categories.cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => startEdit(c)}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      {t('categories.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      {t('categories.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function translateError(err: unknown, t: (key: string, opts?: object) => string): string {
  if (err instanceof ApiRequestError) {
    return t(`errors.${err.code}`, { defaultValue: err.message });
  }
  return t('errors.unknown');
}
