'use client';

import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { BrowserAddressDecoy, NoFillInput, NoFillTextarea } from '@/components/NoBrowserFill';
import { createAdminOrder, createCustomer } from '@/services/customer-actions';
import type { CustomerAddress, CustomerListItem } from '@/services/customers';
import { CUSTOMER_SOURCES, customerSourceLabel, normalizeMobile, type CustomerSource } from '@/types/customer';
import { ORDER_CHANNELS } from '@/types/order';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

type CustomerOption = Pick<
  CustomerListItem,
  'id' | 'name' | 'mobile' | 'orderCount' | 'defaultAddress' | 'source'
>;

type AdminOrderFormProps = {
  customers: CustomerOption[];
  selectedCustomerId?: string;
  addresses: CustomerAddress[];
  products: Product[];
};

const fieldClass = 'min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm';

function addressLine(address: CustomerAddress) {
  return [address.house, address.locality, address.address, address.pincode].filter(Boolean).join(', ');
}

export function AdminOrderForm({
  customers: initialCustomers,
  selectedCustomerId,
  addresses: initialAddresses,
  products,
}: AdminOrderFormProps) {
  const router = useRouter();
  const initialPerson = initialCustomers.find((person) => person.id === selectedCustomerId);
  const initialBook = initialAddresses.filter((item) => item.customer_id === selectedCustomerId);
  const initialPreferred = initialBook.find((item) => item.is_default) ?? initialBook[0];

  const [people, setPeople] = useState(initialCustomers);
  const [books, setBooks] = useState(initialAddresses);
  const [customerId, setCustomerId] = useState(selectedCustomerId ?? '');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [name, setName] = useState(initialPerson?.name ?? '');
  const [mobile, setMobile] = useState(initialPerson?.mobile ?? '');
  const [source, setSource] = useState<CustomerSource>((initialPerson?.source as CustomerSource) || 'whatsapp');
  const [channel, setChannel] = useState('admin');
  const [addressId, setAddressId] = useState(initialPreferred?.id ?? '');
  const [address, setAddress] = useState(initialPreferred ? addressLine(initialPreferred) : '');
  const [pincode, setPincode] = useState(initialPreferred?.pincode ?? '');
  const [productQuery, setProductQuery] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'pending' | 'cash' | 'upi'>('pending');
  const [differentAddress, setDifferentAddress] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = people.find((person) => person.id === customerId) ?? null;
  const book = useMemo(
    () => books.filter((item) => item.customer_id === customerId),
    [books, customerId],
  );
  const activeAddressId = addressId || book.find((item) => item.is_default)?.id || book[0]?.id || '';
  const needAddressFields = creatingCustomer || differentAddress || (!!selected && book.length === 0);

  const customerMatches = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    return people
      .filter((person) => [person.name ?? '', person.mobile ?? ''].join(' ').toLowerCase().includes(needle))
      .slice(0, 8);
  }, [people, customerQuery]);

  const productMatches = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();
    if (!needle && productQuery.length === 0) {
      return [];
    }
    if (!needle) {
      return products;
    }
    return products.filter((product) => product.name.toLowerCase().includes(needle));
  }, [products, productQuery]);

  const lines = products
    .filter((product) => (qty[product.id] ?? 0) > 0)
    .map((product) => ({
      product,
      quantity: qty[product.id] ?? 0,
      subtotal: product.price * (qty[product.id] ?? 0),
    }));
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);

  const phoneOk = normalizeMobile(mobile).length === 10;
  const nameOk = name.trim().length >= 2;
  const addressOk = address.trim().length >= 4 && pincode.trim().length >= 4;
  const customerOk = creatingCustomer ? nameOk && phoneOk : Boolean(selected);
  const canCreate = customerOk && addressOk && lines.length > 0 && !submitting;

  function applyCustomer(person: CustomerOption) {
    const nextBook = books.filter((item) => item.customer_id === person.id);
    const preferred = nextBook.find((item) => item.is_default) ?? nextBook[0];
    setCustomerId(person.id);
    setCreatingCustomer(false);
    setCustomerQuery('');
    setCustomerOpen(false);
    setName(person.name ?? '');
    setMobile(person.mobile ?? '');
    setSource((person.source as CustomerSource) || 'whatsapp');
    setAddressId(preferred?.id ?? '');
    setAddress(preferred ? addressLine(preferred) : '');
    setPincode(preferred?.pincode ?? '');
    setDifferentAddress(!preferred);
  }

  function startNewCustomer() {
    setCustomerId('');
    setCreatingCustomer(true);
    setCustomerOpen(false);
    setCustomerQuery('');
    setName('');
    setMobile('');
    setSource('whatsapp');
    setAddressId('');
    setAddress('');
    setPincode('');
    setDifferentAddress(false);
  }

  function addProduct(product: Product) {
    if (!product.available) {
      return;
    }
    setQty((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
    setProductQuery('');
  }

  function setLineQty(productId: string, quantity: number) {
    setQty((current) => {
      const next = { ...current };
      if (quantity < 1) {
        delete next[productId];
      } else {
        next[productId] = quantity;
      }
      return next;
    });
  }

  async function ensureCustomer(): Promise<{ id: string; addressId?: string } | { error: string }> {
    if (customerId && !creatingCustomer) {
      return { id: customerId, addressId: activeAddressId || undefined };
    }

    const result = await createCustomer({
      name,
      mobile,
      source,
      address,
      pincode,
    });
    if (result.error || !result.id) {
      return { error: result.error ?? 'Could not save the customer.' };
    }

    const created: CustomerOption = {
      id: result.id,
      name: name.trim(),
      mobile: normalizeMobile(mobile),
      source,
      orderCount: 0,
      defaultAddress: [address, pincode].filter(Boolean).join(', ') || null,
    };
    setPeople((current) => [created, ...current]);
    if (result.addressId) {
      setBooks((current) => [
        {
          id: result.addressId!,
          user_id: null,
          customer_id: result.id!,
          label: 'home',
          name: created.name ?? '',
          mobile: created.mobile ?? '',
          alt_mobile: null,
          house: null,
          locality: null,
          address: address.trim(),
          pincode: pincode.trim(),
          instructions: null,
          is_default: true,
        },
        ...current,
      ]);
    }
    setCustomerId(result.id);
    setCreatingCustomer(false);
    return { id: result.id, addressId: result.addressId };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!canCreate) {
      setError('Select a customer, a delivery address, and at least one product.');
      return;
    }
    setSubmitting(true);
    const customer = await ensureCustomer();
    if ('error' in customer) {
      setSubmitting(false);
      setError(customer.error);
      return;
    }

    const useTypedAddress = creatingCustomer || differentAddress || !customer.addressId;
    const result = await createAdminOrder({
      customerId: customer.id,
      addressId: useTypedAddress ? undefined : customer.addressId,
      address: useTypedAddress ? address : undefined,
      pincode: useTypedAddress ? pincode : undefined,
      notes,
      channel,
      items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
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
    <form onSubmit={onSubmit} autoComplete="off" className="relative space-y-4">
      <BrowserAddressDecoy />
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Customer & delivery</h2>
          {creatingCustomer ? (
            <button
              type="button"
              onClick={() => {
                setCreatingCustomer(false);
                setName('');
                setMobile('');
                setAddress('');
                setPincode('');
              }}
              className="text-sm font-medium text-stone-600"
            >
              Cancel
            </button>
          ) : (
            <button type="button" onClick={startNewCustomer} className="text-sm font-medium text-emerald-800">
              + New Customer
            </button>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400" aria-hidden />
              <NoFillInput
                type="search"
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  setCustomerOpen(true);
                }}
                onFocus={() => setCustomerOpen(true)}
                name="q-cust"
                placeholder="Search name or phone"
                className={`${fieldClass} pl-9`}
              />
              {customerOpen && customerQuery.trim() ? (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-stone-200 bg-white shadow-sm">
                  {customerMatches.length === 0 ? (
                    <li className="px-3 py-2.5 text-sm text-stone-500">No match. Use + New Customer.</li>
                  ) : (
                    customerMatches.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => applyCustomer(person)}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-stone-50"
                        >
                          <span className="font-medium">{person.name || 'Customer'}</span>
                          <span className="text-xs text-stone-500">
                            {person.mobile} · {person.orderCount} orders
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>

            {selected && !creatingCustomer ? (
              <div className="rounded-md bg-stone-50 px-3 py-2.5">
                <p className="font-medium">{selected.name}</p>
                <p className="text-sm text-stone-600">{selected.mobile}</p>
                <p className="text-xs text-stone-500">
                  Source {customerSourceLabel(selected.source)} · {selected.orderCount} orders
                </p>
              </div>
            ) : creatingCustomer ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-1">
                  <span className="mb-1 block text-xs font-medium text-stone-500">Name</span>
                  <NoFillInput
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    name="cust-nm"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-stone-500">Phone</span>
                  <NoFillInput
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    inputMode="numeric"
                    name="cust-ph"
                    className={fieldClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-stone-500">Customer source</span>
                  <select
                    value={source}
                    onChange={(event) => setSource(event.target.value as CustomerSource)}
                    className={fieldClass}
                  >
                    {CUSTOMER_SOURCES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <p className="text-sm text-stone-500">Search for a customer or add a new one.</p>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-500">Order channel</span>
              <select value={channel} onChange={(event) => setChannel(event.target.value)} className={fieldClass}>
                {ORDER_CHANNELS.filter((item) => item.value !== 'api').map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3">
            {selected && !creatingCustomer && book.length > 0 && !differentAddress ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-500">Delivery address</span>
                <select
                  value={activeAddressId}
                  onChange={(event) => {
                    const next = book.find((item) => item.id === event.target.value);
                    setAddressId(event.target.value);
                    if (next) {
                      setAddress(addressLine(next));
                      setPincode(next.pincode);
                    }
                  }}
                  className={fieldClass}
                >
                  {book.map((item) => (
                    <option key={item.id} value={item.id}>
                      {addressLine(item)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {needAddressFields ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-stone-500">Address</span>
                  <NoFillTextarea
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    rows={3}
                    name="ship-line"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-stone-500">Pincode</span>
                  <NoFillInput
                    value={pincode}
                    onChange={(event) => setPincode(event.target.value)}
                    inputMode="numeric"
                    name="ship-code"
                    className={fieldClass}
                  />
                </label>
              </div>
            ) : null}

            {selected && !creatingCustomer ? (
              <button
                type="button"
                onClick={() => {
                  setDifferentAddress((open) => {
                    const next = !open;
                    if (next) {
                      setAddress('');
                      setPincode('');
                    } else {
                      const preferred = book.find((item) => item.is_default) ?? book[0];
                      setAddressId(preferred?.id ?? '');
                      setAddress(preferred ? addressLine(preferred) : '');
                      setPincode(preferred?.pincode ?? '');
                    }
                    return next;
                  });
                }}
                className="text-sm font-medium text-emerald-800"
              >
                {differentAddress ? 'Use saved address' : 'Change / add address'}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold">Products</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400" aria-hidden />
              <NoFillInput
                type="search"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                name="q-prod"
                placeholder="Search product name"
                className={`${fieldClass} pl-9`}
              />
            </div>
            <ul className="mt-2 max-h-72 overflow-y-auto rounded-md border border-stone-100">
              {productQuery.length === 0 ? (
                <li className="px-3 py-4 text-sm text-stone-500">Search products to add them to this order.</li>
              ) : productMatches.length === 0 ? (
                <li className="px-3 py-4 text-sm text-stone-500">No products match that search.</li>
              ) : (
                productMatches.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 border-b border-stone-100 px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-stone-500">
                        {formatPrice(product.price)} · {product.available ? 'Available' : 'Unavailable'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      disabled={!product.available}
                      className="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-800 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col">
            {lines.length === 0 ? (
              <p className="rounded-md border border-dashed border-stone-200 px-3 py-6 text-sm text-stone-500">
                No items yet. Add products from the list.
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {lines.map((line) => (
                  <li
                    key={line.product.id}
                    className="flex items-center justify-between gap-3 border-b border-stone-100 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{line.product.name}</p>
                      <p className="text-xs text-stone-500">{formatPrice(line.product.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLineQty(line.product.id, line.quantity - 1)}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-stone-300"
                        aria-label={`Decrease ${line.product.name}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setLineQty(line.product.id, line.quantity + 1)}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-stone-300"
                        aria-label={`Increase ${line.product.name}`}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLineQty(line.product.id, 0)}
                        className="inline-flex size-8 items-center justify-center text-stone-500"
                        aria-label={`Remove ${line.product.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
              <span className="text-sm text-stone-500">Total</span>
              <span className="text-lg font-semibold">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-500">Payment</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as 'pending' | 'cash' | 'upi')}
              className={fieldClass}
            >
              <option value="pending">Pending</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-500">Order notes (optional)</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Shown with delivery details"
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            disabled={!canCreate}
            className="min-h-10 rounded-md bg-emerald-800 px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'Creating…' : 'Create order'}
          </button>
        </div>
        {!canCreate && !submitting ? (
          <p className="mt-2 text-sm text-stone-500">
            {!customerOk
              ? 'Select or add a customer.'
              : !addressOk
                ? 'Add a valid delivery address and pincode.'
                : 'Add at least one product.'}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>
    </form>
  );
}
