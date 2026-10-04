'use client';

import { useEffect, useRef } from 'react';

import { BrowserAddressDecoy, NoFillInput } from '@/components/NoBrowserFill';
import {
  ADDRESS_FIELD_COPY,
  ADDRESS_LABELS,
  isValidPincode,
  lookupPincode,
  stateFromPincode,
  type AddressLabel,
} from '@/types/address';

const fieldClass = 'min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm';

export type AddressFieldsValue = {
  house: string;
  area: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
  label: AddressLabel;
  receiverName: string;
  receiverPhone: string;
};

export function AddressFields({
  value,
  onChange,
  showReceiver = true,
  compact = false,
}: {
  value: AddressFieldsValue;
  onChange: (next: AddressFieldsValue) => void;
  showReceiver?: boolean;
  compact?: boolean;
}) {
  const labelClass = compact ? 'mb-1 block text-xs font-medium text-stone-500' : 'mb-1 block text-sm text-stone-500';
  const headingClass = compact ? 'text-sm font-semibold' : 'text-base font-semibold';
  const latest = useRef(value);
  latest.current = value;
  const loadedPin = useRef(value.pincode.trim());

  function patch(partial: Partial<AddressFieldsValue>) {
    onChange({ ...value, ...partial });
  }

  useEffect(() => {
    const pin = value.pincode.trim();
    const local = stateFromPincode(pin);
    if (!isValidPincode(pin)) {
      loadedPin.current = '';
      if (value.state) {
        onChange({ ...latest.current, state: '' });
      }
      return;
    }
    if (local && local !== value.state) {
      onChange({ ...latest.current, state: local });
    }
    const keepCity = pin === loadedPin.current && Boolean(latest.current.city.trim());
    let cancelled = false;
    lookupPincode(pin).then((remote) => {
      if (cancelled) {
        return;
      }
      const next = { ...latest.current };
      let changed = false;
      if (remote.state && remote.state !== next.state) {
        next.state = remote.state;
        changed = true;
      }
      if (!keepCity && remote.city && remote.city !== next.city) {
        next.city = remote.city;
        changed = true;
      }
      if (changed) {
        onChange(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value.pincode]);

  return (
    <div className="relative space-y-4">
      <BrowserAddressDecoy />
      <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
        <p className={`${headingClass} ${compact ? 'sm:col-span-2' : ''}`}>Add address</p>
        <label className="block">
          <span className={labelClass}>{ADDRESS_FIELD_COPY.house}</span>
          <NoFillInput
            value={value.house}
            onChange={(event) => patch({ house: event.target.value })}
            name="f2f_h"
            autoComplete="off"
            placeholder={ADDRESS_FIELD_COPY.house}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{ADDRESS_FIELD_COPY.area}</span>
          <NoFillInput
            value={value.area}
            onChange={(event) => patch({ area: event.target.value })}
            name="f2f_ar"
            autoComplete="off"
            placeholder={ADDRESS_FIELD_COPY.area}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{ADDRESS_FIELD_COPY.landmark}</span>
          <NoFillInput
            value={value.landmark}
            onChange={(event) => patch({ landmark: event.target.value })}
            name="f2f_lm"
            autoComplete="off"
            placeholder={ADDRESS_FIELD_COPY.landmark}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{ADDRESS_FIELD_COPY.pincode}</span>
          <NoFillInput
            value={value.pincode}
            onChange={(event) => patch({ pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })}
            inputMode="numeric"
            name="f2f_pc"
            autoComplete="one-time-code"
            placeholder={ADDRESS_FIELD_COPY.pincode}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{ADDRESS_FIELD_COPY.city}</span>
          <NoFillInput
            value={value.city}
            onChange={(event) => patch({ city: event.target.value })}
            name="f2f_ct"
            placeholder={isValidPincode(value.pincode) ? ADDRESS_FIELD_COPY.city : 'Filled from pincode'}
            className={fieldClass}
          />
        </label>
        <div className="block">
          <span className={labelClass}>{ADDRESS_FIELD_COPY.state}</span>
          <div className={`${fieldClass} flex items-center bg-stone-50 text-stone-700`}>
            {value.state || (isValidPincode(value.pincode) ? 'Looking up…' : 'Filled from pincode')}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className={headingClass}>{ADDRESS_FIELD_COPY.label}</p>
        <div className="flex flex-wrap gap-2">
          {ADDRESS_LABELS.map((item) => {
            const active = value.label === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => patch({ label: item.value })}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-stone-300 bg-white text-stone-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {showReceiver ? (
        <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
          <p className={`${headingClass} ${compact ? 'sm:col-span-2' : ''}`}>{ADDRESS_FIELD_COPY.receiver}</p>
          <label className="block">
            <span className={labelClass}>{ADDRESS_FIELD_COPY.receiverName}</span>
            <NoFillInput
              value={value.receiverName}
              onChange={(event) => patch({ receiverName: event.target.value })}
              name="f2f_rn"
              autoComplete="off"
              placeholder={ADDRESS_FIELD_COPY.receiverName}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{ADDRESS_FIELD_COPY.receiverPhone}</span>
            <div className="flex overflow-hidden rounded-md border border-stone-300 bg-white">
              <span className="flex min-h-10 items-center border-r border-stone-200 px-3 text-sm text-stone-500">+91</span>
              <NoFillInput
                value={value.receiverPhone}
                onChange={(event) => patch({ receiverPhone: event.target.value.replace(/\D/g, '').slice(0, 10) })}
                inputMode="numeric"
                name="f2f_rp"
                autoComplete="one-time-code"
                placeholder={ADDRESS_FIELD_COPY.receiverPhone}
                className="min-h-10 min-w-0 flex-1 border-0 px-3 py-1.5 text-sm outline-none"
              />
            </div>
          </label>
        </div>
      ) : null}
    </div>
  );
}
