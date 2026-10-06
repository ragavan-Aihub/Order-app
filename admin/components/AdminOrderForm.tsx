'use client';

import { AlertCircle, MapPin, Minus, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { AddressFields, type AddressFieldsValue } from '@/components/AddressFields';
import { DuplicateCustomerDialog } from '@/components/DuplicateCustomerDialog';
import { BrowserAddressDecoy, NoFillInput } from '@/components/NoBrowserFill';
import { PaymentMethodPicker, type PaymentChoice } from '@/components/PaymentMethodPicker';
import { createAdminOrder, createCustomer, deleteCustomer, findCustomerByMobile } from '@/services/customer-actions';
import type { CustomerAddress, CustomerListItem } from '@/services/customers';
import { composeAddressLine, isValidPincode, stateFromPincode, type AddressLabel } from '@/types/address';
import { ADMIN_CUSTOMER_SOURCE, customerSourceLabel, normalizeMobile } from '@/types/customer';
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
const searchClass =
  'min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';
const labelClass = 'mb-1.5 block text-xs font-medium text-stone-500';
const sectionTitle = 'text-[15px] font-semibold text-stone-900';
const cardClass = 'rounded-xl border bg-white shadow-sm';
const issueBorder = 'border-red-300 ring-2 ring-red-50';

function MissingNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-red-700" role="alert">
      <AlertCircle size={15} aria-hidden /> {children}
    </p>
  );
}

function addressLine(address: CustomerAddress) {
  return composeAddressLine(
    address.house ?? '',
    address.address ?? '',
    address.locality ?? '',
    address.city ?? '',
    stateFromPincode(address.pincode),
  );
}

function emptyAddress(person?: CustomerOption | null): AddressFieldsValue {
  return {
    house: '',
    area: '',
    landmark: '',
    pincode: '',
    city: '',
    state: '',
    label: 'home',
    receiverName: person?.name ?? '',
    receiverPhone: (person?.mobile ?? '').replace(/\D/g, '').slice(-10),
  };
}

function fromBook(row?: CustomerAddress | null, person?: CustomerOption | null): AddressFieldsValue {
  if (!row) {
    return emptyAddress(person);
  }
  return {
    house: row.house ?? '',
    area: row.address ?? '',
    landmark: row.locality ?? '',
    pincode: row.pincode ?? '',
    city: row.city ?? '',
    state: stateFromPincode(row.pincode),
    label: (row.label as AddressLabel) ?? 'home',
    receiverName: row.name || person?.name || '',
    receiverPhone: (row.mobile || person?.mobile || '').replace(/\D/g, '').slice(-10),
  };
}

type ProductRow =
  | { id: string; kind: 'search'; query: string }
  | { id: string; kind: 'line'; productId: string; quantity: number };

function filterProductsForQuery(products: Product[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return products;
  }
  return products.filter((product) => product.name.toLowerCase().includes(needle));
}

function ensureTrailingSearch(rows: ProductRow[], createSearchRowId: () => string): ProductRow[] {
  const next = [...rows];
  while (next.length > 1) {
    const last = next[next.length - 1];
    const prev = next[next.length - 2];
    if (last.kind === 'search' && prev.kind === 'search') {
      next.pop();
    } else {
      break;
    }
  }
  const last = next[next.length - 1];
  if (!last || last.kind !== 'search') {
    next.push({ id: createSearchRowId(), kind: 'search', query: '' });
  }
  return next;
}

const PRODUCT_SEARCH_PLACEHOLDER = 'Search or click to add an item';
const PRODUCT_SEARCH_TITLE = 'Type a product name or pick one from the list.';

