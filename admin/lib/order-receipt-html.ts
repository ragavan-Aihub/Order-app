import { buildReceiptLines, formatReceiptQty, type ReceiptLine } from '@/lib/receipt-lines';
import type { OrderItem, OrderModificationItemSnapshot, PaymentMethod } from '@/types/order';
import { formatOrderNumber } from '@/utils/format';

export type ReceiptShop = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl?: string | null;
};

export type ReceiptOrder = {
  order_number: number;
  customer_name: string;
  mobile: string;
  delivery_address: string;
  pincode: string;
  total_amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  order_items: OrderItem[];
};

export type ReceiptFormat = 'a4' | 'thermal';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paymentLabel(method: PaymentMethod): string {
  if (method === 'cash') {
    return 'Cash';
  }
  if (method === 'upi') {
    return 'UPI';
  }
  return 'Not yet paid';
}

function formatInr(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return '₹0';
  }
  return `₹${value.toLocaleString('en-IN', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })}`;
}

function formatBillDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(date);
  } catch {
    return value;
  }
}

const ICON_PHONE =
  '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.6 1 1 0 01-.25 1L6.6 10.8z"/></svg>';
const ICON_MAIL =
  '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>';
const ICON_PIN =
  '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1114.5 9 2.5 2.5 0 0112 11.5z"/></svg>';
const ICON_CAL =
  '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 8H6v10h14V10z"/></svg>';
const ICON_USER =
  '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 12a4 4 0 10-4-4 4 4 0 004 4zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/></svg>';

