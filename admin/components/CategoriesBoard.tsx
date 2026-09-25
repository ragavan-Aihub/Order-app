'use client';

import { useMemo, useState } from 'react';

import { CategoryForm } from '@/components/CategoryForm';
import { TableScroll } from '@/components/TableScroll';
import { setCategoryActive } from '@/services/category-actions';
import type { ProductCategoryListItem } from '@/types/category';

export function CategoriesBoard({ categories }: { categories: ProductCategoryListItem[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [activeById, setActiveById] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function isActive(item: ProductCategoryListItem) {
    return activeById[item.id] ?? item.active;
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories.filter((item) => {
      const active = activeById[item.id] ?? item.active;
      if (status === 'active' && !active) {
        return false;
      }
      if (status === 'inactive' && active) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return item.name.toLowerCase().includes(needle);
    });
  }, [activeById, categories, query, status]);

  async function toggleActive(item: ProductCategoryListItem) {
    const next = !isActive(item);
    setError(null);
    setBusyId(item.id);
    setActiveById((current) => ({ ...current, [item.id]: next }));
    const result = await setCategoryActive({ id: item.id, active: next });
    setBusyId(null);
    if (result.error) {
      setActiveById((current) => ({ ...current, [item.id]: item.active }));
      setError(result.error);
    }
  }

  const editing = editingId ? categories.find((item) => item.id === editingId) : undefined;

  return (
    <div className="space-y-4">
      {editing ? (
        <div className="space-y-2">
          <CategoryForm category={editing} onSaved={() => setEditingId(null)} />
          <button type="button" onClick={() => setEditingId(null)} className="text-sm font-medium text-stone-600">
            Cancel edit
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories"
          className="min-h-11 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'inactive')}
          className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">No categories match this search.</div>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[36rem] table-fixed text-left text-base">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="w-44 px-4 py-3 font-medium">Status</th>
                <th className="w-28 px-4 py-3 font-medium">Products</th>
                <th className="w-24 px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const active = isActive(item);
                return (
                  <tr key={item.id} className="border-t border-stone-200">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={`${item.name} ${active ? 'active' : 'inactive'}`}
                        disabled={busyId === item.id}
                        onClick={() => void toggleActive(item)}
                        className="inline-flex h-6 w-[9.5rem] items-center gap-2 disabled:opacity-50"
                      >
                        <span
                          className={`relative h-6 w-10 shrink-0 rounded-full ${
                            active ? 'bg-emerald-600' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${
                              active ? 'left-[1.125rem]' : 'left-0.5'
                            }`}
                          />
                        </span>
                        <span className={`w-[4.75rem] text-left text-sm font-medium ${active ? 'text-emerald-800' : 'text-stone-500'}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">{item.productCount}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        className="font-medium text-emerald-800"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
