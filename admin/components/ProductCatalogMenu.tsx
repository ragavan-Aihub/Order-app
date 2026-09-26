'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ActionNotice, useActionNotice } from '@/components/ActionNotice';
import { deleteProduct, updateProductActive } from '@/services/product-actions';

type CatalogValue = 'active' | 'inactive';

export function ProductCatalogMenu({
  productId,
  active,
  transacted,
}: {
  productId: string;
  active: boolean;
  transacted: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<CatalogValue>(active ? 'active' : 'inactive');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notice = useActionNotice();

  async function onChange(next: string) {
    if (saving) {
      return;
    }
    if (next === 'delete') {
      if (transacted) {
        return;
      }
      if (!window.confirm('Delete this product? This cannot be undone.')) {
        return;
      }
      setSaving(true);
      setError(null);
      notice.clear();
      const result = await deleteProduct(productId);
      setSaving(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      return;
    }
    if (next !== 'active' && next !== 'inactive') {
      return;
    }
    if (next === value) {
      return;
    }
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    notice.clear();
    const result = await updateProductActive(productId, next === 'active');
    setSaving(false);
    if (result.error) {
      setValue(previous);
      setError(result.error);
      return;
    }
    notice.show('Saved successfully');
  }

  return (
    <span className="inline-flex min-w-[8.5rem] flex-col items-start gap-1">
      <select
        aria-label="Catalog status"
        value={value}
        disabled={saving}
        onChange={(event) => void onChange(event.target.value)}
        className="min-h-11 w-full min-w-[8.5rem] rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        {transacted ? null : <option value="delete">Delete</option>}
      </select>
      <ActionNotice message={notice.message} />
      {error ? <p className="max-w-[16rem] text-xs text-red-700">{error}</p> : null}
    </span>
  );
}
