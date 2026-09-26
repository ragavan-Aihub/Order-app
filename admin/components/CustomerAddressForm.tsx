'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ActionNotice, useActionNotice } from '@/components/ActionNotice';
import { AddressFields, type AddressFieldsValue } from '@/components/AddressFields';
import { deleteCustomerAddress, saveCustomerAddress } from '@/services/customer-actions';
import type { CustomerAddress } from '@/services/customers';
import { stateFromPincode, type AddressLabel } from '@/types/address';

export function CustomerAddressForm({
  customerId,
  address,
  receiverName = '',
  receiverPhone = '',
  onDone,
}: {
  customerId: string;
  address?: CustomerAddress;
  receiverName?: string;
  receiverPhone?: string;
  onDone?: (address?: CustomerAddress) => void;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<AddressFieldsValue>({
    house: address?.house ?? '',
    area: address?.address ?? '',
    landmark: address?.locality ?? '',
    pincode: address?.pincode ?? '',
    state: stateFromPincode(address?.pincode ?? ''),
    label: (address?.label as AddressLabel) ?? 'home',
    receiverName: address?.name || receiverName,
    receiverPhone: (address?.mobile || receiverPhone).replace(/\D/g, '').slice(-10),
  });
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notice = useActionNotice();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    notice.clear();
    setSubmitting(true);
    const result = await saveCustomerAddress(customerId, {
      id: address?.id,
      label: fields.label,
      house: fields.house,
      area: fields.area,
      landmark: fields.landmark,
      pincode: fields.pincode,
      name: fields.receiverName,
      mobile: fields.receiverPhone,
      isDefault,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (onDone) {
      onDone(result.address);
    } else {
      notice.show('Saved successfully');
    }
    router.refresh();
  }

  async function onDelete() {
    if (!address || !window.confirm('Remove this address?')) {
      return;
    }
    setError(null);
    notice.clear();
    const result = await deleteCustomerAddress(customerId, address.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="relative space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <AddressFields value={fields} onChange={setFields} />
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
        Default address
      </label>
      {error ? <p className="text-red-700">{error}</p> : null}
      <ActionNotice message={notice.message} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save Address'}
        </button>
        {address && !onDone ? (
          <button type="button" onClick={onDelete} className="min-h-11 rounded-lg border border-stone-300 px-4 py-2">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
