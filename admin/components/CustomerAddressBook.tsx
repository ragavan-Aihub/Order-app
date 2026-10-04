'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useActionNotice } from '@/components/ActionNotice';
import { CustomerAddressForm } from '@/components/CustomerAddressForm';
import { deleteCustomerAddress, saveCustomerAddress } from '@/services/customer-actions';
import type { CustomerAddress } from '@/services/customers';
import { stateFromPincode, type AddressLabel } from '@/types/address';

const pill =
  'min-h-9 rounded-full border border-stone-400 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50';

function AddressCard({
  customerId,
  address,
  receiverName,
  receiverPhone,
  onChanged,
  onRemoved,
}: {
  customerId: string;
  address: CustomerAddress;
  receiverName: string;
  receiverPhone: string;
  onChanged: (address: CustomerAddress, message: string) => void;
  onRemoved: (addressId: string, message: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(address.instructions ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = stateFromPincode(address.pincode);
  const phone = address.mobile || receiverPhone;

  async function persist(partial: { isDefault?: boolean; instructions?: string | null }, message: string) {
    setBusy(true);
    setError(null);
    const result = await saveCustomerAddress(customerId, {
      id: address.id,
      label: (address.label as AddressLabel) || 'home',
      house: address.house ?? '',
      area: address.address,
      landmark: address.locality ?? '',
      city: address.city ?? '',
      pincode: address.pincode,
      name: address.name || receiverName,
      mobile: phone,
      instructions:
        partial.instructions !== undefined ? (partial.instructions ?? '') : (address.instructions ?? undefined),
      isDefault: partial.isDefault ?? address.is_default,
    });
    setBusy(false);
    if (result.error || !result.address) {
      setError(result.error ?? 'Could not save the address.');
      return;
    }
    setNoteOpen(false);
    onChanged(result.address, message);
    router.refresh();
  }

  async function onRemove() {
    if (!window.confirm('Remove this address?')) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deleteCustomerAddress(customerId, address.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onRemoved(address.id, 'Address removed');
    router.refresh();
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <CustomerAddressForm
          customerId={customerId}
          address={address}
          receiverName={receiverName}
          receiverPhone={receiverPhone}
          onDone={(saved) => {
            setEditing(false);
            if (saved) {
              onChanged(saved, 'Address updated');
            }
          }}
        />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-sm font-medium text-stone-600">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="font-semibold">
        {address.name || receiverName || 'Customer'}
        {address.is_default ? <span className="ml-2 text-xs font-medium text-emerald-800">Default</span> : null}
      </p>
      {address.house ? <p className="mt-1 text-sm text-stone-800">{address.house}</p> : null}
      {address.address ? <p className="text-sm text-stone-800">{address.address}</p> : null}
      {address.locality ? <p className="text-sm text-stone-800">{address.locality}</p> : null}
      <p className="text-sm text-stone-800">
        {[address.city, state ? `${state.toUpperCase()} ${address.pincode}` : address.pincode]
          .filter(Boolean)
          .join(', ')}
      </p>
      <p className="text-sm text-stone-800">India</p>
      {phone ? <p className="mt-1 text-sm text-stone-800">Phone number: {phone}</p> : null}
      {address.instructions && !noteOpen ? (
        <p className="mt-2 text-sm text-stone-600">{address.instructions}</p>
      ) : null}
      {noteOpen ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Delivery instructions"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void persist({ instructions: note.trim() || null }, 'Delivery instructions saved')}
            className="text-sm font-medium text-emerald-800"
          >
            Save instructions
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setNoteOpen(true)} className="mt-2 block text-sm font-medium text-emerald-800">
          {address.instructions ? 'Edit delivery instructions' : 'Add delivery instructions'}
        </button>
      )}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setEditing(true)} className={pill}>
          Edit
        </button>
        <button type="button" disabled={busy} onClick={() => void onRemove()} className={pill}>
          Remove
        </button>
        <button
          type="button"
          disabled={busy || address.is_default}
          onClick={() => void persist({ isDefault: true }, 'Default address updated')}
          className={pill}
        >
          Set as Default
        </button>
      </div>
    </div>
  );
}

export function CustomerAddressBook({
  customerId,
  addresses,
  receiverName,
  receiverPhone,
}: {
  customerId: string;
  addresses: CustomerAddress[];
  receiverName: string;
  receiverPhone: string;
}) {
  const [adding, setAdding] = useState(false);
  const [items, setItems] = useState(addresses);
  const notice = useActionNotice();

  useEffect(() => {
    setItems(addresses);
  }, [addresses]);

  function applySaved(saved: CustomerAddress, message: string) {
    setItems((current) => {
      const others = current
        .filter((item) => item.id !== saved.id)
        .map((item) => (saved.is_default ? { ...item, is_default: false } : item));
      const exists = current.some((item) => item.id === saved.id);
      return exists ? [saved, ...others] : [...others, saved];
    });
    setAdding(false);
    notice.show(message);
  }

  return (
    <section className="max-w-xl space-y-3">
      {items.length === 0 && !adding ? (
        <p className="text-stone-600">No saved address yet.</p>
      ) : (
        items.map((address) => (
          <AddressCard
            key={address.id}
            customerId={customerId}
            address={address}
            receiverName={receiverName}
            receiverPhone={receiverPhone}
            onChanged={applySaved}
            onRemoved={(addressId, message) => {
              setItems((current) => current.filter((item) => item.id !== addressId));
              notice.show(message);
            }}
          />
        ))
      )}
      {adding ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <CustomerAddressForm
            customerId={customerId}
            receiverName={receiverName}
            receiverPhone={receiverPhone}
            onDone={(saved) => {
              if (saved) {
                applySaved(saved, 'Address added');
                return;
              }
              setAdding(false);
            }}
          />
          <button type="button" onClick={() => setAdding(false)} className="mt-2 text-sm font-medium text-stone-600">
            Cancel
          </button>
        </div>
      ) : items.length < 3 ? (
        <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold text-emerald-800">
          + Add address
        </button>
      ) : null}
    </section>
  );
}
