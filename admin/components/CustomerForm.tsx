'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { createCustomer, updateCustomer } from '@/services/customer-actions';
import { ALL_CUSTOMER_SOURCES, CUSTOMER_SOURCES, type CustomerSource } from '@/types/customer';

type CustomerFormProps = {
  customer?: {
    id: string;
    name: string;
    mobile: string;
    source: string;
    notes: string | null;
  };
};

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [name, setName] = useState(customer?.name ?? '');
  const [mobile, setMobile] = useState(customer?.mobile ?? '');
  const [source, setSource] = useState<CustomerSource>((customer?.source as CustomerSource) ?? 'whatsapp');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [house, setHouse] = useState('');
  const [locality, setLocality] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sources = customer ? ALL_CUSTOMER_SOURCES : CUSTOMER_SOURCES;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = customer
      ? await updateCustomer(customer.id, { name, mobile, source, notes })
      : await createCustomer({ name, mobile, source, notes, address, pincode, house, locality });

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    const id = 'id' in result && result.id ? result.id : customer?.id;
    if (id) {
      router.push(`/customers/${id}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Mobile</span>
        <input
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          inputMode="numeric"
          required
          className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Source</span>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value as CustomerSource)}
          className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
        >
          {sources.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-sm text-stone-500">How they reached you (WhatsApp, walk-in, phone, app).</span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      {customer ? null : (
        <fieldset className="space-y-3 border-t border-stone-100 pt-4">
          <legend className="text-sm font-medium text-stone-700">First address (optional)</legend>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">House / street</span>
            <input value={house} onChange={(event) => setHouse(event.target.value)} className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Locality</span>
            <input value={locality} onChange={(event) => setLocality(event.target.value)} className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Address</span>
            <textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={2} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Pincode</span>
            <input value={pincode} onChange={(event) => setPincode(event.target.value)} inputMode="numeric" className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2" />
          </label>
        </fieldset>
      )}
      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : customer ? 'Save customer' : 'Add customer'}
      </button>
    </form>
  );
}
