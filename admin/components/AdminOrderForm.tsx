'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { createAdminOrder } from '@/services/customer-actions';
import type { CustomerAddress, CustomerListItem } from '@/services/customers';
import type { Product } from '@/types/product';

type AdminOrderFormProps = {
  customers: Array<Pick<CustomerListItem, 'id' | 'name' | 'mobile'>>;
  selectedCustomerId?: string;
  addresses: CustomerAddress[];
  products: Product[];
};

export function AdminOrderForm({ customers, selectedCustomerId, addresses, products }: AdminOrderFormProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(selectedCustomerId ?? customers[0]?.id ?? '');
  const [addressId, setAddressId] = useState(addresses.find((item) => item.is_default)?.id ?? addresses[0]?.id ?? '');
  const [customAddress, setCustomAddress] = useState(false);
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'pending' | 'cash' | 'upi'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const book = useMemo(
    () => addresses.filter((item) => !item.customer_id || item.customer_id === customerId),
    [addresses, customerId],
  );

  useEffect(() => {
    const next = book.find((item) => item.is_default)?.id ?? book[0]?.id ?? '';
    setAddressId(next);
  }, [customerId, book]);

  const available = useMemo(() => products.filter((product) => product.available), [products]);
  const lines = available.filter((product) => (qty[product.id] ?? 0) > 0);
  const total = lines.reduce((sum, product) => sum + product.price * (qty[product.id] ?? 0), 0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!customerId) {
      setError('Choose a customer.');
      return;
    }
    setSubmitting(true);
    const useCustom = customAddress || book.length === 0;
    const result = await createAdminOrder({
      customerId,
      addressId: useCustom ? undefined : addressId || undefined,
      address: useCustom ? address : undefined,
      pincode: useCustom ? pincode : undefined,
      items: Object.entries(qty)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
      paymentMethod,
    });
    setSubmitting(false);
    if (result.error || !result.orderId) {
      setError(result.error ?? 'Could not create the order.');
      return;
    }
    router.push(`/orders/${result.orderId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {selectedCustomerId ? null : (
        <label className="block max-w-xl">
          <span className="mb-1 block text-sm text-stone-500">Customer</span>
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            required
            className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
          >
            <option value="">Select</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name || 'Customer'} · {customer.mobile}
              </option>
            ))}
          </select>
        </label>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Delivery</h2>
        {book.length > 0 && !customAddress ? (
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Saved address</span>
            <select
              value={addressId}
              onChange={(event) => setAddressId(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            >
              {book.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.is_default ? ' (default)' : ''}: {[item.house, item.locality, item.address, item.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={customAddress || book.length === 0}
            onChange={(event) => setCustomAddress(event.target.checked)}
          />
          Enter a different address
        </label>
        {customAddress || book.length === 0 ? (
          <div className="mt-3 space-y-3">
            <textarea value={address} onChange={(event) => setAddress(event.target.value)} required placeholder="Address" rows={3} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
            <input value={pincode} onChange={(event) => setPincode(event.target.value)} required placeholder="Pincode" className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2" />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Items</h2>
        {available.length === 0 ? (
          <p className="text-stone-600">No available products. Mark items available first.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {available.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-stone-500">₹{product.price}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  Qty
                  <input
                    type="number"
                    min={0}
                    value={qty[product.id] ?? 0}
                    onChange={(event) =>
                      setQty((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))
                    }
                    className="min-h-11 w-20 rounded-lg border border-stone-300 px-2 py-1"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-semibold">Total ₹{total.toFixed(2)}</p>
      </section>

      <label className="block max-w-xs">
        <span className="mb-1 block text-sm text-stone-500">Payment</span>
        <select
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as 'pending' | 'cash' | 'upi')}
          className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
        >
          <option value="pending">Pending</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
        </select>
      </label>

      {error ? <p className="text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting || available.length === 0}
        className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Placing…' : 'Place order'}
      </button>
    </form>
  );
}
