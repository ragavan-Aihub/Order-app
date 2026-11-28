/**
 * Print settings defaults follow common POS / grocery billing patterns
 * (Square, Toast, Petpooja, BillingBaba, and packing-slip invoices):
 *
 * 1. Shop — name always; logo/phone/address/email usual on invoices
 * 2. Customer — name + order # always; phone/address/date usual for delivery
 * 3. Items — grocery packing slips often show Order qty vs Recd qty; rate + amount standard
 * 4. Payment — total always; method + thank-you usual
 */

export type ReceiptFormat = 'a4' | 'thermal';
export type ThermalWidthMm = 58 | 80;
export type AfterInvoiceSavePrint = 'ask' | 'print_default' | 'skip';

export type PrintShopFields = {
  logo: boolean;
  name: boolean;
  phone: boolean;
  email: boolean;
  address: boolean;
};

export type PrintCustomerFields = {
  name: boolean;
  phone: boolean;
  address: boolean;
  orderNumber: boolean;
  date: boolean;
};

export type PrintItemFields = {
  itemName: boolean;
  orderQty: boolean;
  recdQty: boolean;
  rate: boolean;
  amount: boolean;
};

export type PrintPaymentFields = {
  total: boolean;
  method: boolean;
  thanks: boolean;
};

export type PrintSettings = {
  defaultFormat: ReceiptFormat;
  afterInvoiceSave: AfterInvoiceSavePrint;
  thermalWidthMm: ThermalWidthMm;
  shop: PrintShopFields;
  customer: PrintCustomerFields;
  items: PrintItemFields;
  payment: PrintPaymentFields;
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  defaultFormat: 'a4',
  afterInvoiceSave: 'ask',
  thermalWidthMm: 80,
  shop: {
    logo: true,
    name: true,
    phone: true,
    email: true,
    address: true,
  },
  customer: {
    name: true,
    phone: true,
    address: true,
    orderNumber: true,
    date: true,
  },
  items: {
    itemName: true,
    orderQty: true,
    recdQty: true,
    rate: true,
    amount: true,
  },
  payment: {
    total: true,
    method: true,
    thanks: true,
  },
};

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function mergeSection<T extends Record<string, boolean>>(defaults: T, raw: unknown): T {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    next[key] = asBool(source[key as string], defaults[key]) as T[keyof T];
  }
  return next;
}

export function normalizePrintSettings(raw: unknown): PrintSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const defaultFormat = source.defaultFormat === 'thermal' ? 'thermal' : 'a4';
  const afterInvoiceSave =
    source.afterInvoiceSave === 'print_default' || source.afterInvoiceSave === 'skip'
      ? source.afterInvoiceSave
      : 'ask';
  const thermalWidthMm = source.thermalWidthMm === 58 ? 58 : 80;

  return {
    defaultFormat,
    afterInvoiceSave,
    thermalWidthMm,
    shop: mergeSection(DEFAULT_PRINT_SETTINGS.shop, source.shop),
    customer: mergeSection(DEFAULT_PRINT_SETTINGS.customer, source.customer),
    items: mergeSection(DEFAULT_PRINT_SETTINGS.items, source.items),
    payment: mergeSection(DEFAULT_PRINT_SETTINGS.payment, source.payment),
  };
}

/** Ensure required columns stay on so a receipt always remains usable. */
export function sanitizePrintSettingsForSave(input: PrintSettings): PrintSettings {
  const normalized = normalizePrintSettings(input);
  return {
    ...normalized,
    shop: { ...normalized.shop, name: true },
    customer: { ...normalized.customer, name: true, orderNumber: true },
    items: { ...normalized.items, itemName: true, amount: true },
    payment: { ...normalized.payment, total: true },
  };
}

export const PRINT_SETTINGS_MARKET_NOTES = {
  shop:
    'Most POS invoices (Square, Petpooja, BillingBaba) always print the shop name; logo and contact lines are usual on A4 invoices and optional on narrow thermal slips.',
  customer:
    'Delivery and grocery bills usually show customer name, phone, and address with the order number and date so packing and handover stay clear.',
  items:
    'Restaurant POS often prints Item / Qty / Rate / Amount. Grocery packing slips commonly add Order qty vs Recd qty when billed quantity can differ.',
  payment:
    'Total is always required. Payment method and a short thank-you line are standard on both A4 invoices and thermal receipts.',
} as const;
