'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IcPlus, IcTrash } from '@/components/icons/Icons';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from '@/lib/productApi';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({ queryKey: ['cats'], queryFn: listCategories });
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');

  const createMut = useMutation({
    mutationFn: (n: string) => createCategory(n),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['cats'] });
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => updateCategory(id, n),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['cats'] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cats'] }),
  });

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-3xl">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mb-1">Categories</h1>
      <p className="text-stone-500 mb-5">Organize products into categories shoppers can filter by.</p>

      <Card className="p-5 mb-5" hover={false}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMut.mutate(name.trim());
          }}
          className="flex gap-2 items-end"
        >
          <div className="flex-1">
            <Input label="New category" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarees" />
          </div>
          <Button type="submit" variant="primary" disabled={createMut.isPending}>
            <IcPlus size={14} /> Add
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden" hover={false}>
        {cats.length === 0 ? (
          <div className="p-8 text-sm text-stone-500 text-center">No categories yet.</div>
        ) : (
          cats.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-5 py-3 ${i > 0 ? 'border-t border-stone-100' : ''}`}
            >
              {editing?.id === c.id ? (
                <>
                  <Input className="flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Button variant="primary" size="sm" onClick={() => updateMut.mutate({ id: c.id, n: editName })}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <div className="flex-1 text-sm">{c.name}</div>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setEditName(c.name); }}>Edit</Button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this category?')) deleteMut.mutate(c.id);
                    }}
                    className="text-stone-400 hover:text-red-600 p-1.5"
                    aria-label="Delete"
                  >
                    <IcTrash size={16} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
