'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { OrderWorkflow } from '@/components/OrderWorkflow';
import { TableScroll } from '@/components/TableScroll';
import { normalizeStatus } from '@/types/order-workflow';
import { deliveryTypeLabel, type CommunityListItem } from '@/types/community';
import {
  DISPLAY_PAYMENT_STATUSES,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  displayPaymentStatus,
  isPaymentCollected,
  orderChannelLabel,
  orderStatusLabel,
  paymentModeLabel,
  type DisplayPaymentStatus,
  type Order,
  type OrderStatus,
} from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice, splitDeliveryNotes } from '@/utils/format';

const PAGE_SIZE = 25;
// Phase 2: quick status actions on the list. See docs/pending-and-future-scope.md.
const LIST_QUICK_ACTIONS = false;

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

export function OrdersBoard({
  orders,
  communities = [],
  communitiesEnabled = false,
  initialStatus,
}: {
  orders: Order[];
  communities?: CommunityListItem[];
  communitiesEnabled?: boolean;
  /** Opens on this status tab, for example from a dashboard link. */
  initialStatus?: OrderStatus;
}) {
  const [tab, setTab] = useState<'all' | OrderStatus>(initialStatus ?? 'all');
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
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const order of orders) {
      const status = normalizeStatus(order.status);
      if (status in next) {
        next[status] += 1;
      }
    }
    return next;
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (tab !== 'all' && normalizeStatus(order.status) !== tab) {
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
      if (communitiesEnabled && typeFilter === 'community' && !order.community_name && !order.community_id) {
        return false;
      }
      if (communitiesEnabled && typeFilter === 'individual' && (order.community_name || order.community_id)) {
        return false;
      }
      if (communitiesEnabled && communityFilter && order.community_id !== communityFilter) {
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
  }, [orders, tab, query, paymentFilter, methodFilter, channelFilter, typeFilter, communityFilter, fromDate, toDate, communitiesEnabled]);

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
      ...(communitiesEnabled ? ['Type', 'Community'] : []),
      'Placed',
    ];
    const rows = filtered.map((order) => [
      formatOrderNumber(order.order_number),
      order.customer_name,
      order.mobile,
      String(order.total_amount),
      orderStatusLabel(order.status),
      DISPLAY_PAYMENT_STATUSES.find((item) => item.value === displayPaymentStatus(order))?.label ?? '',
      paymentModeLabel(order.payment_method),
      orderChannelLabel(order.channel ?? 'app'),
      ...(communitiesEnabled
        ? [deliveryTypeLabel(order), order.community_name ?? '']
        : []),
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
                active ? 'bg-emerald-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200'
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
            {DISPLAY_PAYMENT_STATUSES.filter((item) => item.value !== 'not_applicable').map((item) => (
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
        {communitiesEnabled ? (
          <>
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
          </>
        ) : null}
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
          <div className="space-y-3 md:hidden">
            {paged.map((order) => {
              const cardClass = order.admin_modified_from_placed
                ? 'block rounded-2xl border border-amber-300 bg-amber-50/50 p-4 shadow-sm ring-1 ring-amber-100'
                : 'block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
              const summary = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base font-semibold text-stone-900">
                      Order #{formatOrderNumber(order.order_number)}
                      {order.admin_modified_from_placed ? (
                        <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950">
                          Modified
                        </span>
                      ) : null}
                    </p>
                    <p className="text-base font-semibold text-stone-900">{formatPrice(order.total_amount)}</p>
                  </div>
                  <p className="mt-1 text-sm font-medium text-stone-700">
                    {order.customer_name}
                    {typeof order.item_count === 'number'
                      ? ` • ${order.item_count} ${order.item_count === 1 ? 'item' : 'items'}`
                      : ''}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-stone-500">
                    {splitDeliveryNotes(order.delivery_address).address.split('\n')[0]}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    {LIST_QUICK_ACTIONS ? null : <StatusBadge status={order.status} />}
                    <PaymentStatusBadge
                      status={order.status}
                      paymentMethod={order.payment_method}
                      refundStatus={order.refund_status}
                    />
                    <span>{formatDateTime(order.created_at)}</span>
                    {communitiesEnabled && order.community_name ? <span>· {order.community_name}</span> : null}
                  </div>
                </>
              );
              if (!LIST_QUICK_ACTIONS) {
                return (
                  <Link key={order.id} href={`/orders/${order.id}`} className={cardClass}>
                    {summary}
                  </Link>
                );
              }
              return (
                <div key={order.id} className={cardClass}>
                  <Link href={`/orders/${order.id}`} className="block">
                    {summary}
                  </Link>
                  <div className="mt-4">
                    <OrderWorkflow
                      variant="card"
                      orderId={order.id}
                      orderNumber={`#${formatOrderNumber(order.order_number)}`}
                      status={order.status}
                      cancelReason={order.cancel_reason}
                      paymentMethod={order.payment_method ?? 'pending'}
                      detailsHref={`/orders/${order.id}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block">
            <TableScroll>
              <table className={`w-full text-left text-sm ${communitiesEnabled ? 'min-w-[68rem]' : 'min-w-[56rem]'}`}>
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Order No</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Order Status</th>
                    <th className="px-3 py-2 font-medium">Payment Status</th>
                    <th className="px-3 py-2 font-medium">Payment Method</th>
                    <th className="px-3 py-2 font-medium">Channel</th>
                    {communitiesEnabled ? (
                      <>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Community</th>
                      </>
                    ) : null}
                    <th className="px-3 py-2 font-medium">Placed</th>
                    {LIST_QUICK_ACTIONS ? <th className="px-3 py-2 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((order) => (
                    <tr
                      key={order.id}
                      className={
                        order.admin_modified_from_placed
                          ? 'border-t border-amber-200 bg-amber-50/60'
                          : 'border-t border-stone-200'
                      }
                    >
                      <td className="px-3 py-2 font-semibold">
                        <Link href={`/orders/${order.id}`} className="text-stone-900 hover:text-emerald-800 hover:underline">
                          {formatOrderNumber(order.order_number)}
                          {order.admin_modified_from_placed ? (
                            <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950">
                              Modified
                            </span>
                          ) : null}
                        </Link>
                      </td>
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
                      {communitiesEnabled ? (
                        <>
                          <td className="px-3 py-2">{deliveryTypeLabel(order)}</td>
                          <td className="px-3 py-2">{order.community_name || '—'}</td>
                        </>
                      ) : null}
                      <td className="px-3 py-2 whitespace-nowrap text-stone-600">{formatDateTime(order.created_at)}</td>
                      {LIST_QUICK_ACTIONS ? (
                        <td className="px-3 py-2">
                          <OrderWorkflow
                            variant="row"
                            orderId={order.id}
                            orderNumber={`#${formatOrderNumber(order.order_number)}`}
                            status={order.status}
                            cancelReason={order.cancel_reason}
                            paymentMethod={order.payment_method ?? 'pending'}
                            detailsHref={`/orders/${order.id}`}
                          />
                        </td>
                      ) : null}
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
