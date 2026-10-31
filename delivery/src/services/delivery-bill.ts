import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getBusinessBillHeader } from '@/services/business';
import type { OrderWithItems, PaymentMethod } from '@/types/order';
import { formatOrderListDate, formatOrderNumber } from '@/utils/format';

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function logoDataUri(url: string | null): Promise<string | null> {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    return `data:${type};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
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
    return formatOrderListDate(value);
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

function billHtml(
  order: OrderWithItems,
  shop: { name: string; phone: string | null; email: string | null; address: string | null },
  paymentMethod: PaymentMethod,
  logoSrc: string | null,
): string {
  const rows = order.order_items
    .map((item) => {
      const unit =
        item.product_price != null && Number.isFinite(Number(item.product_price))
          ? Number(item.product_price)
          : item.quantity > 0
            ? item.subtotal / item.quantity
            : item.subtotal;
      return `<tr>
        <td>${escapeHtml(item.product_name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${escapeHtml(formatInr(unit))}</td>
        <td class="num">${escapeHtml(formatInr(item.subtotal))}</td>
      </tr>`;
    })
    .join('');

  const shopLines = [
    shop.phone ? `<div class="shop-line">${ICON_PHONE}<span>${escapeHtml(shop.phone)}</span></div>` : '',
    shop.email ? `<div class="shop-line">${ICON_MAIL}<span>${escapeHtml(shop.email)}</span></div>` : '',
    shop.address ? `<div class="shop-line">${ICON_PIN}<span>${escapeHtml(shop.address)}</span></div>` : '',
  ].join('');

  const customerAddress = `${order.delivery_address}${order.pincode ? `, ${order.pincode}` : ''}`;
  const logo = logoSrc
    ? `<img class="logo" src="${logoSrc}" alt="" />`
    : `<div class="logo logo-fallback">${escapeHtml(shop.name.slice(0, 1))}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=595, initial-scale=1" />
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; width: 595px; background: #fff; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; }
    .sheet { border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden; margin: 12px; }
    .banner {
      background-color: #1c8c36;
      background-image: linear-gradient(180deg, #1c8c36 0%, #3cb54a 100%);
      color: #fff;
    }
    .banner-top { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 18px 8px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 72px; height: 72px; border-radius: 36px; object-fit: cover; border: 3px solid #fff; background: #fff; }
    .logo-fallback { display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #1c8c36; }
    .shop-name { font-size: 26px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.3px; }
    .shop-line { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; line-height: 16px; margin-top: 2px; }
    .shop-line svg { flex: none; margin-top: 1px; }
    .leaves { flex: none; opacity: 0.9; }
    .wave { display: block; width: 100%; height: 16px; margin-bottom: -1px; }
    .body { padding: 8px 16px 0; }
    .title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    h1 { margin: 0; font-size: 28px; color: #166534; letter-spacing: -0.4px; }
    .date { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: #52525b; font-size: 13px; }
    .pill { background: #d9f5d0; color: #166534; font-weight: 800; font-size: 16px; padding: 8px 14px; border-radius: 10px; }
    .customer { margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; }
    .customer-line { display: flex; align-items: flex-start; gap: 8px; margin-top: 6px; font-size: 13px; color: #3f3f46; }
    .customer-line strong { color: #18181b; }
    .customer-line svg { flex: none; margin-top: 1px; color: #3f3f46; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { background: #d9f5d0; color: #166534; font-size: 13px; text-align: left; padding: 8px 10px; }
    th.num, td.num { text-align: right; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .paybar { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; background: #e8f8e4; border-radius: 10px; padding: 12px 14px; color: #166534; font-weight: 800; font-size: 18px; }
    .paybar strong { font-size: 22px; }
    .method { display: flex; align-items: center; gap: 8px; margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; font-size: 14px; }
    .thanks { text-align: center; color: #166534; font-weight: 800; font-size: 16px; margin: 16px 0 4px; }
    .scene { display: block; width: 100%; height: 78px; }
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
        <svg class="leaves" width="72" height="56" viewBox="0 0 72 56" aria-hidden="true">
          <path fill="#b7f0a8" d="M58 8c8 6 12 16 8 24-8-2-16-8-20-16 6-2 10-6 12-8z"/>
          <path fill="#8ee07a" d="M40 18c10 2 18 10 20 18-10 0-18-6-22-14 2-2 2-4 2-4z"/>
          <path fill="#d9f5d0" d="M62 28c6 8 4 16-2 20-4-8-6-16-4-22 2 0 4 1 6 2z"/>
        </svg>
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
          <tr><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="paybar"><span>To Pay</span><strong>${escapeHtml(formatInr(order.total_amount))}</strong></div>
      <div class="method">${ICON_CAL}<span>Payment Method: ${escapeHtml(paymentLabel(paymentMethod))}</span></div>
      <div class="thanks">Thank you for your order!</div>
      <svg class="scene" viewBox="0 0 600 90" aria-hidden="true">
        <path fill="#b7e7a8" d="M0 50c40-20 80-8 120-18s80-6 120 8 90 10 140-8 90-4 140 10 60 8 80 6v42H0z"/>
        <path fill="#8fd184" d="M0 64c50-12 90 4 140-6s100 2 150-10 110 6 160-4 90 8 150 2v44H0z"/>
        <path fill="#6fbf62" d="M0 76c60-8 100 6 160-2s120 4 180-8 140 10 260 0v24H0z"/>
        <circle cx="70" cy="58" r="10" fill="#3d9a45"/>
        <rect x="66" y="66" width="8" height="10" fill="#2f7d34"/>
        <circle cx="150" cy="62" r="8" fill="#3d9a45"/>
        <rect x="147" y="68" width="6" height="8" fill="#2f7d34"/>
        <path fill="#f3f0e4" d="M250 58h28v16h-28z"/>
        <path fill="#d7d0b8" d="M248 58l16-12 16 12z"/>
        <rect x="260" y="64" width="6" height="10" fill="#8d6e4c"/>
        <circle cx="500" cy="60" r="9" fill="#3d9a45"/>
        <rect x="497" y="67" width="6" height="8" fill="#2f7d34"/>
        <path fill="#e8f8e4" d="M430 48h4v22h-4z"/>
        <path fill="#d9f5d0" d="M418 50h28v4H418z"/>
      </svg>
    </div>
  </div>
</body>
</html>`;
}

/** Build a one-page PDF and open the share sheet (WhatsApp, and other apps). */
export async function shareDeliveryBill(
  order: OrderWithItems,
  businessId: string,
  paymentMethod: PaymentMethod = order.payment_method,
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this phone.');
  }

  let shop = {
    name: 'Farm2Flavours',
    phone: null as string | null,
    email: null as string | null,
    address: null as string | null,
    logoUrl: null as string | null,
  };
  try {
    shop = await getBusinessBillHeader(businessId);
  } catch {
    // The bill can still go out with the shop name fallback.
  }
  const logoSrc = await logoDataUri(shop.logoUrl);

  const pageHeight = 760 + order.order_items.length * 36;
  const { base64 } = await Print.printToFileAsync({
    html: billHtml(order, shop, paymentMethod, logoSrc),
    base64: true,
    width: 595,
    height: pageHeight,
    textZoom: 100,
  });
  if (!base64) {
    throw new Error('Could not create the bill.');
  }

  const safeName = shop.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Farm2Flavours';
  const named = new File(Paths.cache, `${safeName}-${formatOrderNumber(order.order_number)}.pdf`);
  if (named.exists) {
    named.delete();
  }
  named.create();
  await named.write(base64, { encoding: 'base64' });

  try {
    await Sharing.shareAsync(named.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share bill',
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel|dismiss|did not share/i.test(message)) {
      return;
    }
    throw error;
  }
}
