'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { deleteProduct } from '@/services/product-actions';

export function ProductDeleteButton({
  productId,
  transacted,
  afterDelete,
}: {
  productId: string;
  transacted: boolean;
  afterDelete?: 'list' | 'stay';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (transacted || busy) {
      return;
    }
    if (!window.confirm('Delete this product? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deleteProduct(productId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (afterDelete === 'list') {
      router.push('/products');
    }
    router.refresh();
  }

  if (transacted) {
    return (
      <span className="inline-flex flex-col items-end">
        <button
          type="button"
          disabled
          title="This product is in existing orders. Set it inactive instead of deleting."
          aria-label="Delete unavailable because this product has orders"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-300"
        >
          <Trash2 className="h-5 w-5" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={busy}
        title="Delete product"
        aria-label="Delete product"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-5 w-5" aria-hidden />
      </button>
      {error ? <p className="mt-1 max-w-[10rem] text-right text-xs text-red-700">{error}</p> : null}
    </span>
  );
}
