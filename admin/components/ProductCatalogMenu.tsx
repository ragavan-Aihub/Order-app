'use client';

import { useState } from 'react';

import { Spinner, useActionComplete, useActionNotice } from '@/components/ActionNotice';
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
  const [value, setValue] = useState<CatalogValue>(active ? 'active' : 'inactive');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notice = useActionNotice();
  const { complete, refreshing } = useActionComplete();
  const working = saving || (deleting && refreshing);

  async function onChange(next: string) {
    if (working) {
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
      const result = await deleteProduct(productId);
      setSaving(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleting(true);
      complete('Product deleted');
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
    const result = await updateProductActive(productId, next === 'active');
    setSaving(false);
    if (result.error) {
      setValue(previous);
      setError(result.error);
      return;
    }
    notice.show(next === 'active' ? 'Product is now active in the app' : 'Product hidden from the app');
  }

  return (
    <span className="inline-flex min-w-[8.5rem] flex-col items-start gap-1">
      <select
        aria-label="Catalog status"
        value={value}
        disabled={working}
        aria-busy={working}
        onChange={(event) => void onChange(event.target.value)}
        className="min-h-11 w-full min-w-[8.5rem] rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        {transacted ? null : <option value="delete">Delete</option>}
      </select>
      {working ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
          <Spinner size={12} /> {deleting ? 'Deleting…' : 'Saving…'}
        </span>
      ) : null}
      {error ? <p className="max-w-[16rem] text-xs text-red-700">{error}</p> : null}
    </span>
  );
}
