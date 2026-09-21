'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { deleteCustomer } from '@/services/customer-actions';

export function CustomerDeleteButton({ customerId, disabled }: { customerId: string; disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (disabled || !window.confirm('Delete this customer? Orders must be empty.')) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deleteCustomer(customerId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push('/customers');
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled || busy}
        className="min-h-11 rounded-lg border border-red-200 px-4 py-2 font-medium text-red-800 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete customer'}
      </button>
      {disabled ? <p className="mt-1 text-sm text-stone-500">Customers with orders cannot be deleted.</p> : null}
      {error ? <p className="mt-1 text-red-700">{error}</p> : null}
    </div>
  );
}