function itemRows(lines: ReceiptLine[]): string {
  return lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.productName)}</td>
        <td class="num">${escapeHtml(formatReceiptQty(line.orderQty))}</td>
        <td class="num">${escapeHtml(formatReceiptQty(line.recdQty))}</td>
        <td class="num">${escapeHtml(formatInr(line.rate))}</td>
        <td class="num">${escapeHtml(formatInr(line.amount))}</td>
      </tr>`,
    )
    .join('');
}

function a4Html(
  order: ReceiptOrder,
  shop: ReceiptShop,
  lines: ReceiptLine[],
  logoSrc: string | null,
): string {
  const shopLines = [
    shop.phone ? `<div class="shop-line">${ICON_PHONE}<span>${escapeHtml(shop.phone)}</span></div>` : '',
    shop.email ? `<div class="shop-line">${ICON_MAIL}<span>${escapeHtml(shop.email)}</span></div>` : '',
    shop.address ? `<div class="shop-line">${ICON_PIN}<span>${escapeHtml(shop.address)}</span></div>` : '',
  ].join('');

  const customerAddress = `${order.delivery_address}${order.pincode ? `, ${order.pincode}` : ''}`;
  const logo = logoSrc
    ? `<img class="logo" src="${escapeHtml(logoSrc)}" alt="" />`
    : `<div class="logo logo-fallback">${escapeHtml(shop.name.slice(0, 1))}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice #${escapeHtml(formatOrderNumber(order.order_number))}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; }
    .sheet { border: 1px solid #d7e8d4; border-radius: 18px; overflow: hidden; }
    .banner {
      background-color: #eef9ea;
      background-image: linear-gradient(180deg, #f4fbf1 0%, #e2f5dc 100%);
      color: #166534;
    }
    .banner-top { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 18px 8px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 72px; height: 72px; border-radius: 36px; object-fit: cover; border: 3px solid #fff; background: #fff; }
    .logo-fallback { display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #3d9a45; background: #fff; }
    .shop-name { font-size: 26px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.3px; color: #166534; }
    .shop-line { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; line-height: 16px; margin-top: 2px; color: #3f6b47; }
    .shop-line svg { flex: none; margin-top: 1px; color: #3d9a45; }
    .wave { display: block; width: 100%; height: 16px; margin-bottom: -1px; }
    .body { padding: 8px 16px 16px; }
    .title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    h1 { margin: 0; font-size: 28px; color: #166534; letter-spacing: -0.4px; }
    .date { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: #52525b; font-size: 13px; }
    .pill { background: #e8f8e4; color: #166534; font-weight: 800; font-size: 16px; padding: 8px 14px; border-radius: 10px; }
    .customer { margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; background: #fbfefb; }
    .customer-line { display: flex; align-items: flex-start; gap: 8px; margin-top: 6px; font-size: 13px; color: #3f3f46; }
    .customer-line strong { color: #18181b; }
    .customer-line svg { flex: none; margin-top: 1px; color: #3f3f46; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { background: #e8f8e4; color: #166534; font-size: 12px; text-align: left; padding: 8px 8px; }
    th.num, td.num { text-align: right; white-space: nowrap; }
    td { padding: 9px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    .paybar { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; background: #eef9ea; border-radius: 10px; padding: 12px 14px; color: #166534; font-weight: 800; font-size: 18px; }
    .paybar strong { font-size: 22px; }
    .method { display: flex; align-items: center; gap: 8px; margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; font-size: 14px; }
    .thanks { text-align: center; color: #3d9a45; font-weight: 800; font-size: 16px; margin: 16px 0 4px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="banner">
      <div class="banner-top">
        <div class="brand">
          ${logo}
          <div>
            <div class="shop-name">${escapeHtml(shop.name)}</div>
            ${shopLines}
          </div>
        </div>
      </div>
      <svg class="wave" viewBox="0 0 595 16" preserveAspectRatio="none" aria-hidden="true">
        <path fill="#ffffff" d="M0 16h595V8C520 16 420 0 297 6 170 12 80 0 0 8z"/>
      </svg>
    </div>
    <div class="body">
      <div class="title-row">
        <div>
          <h1>Invoice</h1>
          <div class="date">${ICON_CAL}<span>${escapeHtml(formatBillDate(order.created_at))}</span></div>
        </div>
        <div class="pill">#${escapeHtml(formatOrderNumber(order.order_number))}</div>
      </div>
      <div class="customer">
        <div class="customer-line">${ICON_USER}<strong>${escapeHtml(order.customer_name)}</strong></div>
        <div class="customer-line">${ICON_PHONE}<span>${escapeHtml(order.mobile)}</span></div>
        <div class="customer-line">${ICON_PIN}<span>${escapeHtml(customerAddress)}</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Order qty</th>
            <th class="num">Recd qty</th>
            <th class="num">Rate</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows(lines)}</tbody>
      </table>
      <div class="paybar"><span>To Pay</span><strong>${escapeHtml(formatInr(order.total_amount))}</strong></div>
      <div class="method">${ICON_CAL}<span>Payment Method: ${escapeHtml(paymentLabel(order.payment_method))}</span></div>
      <div class="thanks">Thank you for your order!</div>
    </div>
  </div>
</body>
</html>`;
}

function thermalHtml(order: ReceiptOrder, shop: ReceiptShop, lines: ReceiptLine[]): string {
  const customerAddress = `${order.delivery_address}${order.pincode ? `, ${order.pincode}` : ''}`;
  const shopBlock = [
    shop.phone ? `<div>${escapeHtml(shop.phone)}</div>` : '',
    shop.email ? `<div>${escapeHtml(shop.email)}</div>` : '',
    shop.address ? `<div>${escapeHtml(shop.address)}</div>` : '',
  ].join('');

  const itemBlock = lines
    .map(
      (line) => `<tr>
      <td class="item">${escapeHtml(line.productName)}</td>
      <td class="num">${escapeHtml(formatReceiptQty(line.orderQty))}</td>
      <td class="num">${escapeHtml(formatReceiptQty(line.recdQty))}</td>
      <td class="num">${escapeHtml(formatInr(line.rate))}</td>
      <td class="num">${escapeHtml(formatInr(line.amount))}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${escapeHtml(formatOrderNumber(order.order_number))}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: "Courier New", Courier, monospace;
      color: #111;
      font-size: 11px;
      width: 72mm;
      margin: 0 auto;
      padding: 2mm;
    }
    .section { margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px dashed #999; }
    .section:last-child { border-bottom: 0; margin-bottom: 0; }
    .section-title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px; font-size: 10px; }
    .shop-name { font-size: 14px; font-weight: 700; margin: 0 0 4px; text-align: center; }
    .center { text-align: center; }
    .muted { color: #444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 3px 1px; vertical-align: top; }
    th { font-size: 9px; text-align: left; border-bottom: 1px solid #111; }
    th.num, td.num { text-align: right; white-space: nowrap; }
    td.item { width: 34%; word-break: break-word; }
    .total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 6px; }
    .thanks { text-align: center; margin-top: 8px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="section">
    <div class="section-title">1. Shop details</div>
    <div class="shop-name">${escapeHtml(shop.name)}</div>
    <div class="center muted">${shopBlock}</div>
  </div>
  <div class="section">
    <div class="section-title">2. Customer details</div>
    <div><strong>${escapeHtml(order.customer_name)}</strong></div>
    <div>${escapeHtml(order.mobile)}</div>
    <div>${escapeHtml(customerAddress)}</div>
    <div class="muted">Order #${escapeHtml(formatOrderNumber(order.order_number))} · ${escapeHtml(formatBillDate(order.created_at))}</div>
  </div>
  <div class="section">
    <div class="section-title">3. Item details</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Ord</th>
          <th class="num">Recd</th>
          <th class="num">Rate</th>
          <th class="num">Amt</th>
        </tr>
      </thead>
      <tbody>${itemBlock}</tbody>
    </table>
  </div>
  <div class="section">
    <div class="section-title">4. Payment details</div>
    <div class="total-row"><span>To Pay</span><span>${escapeHtml(formatInr(order.total_amount))}</span></div>
    <div>Payment: ${escapeHtml(paymentLabel(order.payment_method))}</div>
    <div class="thanks">Thank you!</div>
  </div>
</body>
</html>`;
}

export function buildOrderReceiptHtml(
  order: ReceiptOrder,
  shop: ReceiptShop,
  options: {
    format: ReceiptFormat;
    placedItems?: OrderModificationItemSnapshot[];
    logoSrc?: string | null;
  },
): string {
  const lines = buildReceiptLines(order.order_items, options.placedItems ?? []);
  if (options.format === 'thermal') {
    return thermalHtml(order, shop, lines);
  }
  return a4Html(order, shop, lines, options.logoSrc ?? null);
}
