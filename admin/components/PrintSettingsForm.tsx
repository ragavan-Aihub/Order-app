'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { isSupabaseConfigured } from '@/config/env';
import {
  DEFAULT_PRINT_SETTINGS,
  PRINT_SETTINGS_MARKET_NOTES,
  normalizePrintSettings,
  type AfterInvoiceSavePrint,
  type PrintSettings,
  type ReceiptFormat,
  type ThermalWidthMm,
} from '@/lib/print-settings';
import { updatePrintSettings } from '@/services/business-actions';
import type { Business } from '@/types/business';

function FieldToggle({
  label,
  checked,
  onChange,
  locked,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  locked?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={`flex min-h-11 items-start gap-3 rounded-xl border px-3 py-2.5 ${
        locked ? 'border-stone-200 bg-stone-50 text-stone-500' : 'border-stone-200 bg-white'
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600"
        checked={checked}
        disabled={locked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-stone-900">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-stone-500">{hint}</span> : null}
        {locked ? <span className="mt-0.5 block text-xs text-stone-500">Required on every receipt</span> : null}
      </span>
    </label>
  );
}

function SectionCard({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">{note}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function PrintSettingsForm({ business }: { business: Business }) {
  const router = useRouter();
  const notice = useActionNotice();
  const [settings, setSettings] = useState<PrintSettings>(() =>
    normalizePrintSettings(business.print_settings ?? DEFAULT_PRINT_SETTINGS),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function patch<K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Connect Supabase to save this.');
      return;
    }
    setSubmitting(true);
    const result = await updatePrintSettings({
      businessId: business.id,
      settings,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    notice.show('Print settings saved');
    router.refresh();
  }

  function resetDefaults() {
    setSettings(DEFAULT_PRINT_SETTINGS);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-900">Printer defaults</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Choose how receipts print by default. You can still pick A4 or thermal when you print an order.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Default design</span>
            <select
              value={settings.defaultFormat}
              onChange={(event) => patch('defaultFormat', event.target.value as ReceiptFormat)}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm"
            >
              <option value="a4">A4 invoice (standard)</option>
              <option value="thermal">Thermal slip</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Thermal paper width</span>
            <select
              value={settings.thermalWidthMm}
              onChange={(event) => patch('thermalWidthMm', Number(event.target.value) as ThermalWidthMm)}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm"
            >
              <option value={80}>80 mm (common kitchen / counter)</option>
              <option value={58}>58 mm (compact)</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-stone-700">After invoice save</span>
            <select
              value={settings.afterInvoiceSave}
              onChange={(event) => patch('afterInvoiceSave', event.target.value as AfterInvoiceSavePrint)}
              className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm"
            >
              <option value="ask">Ask: Print A4, Print thermal, or Not now</option>
              <option value="print_default">Print default design automatically</option>
              <option value="skip">Do not ask (print later from the orders list)</option>
            </select>
          </label>
        </div>
      </section>

      <SectionCard title="1. Shop details" note={PRINT_SETTINGS_MARKET_NOTES.shop}>
        <FieldToggle
          label="Shop name"
          checked={settings.shop.name}
          locked
          onChange={(value) => patch('shop', { ...settings.shop, name: value })}
        />
        <FieldToggle
          label="Logo"
          checked={settings.shop.logo}
          onChange={(value) => patch('shop', { ...settings.shop, logo: value })}
          hint="Usual on A4 invoices; often omitted on narrow thermal"
        />
        <FieldToggle
          label="Phone"
          checked={settings.shop.phone}
          onChange={(value) => patch('shop', { ...settings.shop, phone: value })}
        />
        <FieldToggle
          label="Email"
          checked={settings.shop.email}
          onChange={(value) => patch('shop', { ...settings.shop, email: value })}
        />
        <FieldToggle
          label="Address"
          checked={settings.shop.address}
          onChange={(value) => patch('shop', { ...settings.shop, address: value })}
        />
      </SectionCard>

      <SectionCard title="2. Customer details" note={PRINT_SETTINGS_MARKET_NOTES.customer}>
        <FieldToggle
          label="Customer name"
          checked={settings.customer.name}
          locked
          onChange={(value) => patch('customer', { ...settings.customer, name: value })}
        />
        <FieldToggle
          label="Order number"
          checked={settings.customer.orderNumber}
          locked
          onChange={(value) => patch('customer', { ...settings.customer, orderNumber: value })}
        />
        <FieldToggle
          label="Phone"
          checked={settings.customer.phone}
          onChange={(value) => patch('customer', { ...settings.customer, phone: value })}
        />
        <FieldToggle
          label="Delivery address"
          checked={settings.customer.address}
          onChange={(value) => patch('customer', { ...settings.customer, address: value })}
        />
        <FieldToggle
          label="Order date"
          checked={settings.customer.date}
          onChange={(value) => patch('customer', { ...settings.customer, date: value })}
        />
      </SectionCard>

      <SectionCard title="3. Item details" note={PRINT_SETTINGS_MARKET_NOTES.items}>
        <FieldToggle
          label="Item name"
          checked={settings.items.itemName}
          locked
          onChange={(value) => patch('items', { ...settings.items, itemName: value })}
        />
        <FieldToggle
          label="Order qty"
          checked={settings.items.orderQty}
          onChange={(value) => patch('items', { ...settings.items, orderQty: value })}
          hint="Original ordered quantity"
        />
        <FieldToggle
          label="Recd qty"
          checked={settings.items.recdQty}
          onChange={(value) => patch('items', { ...settings.items, recdQty: value })}
          hint="Billed / packed quantity"
        />
        <FieldToggle
          label="Rate"
          checked={settings.items.rate}
          onChange={(value) => patch('items', { ...settings.items, rate: value })}
        />
        <FieldToggle
          label="Amount"
          checked={settings.items.amount}
          locked
          onChange={(value) => patch('items', { ...settings.items, amount: value })}
        />
      </SectionCard>

      <SectionCard title="4. Payment details" note={PRINT_SETTINGS_MARKET_NOTES.payment}>
        <FieldToggle
          label="To pay total"
          checked={settings.payment.total}
          locked
          onChange={(value) => patch('payment', { ...settings.payment, total: value })}
        />
        <FieldToggle
          label="Payment method"
          checked={settings.payment.method}
          onChange={(value) => patch('payment', { ...settings.payment, method: value })}
        />
        <FieldToggle
          label="Thank-you line"
          checked={settings.payment.thanks}
          onChange={(value) => patch('payment', { ...settings.payment, thanks: value })}
        />
      </SectionCard>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? <Spinner /> : null}
          Save print settings
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          disabled={submitting}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 px-5 py-3 text-base font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          Reset to default design
        </button>
      </div>
    </form>
  );
}
