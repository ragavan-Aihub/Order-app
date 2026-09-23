'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import { deliveryTypeLabel, type CommunityListItem } from '@/types/community';
import {
  DISPLAY_PAYMENT_STATUSES,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  displayPaymentStatus,
  isPaymentCollected,
  orderChannelLabel,
  paymentModeLabel,
  type DisplayPaymentStatus,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

const PAGE_SIZE = 25;

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

export function OrdersBoard({ orders, communities = [] }: { orders: Order[]; communities?: CommunityListItem[] }) {
  const [tab, setTab] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<DisplayPaymentStatus | ''>('');
  const [methodFilter, setMethodFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [communityFilter, setCommunityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'community' | 'individual'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

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
      if (methodFilter === 'pending' && isPaymentCollected(order.payment_method)) {
        return false;
      }
      if ((methodFilter === 'cash' || methodFilter === 'upi') && order.payment_method !== methodFilter) {
        return false;
      }
      if (channelFilter && (order.channel ?? 'app') !== channelFilter) {
        return false;
      }
      if (typeFilter === 'community' && !order.community_name && !order.community_id) {
        return false;
      }
      if (typeFilter === 'individual' && (order.community_name || order.community_id)) {
        return false;
      }
      if (communityFilter && order.community_id !== communityFilter) {
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
  }, [orders, tab, query, paymentFilter, methodFilter, channelFilter, typeFilter, communityFilter, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab, query, paymentFilter, methodFilter, channelFilter, typeFilter, communityFilter, fromDate, toDate]);

  function clearFilters() {
    setTab('all');
    setQuery('');
    setPaymentFilter('');
    setMethodFilter('');
    setChannelFilter('');
    setCommunityFilter('');
    setTypeFilter('all');
    setFromDate('');
    setToDate('');
  }

  function exportCsv() {
    const header = [
      'Order No',
      'Customer',
      'Mobile',
      'Total',
      'Order Status',
      'Payment Status',
      'Payment Method',
      'Channel',
      'Type',
      'Community',
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
      orderChannelLabel(order.channel ?? 'app'),
      deliveryTypeLabel(order.community_name),
      order.community_name ?? '',
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

  const fieldClass = 'min-h-10 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm';
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-stone-600">
        <p>No orders yet.</p>
        <Link href="/orders/new" className="mt-3 inline-block font-medium text-emerald-800">
          Create an order
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((item) => {
          const active = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                active ? 'bg-emerald-800 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200'
              }`}
            >
              {item.label} ({item.count})
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order no, customer, phone"
            className={`${fieldClass} w-full`}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-stone-500">Order status</span>
          <select
            value={tab}
            onChange={(event) => setTab(event.target.value as 'all' | OrderStatus)}
            className={fieldClass}
          >
            <option value="all">All</option>
            {ORDER_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-stone-500">Payment status</span>
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as DisplayPaymentStatus | '')}
            className={fieldClass}
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
          <span className="mb-1 block text-xs font-medium text-stone-500">Payment method</span>
          <select
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-stone-500">Channel</span>
          <select
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
            className={fieldClass}
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
          <span className="mb-1 block text-xs font-medium text-stone-500">Type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | 'community' | 'individual')}
            className={fieldClass}
          >
            <option value="all">All</option>
            <option value="community">Community</option>
            <option value="individual">Individual</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-stone-500">Community</span>
          <select
            value={communityFilter}
            onChange={(event) => setCommunityFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="">All</option>
            {communities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-stone-500">From</span>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={fieldClass} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-stone-500">To</span>
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={fieldClass} />
        </label>
        <button type="button" onClick={clearFilters} className="min-h-10 rounded-md px-3 text-sm font-medium text-emerald-800">
          Clear
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-700"
        >
          Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-stone-600">
          No orders match these filters.
        </div>
      ) : (
        <div>
          <div className="space-y-2 md:hidden">
            {paged.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{formatOrderNumber(order.order_number)}</p>
                  <p className="text-sm font-medium text-emerald-800">View</p>
                </div>
                <p className="mt-1 text-sm font-medium">{order.customer_name}</p>
                <p className="text-xs text-stone-500">{order.mobile}</p>
                <p className="mt-1 text-sm">{formatPrice(order.total_amount)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={order.status} />
                  <PaymentStatusBadge
                    status={order.status}
                    paymentMethod={order.payment_method}
                    refundStatus={order.refund_status}
                  />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {deliveryTypeLabel(order.community_name)}
                  {order.community_name ? ` · ${order.community_name}` : ''} · {paymentModeLabel(order.payment_method)} ·{' '}
                  {orderChannelLabel(order.channel ?? 'app')} · {formatDateTime(order.created_at)}
                </p>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <TableScroll>
              <table className="w-full min-w-[68rem] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Order No</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Order Status</th>
                    <th className="px-3 py-2 font-medium">Payment Status</th>
                    <th className="px-3 py-2 font-medium">Payment Method</th>
                    <th className="px-3 py-2 font-medium">Channel</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Community</th>
                    <th className="px-3 py-2 font-medium">Placed</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((order) => (
                    <tr key={order.id} className="border-t border-stone-200">
                      <td className="px-3 py-2 font-semibold">{formatOrderNumber(order.order_number)}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-xs text-stone-500">{order.mobile}</p>
                      </td>
                      <td className="px-3 py-2">{formatPrice(order.total_amount)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-3 py-2">
                        <PaymentStatusBadge
                          status={order.status}
                          paymentMethod={order.payment_method}
                          refundStatus={order.refund_status}
                        />
                      </td>
                      <td className="px-3 py-2">{paymentModeLabel(order.payment_method)}</td>
                      <td className="px-3 py-2">{orderChannelLabel(order.channel ?? 'app')}</td>
                      <td className="px-3 py-2">{deliveryTypeLabel(order.community_name)}</td>
                      <td className="px-3 py-2">{order.community_name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-stone-600">{formatDateTime(order.created_at)}</td>
                      <td className="px-3 py-2">
                        <Link href={`/orders/${order.id}`} className="font-semibold text-emerald-800">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-stone-500">
            <p>
              Showing {from}–{to} of {filtered.length}
            </p>
            {pageCount > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  className="min-h-9 rounded-md border border-stone-300 px-3 font-medium text-stone-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                  className="min-h-9 rounded-md border border-stone-300 px-3 font-medium text-stone-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