export function AdminOrderForm({
  customers: initialCustomers,
  selectedCustomerId,
  addresses: initialAddresses,
  products,
}: AdminOrderFormProps) {
  const router = useRouter();
  const notice = useActionNotice();
  const productRowIdPrefix = useId();
  const productRowSeq = useRef(0);
  const createProductRowId = useCallback(() => {
    productRowSeq.current += 1;
    return `${productRowIdPrefix}-${productRowSeq.current}`;
  }, [productRowIdPrefix]);
  const initialPerson = initialCustomers.find((person) => person.id === selectedCustomerId);
  const initialBook = initialAddresses.filter((item) => item.customer_id === selectedCustomerId);
  const initialPreferred = initialBook.find((item) => item.is_default) ?? initialBook[0];

  const [people, setPeople] = useState(initialCustomers);
  const [books, setBooks] = useState(initialAddresses);
  const [customerId, setCustomerId] = useState(selectedCustomerId ?? '');
  const [customerQuery, setCustomerQuery] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  // A new customer is only a draft in this form. It is written to the database when the order is created.
  const [draftSaved, setDraftSaved] = useState(false);
  const [name, setName] = useState(initialPerson?.name ?? '');
  const [mobile, setMobile] = useState(initialPerson?.mobile ?? '');
  const [addressId, setAddressId] = useState(initialPreferred?.id ?? '');
  const [ship, setShip] = useState(fromBook(initialPreferred, initialPerson));
  const [productRows, setProductRows] = useState<ProductRow[]>(() => [
    { id: `${productRowIdPrefix}-0`, kind: 'search', query: '' },
  ]);
  const [openSearchRowId, setOpenSearchRowId] = useState<string | null>(null);
  const [payChoice, setPayChoice] = useState<PaymentChoice>('later');
  const [attempted, setAttempted] = useState(false);
  const [changingCustomer, setChangingCustomer] = useState(false);
  const customerSectionRef = useRef<HTMLElement>(null);
  const productsSectionRef = useRef<HTMLElement>(null);
  const [differentAddress, setDifferentAddress] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<CustomerOption | null>(null);
  const [ignoredMobile, setIgnoredMobile] = useState('');
  const peopleRef = useRef(people);
  peopleRef.current = people;

  const selected = people.find((person) => person.id === customerId) ?? null;
  const book = useMemo(
    () => books.filter((item) => item.customer_id === customerId),
    [books, customerId],
  );
  const activeAddressId = addressId || book.find((item) => item.is_default)?.id || book[0]?.id || '';
  const needAddressFields = creatingCustomer || differentAddress || (!!selected && book.length === 0);

  const customerMatches = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    if (!needle && customerQuery.length === 0) {
      return [];
    }
    if (!needle) {
      return people;
    }
    return people.filter((person) =>
      [person.name ?? '', person.mobile ?? ''].join(' ').toLowerCase().includes(needle),
    );
  }, [people, customerQuery]);

  const lines = useMemo(() => {
    return productRows.flatMap((row) => {
      if (row.kind !== 'line') {
        return [];
      }
      const product = products.find((item) => item.id === row.productId);
      if (!product) {
        return [];
      }
      return [
        {
          rowId: row.id,
          product,
          quantity: row.quantity,
          subtotal: product.price * row.quantity,
        },
      ];
    });
  }, [productRows, products]);

  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const activeAddress = book.find((item) => item.id === activeAddressId) ?? null;
  const showCustomerSearch = !creatingCustomer && (!selected || changingCustomer);
  const summaryFor = creatingCustomer
    ? name.trim() || 'New customer'
    : selected
      ? `For ${selected.name || 'customer'}`
      : 'No customer selected';

  const phoneOk = normalizeMobile(mobile).length === 10;
  const nameOk = name.trim().length >= 2;
  const structuredOk =
    ship.house.trim().length >= 1 &&
    ship.area.trim().length >= 2 &&
    isValidPincode(ship.pincode) &&
    (creatingCustomer ||
      (ship.receiverName.trim().length >= 2 && normalizeMobile(ship.receiverPhone).length === 10));
  const savedOk = Boolean(selected) && !creatingCustomer && !differentAddress && Boolean(activeAddressId);
  const addressOk = savedOk || structuredOk;
  const customerOk = creatingCustomer ? nameOk && phoneOk : Boolean(selected);
  const customerMissing = !customerOk;
  const addressMissing = (creatingCustomer || Boolean(selected)) && !addressOk;
  const productsMissing = lines.length === 0;
  const customerNote = creatingCustomer
    ? [!nameOk ? 'Enter the customer name' : null, !phoneOk ? 'Enter a 10-digit phone' : null]
        .filter(Boolean)
        .join(' and ')
    : 'Select or add a customer';
  const showCustomerIssue = attempted && (customerMissing || addressMissing);
  const showProductsIssue = attempted && productsMissing;

  function applyCustomer(person: CustomerOption) {
    const nextBook = books.filter((item) => item.customer_id === person.id);
    const preferred = nextBook.find((item) => item.is_default) ?? nextBook[0];
    setCustomerId(person.id);
    setCreatingCustomer(false);
    setDraftSaved(false);
    setCustomerQuery('');
    setDuplicate(null);
    setIgnoredMobile('');
    setName(person.name ?? '');
    setMobile(person.mobile ?? '');
    setAddressId(preferred?.id ?? '');
    setShip(fromBook(preferred, person));
    setDifferentAddress(!preferred);
  }

  function pickCustomer(person: CustomerOption) {
    applyCustomer(person);
    setChangingCustomer(false);
  }

  function mergeFoundCustomer(match: {
    id: string;
    name: string | null;
    mobile: string | null;
    source: string;
    orderCount: number;
    defaultAddress: string | null;
    addresses: CustomerAddress[];
  }): CustomerOption {
    const person: CustomerOption = {
      id: match.id,
      name: match.name,
      mobile: match.mobile,
      source: match.source,
      orderCount: match.orderCount,
      defaultAddress: match.defaultAddress,
    };
    setPeople((current) => (current.some((item) => item.id === person.id) ? current : [person, ...current]));
    setBooks((current) => {
      const ids = new Set(match.addresses.map((item) => item.id));
      return [...match.addresses, ...current.filter((item) => !ids.has(item.id))];
    });
    return person;
  }

  function startNewCustomer() {
    setCustomerId('');
    setCreatingCustomer(true);
    setDraftSaved(false);
    setCustomerQuery('');
    setDuplicate(null);
    setIgnoredMobile('');
    setName('');
    setMobile('');
    setAddressId('');
    setShip(emptyAddress());
    setDifferentAddress(false);
  }

  useEffect(() => {
    if (!creatingCustomer) {
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
    const local = peopleRef.current.find((person) => normalizeMobile(person.mobile ?? '') === digits);
    if (local) {
      setDuplicate(local);
      return;
    }
    let cancelled = false;
    findCustomerByMobile(digits).then((result) => {
      if (cancelled || !result.customer) {
        return;
      }
      const person = mergeFoundCustomer(result.customer);
      if (!cancelled) {
        setDuplicate(person);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [creatingCustomer, mobile, ignoredMobile]);

  function pickProduct(searchRowId: string, product: Product) {
    if (!product.available || product.active === false) {
      return;
    }

    setProductRows((current) => {
      const index = current.findIndex((row) => row.id === searchRowId);
      if (index < 0) {
        return current;
      }

      const existingIndex = current.findIndex(
        (row) => row.kind === 'line' && row.productId === product.id,
      );

      if (existingIndex >= 0) {
        const merged = current.map((row, i) =>
          i === existingIndex && row.kind === 'line'
            ? { ...row, quantity: row.quantity + 1 }
            : row,
        );
        const cleared = merged.map((row) =>
          row.id === searchRowId && row.kind === 'search' ? { ...row, query: '' } : row,
        );
        return ensureTrailingSearch(cleared, createProductRowId);
      }

      const next = [...current];
      next[index] = { id: searchRowId, kind: 'line', productId: product.id, quantity: 1 };
      return ensureTrailingSearch(next, createProductRowId);
    });

    setOpenSearchRowId(null);
  }

  function updateSearchQuery(searchRowId: string, query: string) {
    setProductRows((current) =>
      current.map((row) => (row.id === searchRowId && row.kind === 'search' ? { ...row, query } : row)),
    );
  }

  function setLineRowQty(rowId: string, quantity: number) {
    setProductRows((current) => {
      let next = current.map((row) =>
        row.id === rowId && row.kind === 'line' ? { ...row, quantity } : row,
      );
      if (quantity < 1) {
        next = next.filter((row) => row.id !== rowId);
      }
      return ensureTrailingSearch(next, createProductRowId);
    });
  }

  function openProductSearch(rowId: string) {
    setOpenSearchRowId(rowId);
  }

  async function ensureCustomer(): Promise<
    { id: string; addressId?: string; created?: boolean } | { error: string }
  > {
    if (customerId && !creatingCustomer) {
      return { id: customerId, addressId: activeAddressId || undefined };
    }

    const result = await createCustomer({
      name,
      mobile,
      house: ship.house,
      address: ship.area,
      locality: ship.landmark,
      city: ship.city,
      pincode: ship.pincode,
    });
    if (result.error && result.id) {
      // The customer row was created but the address was not: do not keep a half-saved customer.
      await deleteCustomer(result.id);
      return { error: 'Could not save the customer address. Please try again.' };
    }
    if (result.error || !result.id) {
      if (result.error?.toLowerCase().includes('already exists')) {
        const match = await findCustomerByMobile(mobile);
        if (match.customer) {
          setDuplicate(mergeFoundCustomer(match.customer));
          return { error: '' };
        }
      }
      return { error: result.error ?? 'Could not save the customer.' };
    }

    const created: CustomerOption = {
      id: result.id,
      name: name.trim(),
      mobile: normalizeMobile(mobile),
      source: ADMIN_CUSTOMER_SOURCE,
      orderCount: 0,
      defaultAddress: composeAddressLine(ship.house, ship.area, ship.landmark, ship.city, ship.state) || null,
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
          house: ship.house.trim() || null,
          locality: ship.landmark.trim() || null,
          address: ship.area.trim(),
          city: ship.city.trim() || null,
          pincode: ship.pincode.trim(),
          instructions: null,
          is_default: true,
        },
        ...current,
      ]);
    }
    setCustomerId(result.id);
    setCreatingCustomer(false);
    return { id: result.id, addressId: result.addressId, created: true };
  }

  // The order could not be created, so a customer made only for this order is removed again.
  async function rollbackNewCustomer(id: string) {
    const removed = await deleteCustomer(id);
    if (removed.error) {
      return;
    }
    setPeople((current) => current.filter((person) => person.id !== id));
    setBooks((current) => current.filter((item) => item.customer_id !== id));
    setCustomerId('');
    setCreatingCustomer(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (submitting || duplicate) {
      return;
    }
    if (customerMissing || addressMissing || productsMissing) {
      setAttempted(true);
      const first = customerMissing || addressMissing ? customerSectionRef.current : productsSectionRef.current;
      first?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setSubmitting(true);
    const customer = await ensureCustomer();
    if ('error' in customer) {
      setSubmitting(false);
      if (customer.error) {
        setError(customer.error);
      }
      return;
    }

    const useTypedAddress = creatingCustomer || differentAddress || !customer.addressId;
    let result: Awaited<ReturnType<typeof createAdminOrder>>;
    try {
      result = await createAdminOrder({
        customerId: customer.id,
        addressId: useTypedAddress ? undefined : customer.addressId,
        house: useTypedAddress ? ship.house : undefined,
        area: useTypedAddress ? ship.area : undefined,
        landmark: useTypedAddress ? ship.landmark : undefined,
        city: useTypedAddress ? ship.city : undefined,
        pincode: useTypedAddress ? ship.pincode : undefined,
        notes,
        items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        paymentMethod: payChoice === 'later' ? 'pending' : payChoice,
      });
    } catch {
      result = { error: 'Could not reach the server. Please try again.' };
    }
    if (result.error || !result.orderId) {
      if (customer.created) {
        await rollbackNewCustomer(customer.id);
      }
      setSubmitting(false);
      setError(result.error ?? 'Could not create the order.');
      return;
    }
    setAttempted(false);
    notice.show('Order created');
    router.push(`/orders/${result.orderId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="relative">
      <BrowserAddressDecoy />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <section
            ref={customerSectionRef}
            className={`${cardClass} scroll-mt-4 p-5 ${showCustomerIssue ? issueBorder : 'border-stone-200'}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className={sectionTitle}>
                {creatingCustomer && !draftSaved ? 'New customer' : 'Customer & delivery'}
              </h2>
              {creatingCustomer ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingCustomer(false);
                    setDraftSaved(false);
                    setDuplicate(null);
                    setIgnoredMobile('');
                    setName('');
                    setMobile('');
                    setShip(emptyAddress());
                  }}
                  className="text-sm font-medium text-stone-500 hover:text-stone-800"
                >
                  {draftSaved ? 'Discard' : 'Cancel'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setChangingCustomer(false);
                    startNewCustomer();
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-emerald-700"
                >
                  <UserPlus size={15} aria-hidden /> New customer
                </button>
              )}
            </div>

            {creatingCustomer && draftSaved ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                    {(name.trim() || 'C').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="font-semibold text-stone-900">{name.trim()}</p>
                      <p className="text-sm tabular-nums text-stone-600">{normalizeMobile(mobile)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-400">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">New</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftSaved(false)}
                    className="shrink-0 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Change
                  </button>
                </div>
                <div className="mt-3 border-t border-stone-200/70 pt-3">
                  <div className="flex items-start gap-2 text-sm text-stone-700">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-stone-400" aria-hidden />
                    <span className="min-w-0">
                      {composeAddressLine(ship.house, ship.area, ship.landmark, ship.city, stateFromPincode(ship.pincode))}
                    </span>
                  </div>
                </div>
              </div>
            ) : creatingCustomer ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Name</span>
                    <NoFillInput
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      name="cust-nm"
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Phone</span>
                    <NoFillInput
                      value={mobile}
                      onChange={(event) => {
                        setIgnoredMobile('');
                        setMobile(event.target.value.replace(/\D/g, '').slice(0, 10));
                      }}
                      inputMode="numeric"
                      name="cust-ph"
                      className={`${fieldClass} tabular-nums`}
                    />
                  </label>
                </div>
                <div className="border-t border-stone-100 pt-4">
                  <AddressFields compact value={ship} onChange={setShip} showReceiver={false} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDraftSaved(true)}
                    disabled={!(nameOk && phoneOk && structuredOk) || Boolean(duplicate)}
                    className="inline-flex min-h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Deliver to this address
                  </button>
                </div>
              </div>
            ) : showCustomerSearch ? (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 size-4 text-stone-400" aria-hidden />
                  <NoFillInput
                    type="search"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') {
                        return;
                      }
                      event.preventDefault();
                      if (customerMatches.length === 1) {
                        pickCustomer(customerMatches[0]);
                      }
                    }}
                    name="q-cust"
                    placeholder="Search name or phone, or press space to list"
                    className={`${searchClass} pl-9`}
                  />
                </div>
                {customerQuery.length > 0 ? (
                  <ul className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-sm">
                    {customerMatches.length === 0 ? (
                      <li className="px-3 py-2.5 text-sm text-stone-500">No match. Use New customer.</li>
                    ) : (
                      customerMatches.map((person) => (
                        <li key={person.id}>
                          <button
                            type="button"
                            onClick={() => pickCustomer(person)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
                          >
                            <span className="truncate font-medium text-stone-900">{person.name || 'Customer'}</span>
                            <span className="shrink-0 text-xs tabular-nums text-stone-500">
                              {person.mobile} · {person.orderCount} orders
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
                {selected ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChangingCustomer(false);
                      setCustomerQuery('');
                    }}
                    className="mt-2 text-sm font-medium text-stone-500 hover:text-stone-800"
                  >
                    Keep {selected.name || 'current customer'}
                  </button>
                ) : null}
              </div>
            ) : selected ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                    {(selected.name || 'C').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="font-semibold text-stone-900">{selected.name || 'Customer'}</p>
                      <p className="text-sm tabular-nums text-stone-600">{selected.mobile}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {customerSourceLabel(selected.source)} · {selected.orderCount} orders
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChangingCustomer(true)}
                    className="shrink-0 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Change customer
                  </button>
                </div>

                <div className="mt-3 space-y-3 border-t border-stone-200/70 pt-3">
                  {!differentAddress && activeAddress ? (
                    <div className="flex items-start gap-2 text-sm text-stone-700">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-stone-400" aria-hidden />
                      {book.length > 1 ? (
                        <select
                          value={activeAddressId}
                          onChange={(event) => {
                            const next = book.find((item) => item.id === event.target.value);
                            setAddressId(event.target.value);
                            if (next) {
                              setShip(fromBook(next, selected));
                            }
                          }}
                          aria-label="Delivery address"
                          className="min-h-9 w-full min-w-0 rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
                        >
                          {book.map((item) => (
                            <option key={item.id} value={item.id}>
                              {addressLine(item)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="min-w-0">{addressLine(activeAddress)}</span>
                      )}
                    </div>
                  ) : null}

                  {needAddressFields ? (
                    <AddressFields compact value={ship} onChange={setShip} showReceiver={!creatingCustomer} />
                  ) : null}

                  {book.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDifferentAddress((open) => {
                          const next = !open;
                          if (next) {
                            setShip(emptyAddress(selected));
                          } else {
                            const preferred = book.find((item) => item.is_default) ?? book[0];
                            setAddressId(preferred?.id ?? '');
                            setShip(fromBook(preferred, selected));
                          }
                          return next;
                        });
                      }}
                      className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      {differentAddress ? 'Use saved address' : 'Change / add address'}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {attempted && customerMissing && customerNote ? (
              <div className="mt-3">
                <MissingNote>{customerNote}</MissingNote>
              </div>
            ) : null}
            {attempted && addressMissing ? (
              <div className="mt-3">
                <MissingNote>
                  {creatingCustomer ? 'Add house, area and pincode' : 'Add house, area, pincode and receiver details'}
                </MissingNote>
              </div>
            ) : null}
          </section>

          <section
            ref={productsSectionRef}
            className={`${cardClass} scroll-mt-4 p-5 ${showProductsIssue ? issueBorder : 'border-stone-200'}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className={sectionTitle}>Products</h2>
              {itemCount > 0 ? (
                <span className="text-sm tabular-nums text-stone-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              ) : null}
            </div>

            <div className="rounded-lg border border-stone-200">
              <div
                className="grid min-w-[28rem] grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_2.5rem] gap-x-2 border-b border-stone-100 bg-stone-50/80 px-3 py-2 text-xs font-medium text-stone-500"
                role="row"
              >
                <div role="columnheader">Item name</div>
                <div className="text-center" role="columnheader">
                  Qty
                </div>
                <div className="text-right" role="columnheader">
                  Amount
                </div>
                <span className="sr-only" role="columnheader">
                  Actions
                </span>
              </div>
              <ul className="divide-y divide-stone-100 overflow-visible">
                {productRows.map((row) => {
                  if (row.kind === 'line') {
                    const product = products.find((item) => item.id === row.productId);
                    if (!product) {
                      return null;
                    }
                    const subtotal = product.price * row.quantity;
                    return (
                      <li
                        key={row.id}
                        className="grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_2.5rem] items-center gap-x-2 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-900">{product.name}</p>
                          <p className="text-xs tabular-nums text-stone-400">{formatPrice(product.price)} each</p>
                        </div>
                        <div className="flex justify-center">
                          <div className="flex items-center rounded-lg border border-stone-200 bg-white">
                            <button
                              type="button"
                              onClick={() => setLineRowQty(row.id, row.quantity - 1)}
                              className="inline-flex size-8 items-center justify-center rounded-l-lg text-stone-600 hover:bg-stone-50"
                              aria-label={`Decrease ${product.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums">{row.quantity}</span>
                            <button
                              type="button"
                              onClick={() => setLineRowQty(row.id, row.quantity + 1)}
                              className="inline-flex size-8 items-center justify-center rounded-r-lg text-stone-600 hover:bg-stone-50"
                              aria-label={`Increase ${product.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <span className="text-right text-sm font-semibold tabular-nums text-stone-900">
                          {formatPrice(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLineRowQty(row.id, 0)}
                          className="inline-flex size-8 items-center justify-center rounded-md text-stone-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${product.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    );
                  }

                  const matches = filterProductsForQuery(products, row.query);
                  const dropdownOpen = openSearchRowId === row.id;

                  return (
                    <li
                      key={row.id}
                      className={`px-3 py-2.5 ${dropdownOpen ? 'relative z-10 bg-white' : ''}`}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_2.5rem] items-start gap-x-2">
                        <div className="min-w-0">
                          <div className="relative">
                            <Search
                              className="pointer-events-none absolute left-3 top-3 size-4 text-stone-400"
                              aria-hidden
                            />
                            <NoFillInput
                              type="search"
                              lockUntilInteraction={false}
                              value={row.query}
                              onChange={(event) => {
                                updateSearchQuery(row.id, event.target.value);
                                openProductSearch(row.id);
                              }}
                              onFocus={() => openProductSearch(row.id)}
                              onBlur={() => {
                                window.setTimeout(() => {
                                  setOpenSearchRowId((open) => (open === row.id ? null : open));
                                }, 200);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') {
                                  return;
                                }
                                event.preventDefault();
                                if (matches.length === 1) {
                                  pickProduct(row.id, matches[0]);
                                }
                              }}
                              name={`q-prod-${row.id}`}
                              data-product-search-row={row.id}
                              placeholder={PRODUCT_SEARCH_PLACEHOLDER}
                              title={PRODUCT_SEARCH_TITLE}
                              autoComplete="off"
                              className={`${searchClass} pl-9`}
                              aria-expanded={dropdownOpen}
                              aria-controls={`product-list-${row.id}`}
                            />
                          </div>
                          {dropdownOpen ? (
                            <ul
                              id={`product-list-${row.id}`}
                              role="listbox"
                              className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-md"
                            >
                              {matches.length === 0 ? (
                                <li className="px-3 py-2.5 text-sm text-stone-500">No products match that search.</li>
                              ) : (
                                matches.map((product) => {
                                  const blocked = !product.available || product.active === false;
                                  return (
                                    <li key={product.id} role="option">
                                      <button
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => pickProduct(row.id, product)}
                                        disabled={blocked}
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50 disabled:opacity-40"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate font-semibold text-stone-900">{product.name}</p>
                                          <p className="text-xs tabular-nums text-stone-400">
                                            {formatPrice(product.price)}
                                            {product.active === false
                                              ? ' · Inactive'
                                              : !product.available
                                                ? ' · Coming soon'
                                                : ''}
                                          </p>
                                        </div>
                                        <Plus size={14} className="shrink-0 text-emerald-700" aria-hidden />
                                      </button>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          ) : null}
                        </div>
                        <span className="pt-2 text-center text-sm text-stone-300" aria-hidden>
                          —
                        </span>
                        <span className="pt-2 text-right text-sm text-stone-300" aria-hidden>
                          —
                        </span>
                        <span className="sr-only">Add a product</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {showProductsIssue ? (
              <div className="mt-3">
                <MissingNote>Add at least one product</MissingNote>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="lg:sticky lg:top-4">
          <section className={`${cardClass} border-stone-200`}>
            <div className="border-b border-stone-100 px-5 py-3.5">
              <h2 className={sectionTitle}>Order summary</h2>
              <p className="mt-0.5 truncate text-sm text-stone-500">{summaryFor}</p>
            </div>
            <div className="space-y-4 p-5">
              <dl className="space-y-2">
                <div className="flex items-center justify-between text-sm text-stone-600">
                  <dt className="sr-only">Items</dt>
                  <dd className="tabular-nums">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-stone-100 pt-3">
                  <dt className="text-sm font-medium text-stone-900">Total</dt>
                  <dd className="text-2xl font-bold tracking-tight tabular-nums text-stone-900">{formatPrice(total)}</dd>
                </div>
              </dl>

              <div>
                <p className={labelClass}>Payment</p>
                <PaymentMethodPicker value={payChoice} onChange={setPayChoice} allowLater size="segmented" />
              </div>

              <label className="block">
                <span className={labelClass}>
                  Notes <span className="font-normal text-stone-400">(optional)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Shown with delivery details"
                  rows={2}
                  className="w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || Boolean(duplicate)}
                aria-busy={submitting}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? <Spinner /> : null}
                {submitting ? 'Creating order…' : 'Create order'}
              </button>
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </div>
          </section>
        </aside>
      </div>
      {duplicate ? (
        <DuplicateCustomerDialog
          name={duplicate.name}
          mobile={duplicate.mobile}
          orderCount={duplicate.orderCount}
          onLoad={() => pickCustomer(duplicate)}
          onDismiss={() => {
            setIgnoredMobile(normalizeMobile(duplicate.mobile ?? mobile));
            setDuplicate(null);
          }}
        />
      ) : null}
    </form>
  );
}
