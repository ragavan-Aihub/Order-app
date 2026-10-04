'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Spinner, useActionComplete } from '@/components/ActionNotice';
import { BrowserAddressDecoy, NoFillInput } from '@/components/NoBrowserFill';
import { mapAddressToCommunity, unmapAddressFromCommunity } from '@/services/community-actions';
import type { CommunityCustomerOption, CommunityMappedAddress } from '@/types/community';

export function CommunityCustomerManager({
  communityId,
  communityName,
  mappedAddresses,
  customers,
}: {
  communityId: string;
  communityName: string;
  mappedAddresses: CommunityMappedAddress[];
  customers: CommunityCustomerOption[];
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { complete, refreshing } = useActionComplete();
  const isWorking = (id: string) => busyId === id && (saving || refreshing);

  const matches = useMemo(() => {
    const raw = query;
    const needle = raw.trim().toLowerCase();
    if (raw.length === 0) {
      return [];
    }
    if (!needle) {
      return customers;
    }
    return customers.filter((person) =>
      [person.name, person.mobile].join(' ').toLowerCase().includes(needle),
    );
  }, [customers, query]);

  async function mapAddress(addressId: string, confirmMove = false) {
    setError(null);
    setBusyId(addressId);
    setSaving(true);
    const result = await mapAddressToCommunity({ communityId, addressId, confirmMove });
    setSaving(false);
    if (result.needsConfirm) {
      const ok = window.confirm(
        `This address is mapped to ${result.currentCommunityName}. Move it to ${communityName}?`,
      );
      if (ok) {
        await mapAddress(addressId, true);
      }
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    complete(`Address added to ${communityName}`);
  }

  async function unmapAddress(addressId: string) {
    setError(null);
    setBusyId(addressId);
    setSaving(true);
    const result = await unmapAddressFromCommunity({ communityId, addressId });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    complete(`Address removed from ${communityName}`);
  }

  return (
    <div className="relative space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <BrowserAddressDecoy />
      <div>
        <h2 className="text-lg font-semibold">Manage customers</h2>
        <p className="mt-1 text-sm text-stone-500">
          Search by name or phone. Map a specific saved address. Mapping is optional and is not shown to the customer.
        </p>
      </div>
      <NoFillInput
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        name="q-comm-cust"
        placeholder="Search name or phone, or press space to list"
        className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2"
      />
      {matches.length > 0 ? (
        <ul className="space-y-3">
          {matches.map((person) => (
            <li key={person.customerId} className="rounded-lg border border-stone-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{person.name}</p>
                <p className="text-sm text-stone-500">{person.mobile}</p>
              </div>
              <ul className="mt-2 space-y-2">
                {person.addresses.map((item) => {
                  const mappedHere = item.communityId === communityId;
                  return (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-stone-50 px-3 py-2">
                      <p className="min-w-0 flex-1 text-sm text-stone-700">{item.line}</p>
                      {mappedHere ? (
                        <span className="text-sm font-medium text-emerald-800">Mapped</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isWorking(item.id)}
                          aria-busy={isWorking(item.id)}
                          onClick={() => mapAddress(item.id)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 disabled:opacity-50"
                        >
                          {isWorking(item.id) ? <Spinner size={14} /> : null}
                          {isWorking(item.id)
                            ? 'Mapping…'
                            : item.communityName
                              ? `Move from ${item.communityName}`
                              : 'Map this address'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : query.length > 0 ? (
        <p className="text-sm text-stone-500">No customers with a saved address match this search.</p>
      ) : null}
      {error ? <p className="text-red-700">{error}</p> : null}

      <h3 className="pt-2 text-base font-semibold">Mapped to {communityName}</h3>
      {mappedAddresses.length === 0 ? (
        <p className="text-stone-600">No addresses mapped yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {mappedAddresses.map((item) => (
            <li key={item.addressId} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                {item.customerId ? (
                  <Link href={`/customers/${item.customerId}`} className="font-medium text-emerald-800">
                    {item.name}
                  </Link>
                ) : (
                  <p className="font-medium">{item.name}</p>
                )}
                <p className="text-sm text-stone-500">{item.mobile}</p>
                <p className="mt-1 text-sm text-stone-700">{item.addressLine}</p>
              </div>
              <button
                type="button"
                disabled={isWorking(item.addressId)}
                aria-busy={isWorking(item.addressId)}
                onClick={() => unmapAddress(item.addressId)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 disabled:opacity-50"
              >
                {isWorking(item.addressId) ? <Spinner size={14} /> : null}
                {isWorking(item.addressId) ? 'Unmapping…' : 'Unmap'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
