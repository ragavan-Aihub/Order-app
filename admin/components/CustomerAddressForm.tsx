'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { deleteCustomerAddress, saveCustomerAddress } from '@/services/customer-actions';
import type { CustomerAddress } from '@/services/customers';

export function CustomerAddressForm({
  customerId,
  address,
}: {
  customerId: string;
  address?: CustomerAddress;
}) {
  const router = useRouter();
  const [label, setLabel] = useState<'home' | 'work' | 'other'>((address?.label as 'home' | 'work' | 'other') ?? 'home');
  const [house, setHouse] = useState(address?.house ?? '');
  const [locality, setLocality] = useState(address?.locality ?? '');
  const [line, setLine] = useState(address?.address ?? '');
  const [pincode, setPincode] = useState(address?.pincode ?? '');
  const [instructions, setInstructions] = useState(address?.instructions ?? '');
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await saveCustomerAddress(customerId, {
      id: address?.id,
      label,
      house,
      locality,
      address: line,
      pincode,
      instructions,
      isDefault,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function onDelete() {
    if (!address || !window.confirm('Remove this address?')) {
      return;
    }
    setError(null);
    const result = await deleteCustomerAddress(customerId, address.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap gap-2">
        {(['home', 'work', 'other'] as const).map((item) => (
          <label key={item} className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name={`label-${address?.id ?? 'new'}`} checked={label === item} onChange={() => setLabel(item)} />
            {item === 'home' ? 'Home' : item === 'work' ? 'Work' : 'Other'}
          </label>
        ))}
      </div>
      <input value={house} onChange={(event) => setHouse(event.target.value)} placeholder="House / street" className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2" />
      <input value={locality} onChange={(event) => setLocality(event.target.value)} placeholder="Locality" className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2" />
      <textarea value={line} onChange={(event) => setLine(event.target.value)} required placeholder="Address" rows={2} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      <input value={pincode} onChange={(event) => setPincode(event.target.value)} required placeholder="Pincode" inputMode="numeric" className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2" />
      <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Delivery notes (optional)" rows={2} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
        Default address
      </label>
      {error ? <p className="text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {submitting ? 'Saving…' : address ? 'Save address' : 'Add address'}
        </button>
        {address ? (
          <button type="button" onClick={onDelete} className="min-h-11 rounded-lg border border-stone-300 px-4 py-2">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
