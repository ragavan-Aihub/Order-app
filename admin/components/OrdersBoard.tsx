'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import {
  DISPLAY_PAYMENT_STATUSES,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  displayPaymentStatus,
  isPaymentCollected,
  paymentModeLabel,
  type DisplayPaymentStatus,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

function channelLabel(channel: string) {
  return ORDER_CHANNELS.find((item) => item.value === channel)?.label ?? channel;
}

function toDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function OrdersBoard({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<DisplayPaymentStatus | ''>('');
  const [methodFilter, setMethodFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const counts = useMemo(() => {
    const next: Record<OrderStatus, number> = {
      new: 0,
      confirmed: 0,
      preparing: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const order of orders) {
      next[order.status] += 1;
    }
    return next;
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (tab !== 'all' && order.status !== tab) {
        return false;
      }
      if (paymentFilter && displayPaymentStatus(order) !== paymentFilter) {
        return false;
      }
      if (methodFilter === 'none' && isPaymentCollected(order.payment_method)) {
        return false;
      }
      if (methodFilter && methodFilter !== 'none' && order.payment_method !== methodFilter) {
        return false;
      }
      if (channelFilter && (order.channel ?? 'app') !== channelFilter) {
        return false;
      }
      if (fromDate && toDateInput(order.created_at) < fromDate) {
        return false;
      }
      if (toDate && toDateInput(order.created_at) > toDate) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        formatOrderNumber(order.order_number),
        order.customer_name,
        order.mobile,
        order.external_id ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [orders, tab, query, paymentFilter, methodFilter, channelFilter, fromDate, toDate]);

  function clearFilters() {
    setTab('all');
    setQuery('');
    setPaymentFilter('');
    setMethodFilter('');
    setChannelFilter('');
    setFromDate('');
    setToDate('');
  }

  function exportCsv() {
    const header = [
      'Order ID',
      'Customer',
      'Mobile',
      'Total',
      'Status',
      'Payment Status',
      'Payment Method',
      'Channel',
      'Placed',
    ];
    const rows = filtered.map((order) => [
      formatOrderNumber(order.order_number),
      order.customer_name,
      order.mobile,
      String(order.total_amount),
      ORDER_STATUSES.find((item) => item.value === order.status)?.label ?? order.status,
      DISPLAY_PAYMENT_STATUSES.find((item) => item.value === displayPaymentStatus(order))?.label ?? '',
      paymentModeLabel(order.payment_method),
      channelLabel(order.channel ?? 'app'),
      formatDateTime(order.created_at),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orders.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { value: 'all' | OrderStatus; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: orders.length },
    ...ORDER_STATUSES.map((item) => ({
      value: item.value,
      label: item.label,
      count: counts[item.value],
    })),
  ];

  const selectClass = 'min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base';

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
        No orders yet. New orders from the app, partner API, or WhatsApp will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const active = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                active ? 'bg-emerald-800 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200'
              }`}
            >
              {item.label} ({item.count})
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-sm text-stone-500">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order ID, customer, phone"
            className={`${selectClass} w-full`}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm text-stone-500">Payment status</span>
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as DisplayPaymentStatus | '')}
            className={selectClass}
          >
            <option value="">All</option>
            {DISPLAY_PAYMENT_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm text-stone-500">Payment method</span>
          <select
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            <option value="none">—</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm text-stone-500">Channel</span>
          <select
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            {ORDER_CHANNELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm text-stone-500">From</span>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={selectClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm text-stone-500">To</span>
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={selectClass} />
        </label>
        <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg px-3 font-medium text-emerald-800">
          Clear
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="min-h-11 rounded-lg bg-emerald-800 px-4 font-semibold text-white"
        >
          Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">No orders match these filters.</div>
      ) : (
        <div>
          <div className="space-y-3 md:hidden">
            {filtered.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{formatOrderNumber(order.order_number)}</p>
                  <p className="text-sm font-medium text-emerald-800">View</p>
                </div>
                <p className="mt-1 font-medium">{order.customer_name}</p>
                <p className="text-sm text-stone-500">{order.mobile}</p>
                <p className="mt-2">{formatPrice(order.total_amount)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentStatusBadge
                    status={order.status}
                    paymentMethod={order.payment_method}
                    refundStatus={order.refund_status}
                  />
                </div>
                <p className="mt-2 text-sm text-stone-500">
                  {paymentModeLabel(order.payment_method)} · {channelLabel(order.channel ?? 'app')} ·{' '}
                  {formatDateTime(order.created_at)}
                </p>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <TableScroll>
              <table className="w-full min-w-[64rem] text-left text-base">
                <thead className="bg-stone-50 text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Payment Status</th>
                    <th className="px-4 py-3 font-medium">Payment Method</th>
                    <th className="px-4 py-3 font-medium">Placed</th>
                    <th className="px-4 py-3 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.id} className="border-t border-stone-200">
                      <td className="px-4 py-3 font-semibold">{formatOrderNumber(order.order_number)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-sm text-stone-500">{order.mobile}</p>
                      </td>
                      <td className="px-4 py-3">{formatPrice(order.total_amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge
                          status={order.status}
                          paymentMethod={order.payment_method}
                          refundStatus={order.refund_status}
                        />
                      </td>
                      <td className="px-4 py-3">{paymentModeLabel(order.payment_method)}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDateTime(order.created_at)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex min-h-9 items-center rounded-full border border-emerald-800 px-3 text-sm font-semibold text-emerald-800"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
          <p className="mt-3 text-sm text-stone-500">
            Showing {filtered.length} of {orders.length} orders
          </p>
        </div>
      )}
    </div>
  );
}
