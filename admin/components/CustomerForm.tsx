'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { AddressFields, type AddressFieldsValue } from '@/components/AddressFields';
import { DuplicateCustomerDialog } from '@/components/DuplicateCustomerDialog';
import { BrowserAddressDecoy, NoFillInput, NoFillTextarea } from '@/components/NoBrowserFill';
import { createCustomer, findCustomerByMobile, updateCustomer } from '@/services/customer-actions';
import { ALL_CUSTOMER_SOURCES, normalizeMobile, type CustomerSource } from '@/types/customer';

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
  const notice = useActionNotice();
  const [name, setName] = useState(customer?.name ?? '');
  const [mobile, setMobile] = useState(customer?.mobile ?? '');
  const [source, setSource] = useState<CustomerSource>((customer?.source as CustomerSource) ?? 'whatsapp');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [addressFields, setAddressFields] = useState<AddressFieldsValue>({
    house: '',
    area: '',
    landmark: '',
    pincode: '',
    city: '',
    state: '',
    label: 'home',
    receiverName: '',
    receiverPhone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    name: string | null;
    mobile: string | null;
    orderCount: number;
  } | null>(null);
  const [ignoredMobile, setIgnoredMobile] = useState('');
  const creating = !customer;

  useEffect(() => {
    if (!creating) {
      setDuplicate(null);
      return;
    }
    const digits = normalizeMobile(mobile);
    if (digits.length !== 10) {
      setDuplicate(null);
      return;
    }
    if (ignoredMobile === digits) {
      return;
    }
    let cancelled = false;
    findCustomerByMobile(digits).then((result) => {
      if (cancelled || !result.customer) {
        return;
      }
      setDuplicate({
        id: result.customer.id,
        name: result.customer.name,
        mobile: result.customer.mobile,
        orderCount: result.customer.orderCount,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [creating, mobile, ignoredMobile]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = customer
      ? await updateCustomer(customer.id, { name, mobile, source, notes })
      : await createCustomer({
          name,
          mobile,
          notes,
          house: addressFields.house,
          address: addressFields.area,
          locality: addressFields.landmark,
          city: addressFields.city,
          pincode: addressFields.pincode,
        });

    if (result.error) {
      setSubmitting(false);
      if (creating && result.error.toLowerCase().includes('already exists')) {
        const match = await findCustomerByMobile(mobile);
        if (match.customer) {
          setDuplicate({
            id: match.customer.id,
            name: match.customer.name,
            mobile: match.customer.mobile,
            orderCount: match.customer.orderCount,
          });
          return;
        }
      }
      setError(result.error);
      return;
    }

    notice.show(creating ? `Customer ${name.trim()} added` : 'Customer details saved');
    const id = 'id' in result && result.id ? result.id : customer?.id;
    if (id) {
      router.push(`/customers/${id}`);
    } else {
      setSubmitting(false);
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="relative max-w-xl space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <BrowserAddressDecoy />
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Name</span>
        <NoFillInput
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          name="cust_nm"
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Mobile</span>
        <NoFillInput
          value={mobile}
          onChange={(event) => {
            setIgnoredMobile('');
            setMobile(event.target.value.replace(/\D/g, '').slice(0, 10));
          }}
          inputMode="numeric"
          required
          name="cust_ph"
          autoComplete="one-time-code"
          className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      {customer ? (
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Source</span>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as CustomerSource)}
            autoComplete="off"
            name="cust_src"
            className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
          >
            {ALL_CUSTOMER_SOURCES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-sm text-stone-500">How they reached you (WhatsApp, walk-in, phone, app).</span>
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Notes (optional)</span>
        <NoFillTextarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          name="cust_nt"
          autoComplete="off"
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      {customer ? null : (
        <div className="border-t border-stone-100 pt-4">
          <AddressFields value={addressFields} onChange={setAddressFields} showReceiver={false} />
        </div>
      )}
      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || Boolean(duplicate)}
        aria-busy={submitting}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? <Spinner /> : null}
        {submitting ? 'Saving…' : customer ? 'Save customer' : 'Add customer'}
      </button>
      {duplicate ? (
        <DuplicateCustomerDialog
          name={duplicate.name}
          mobile={duplicate.mobile}
          orderCount={duplicate.orderCount}
          onLoad={() => router.push(`/customers/${duplicate.id}`)}
          onDismiss={() => {
            setIgnoredMobile(normalizeMobile(duplicate.mobile ?? mobile));
            setDuplicate(null);
          }}
        />
      ) : null}
    </form>
  );
}
