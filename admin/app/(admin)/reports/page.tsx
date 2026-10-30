import Link from 'next/link';

import { MobileOrderRowCard } from '@/components/MobileOrderRowCard';
import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { ReportsFilters, ScrollToOutstanding } from '@/components/ReportsFilters';
import { TableScroll } from '@/components/TableScroll';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getReportsData } from '@/services/reports';
import { parseReportFilters } from '@/types/report';
import { orderChannelLabel, paymentModeLabel } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function queryWithPage(filters: { preset: string; fromYmd: string; toYmd: string; status: string; payment: string; method: string; channel: string; communityId: string; query: string }, page: number) {
  const params = new URLSearchParams();
  if (filters.preset !== '30d') {
    params.set('range', filters.preset);
  }
  if (filters.preset === 'custom') {
    params.set('from', filters.fromYmd);
    params.set('to', filters.toYmd);
  }
  if (filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.payment !== 'all') {
    params.set('payment', filters.payment);
  }
  if (filters.method !== 'all') {
    params.set('method', filters.method);
  }
  if (filters.channel) {
    params.set('channel', filters.channel);
  }
  if (filters.communityId) {
    params.set('community', filters.communityId);
  }
  if (filters.query) {
    params.set('q', filters.query);
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const qs = params.toString();
  return qs ? `/reports?${qs}` : '/reports';
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = parseReportFilters(params);
  const communitiesEnabled = await isCommunitiesEnabled();
  const [result, communities] = await Promise.all([
    getReportsData(parsed),
    communitiesEnabled ? getCommunities() : Promise.resolve([]),
  ]);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="rounded-xl border border-red-200 bg-white p-5 text-stone-700">
          <p className="font-medium text-red-800">Could not load this report.</p>
          <p className="mt-1 text-sm">{result.message}</p>
          <Link href="/reports" className="mt-3 inline-block font-medium text-emerald-800">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  const data = result.data;
  const { filters, summary, outstanding, orders } = data;
  const from = data.totalMatching === 0 ? 0 : (filters.page - 1) * data.pageSize + 1;
  const to = Math.min(filters.page * data.pageSize, data.totalMatching);

  return (
    <div className="space-y-6">
      <ScrollToOutstanding active={filters.focusOutstanding} />
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-stone-600">Sales, collections, and outstanding payments for this period</p>
      </div>

      <ReportsFilters
        key={JSON.stringify(filters)}
        filters={filters}
        rangeStart={data.range.startYmd}
        rangeEnd={data.range.endYmd}
        communities={communities}
        communitiesEnabled={communitiesEnabled}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total orders" value={String(summary.totalOrders)} />
        <SummaryCard label="Total sales" value={formatPrice(summary.totalSales)} />
        <SummaryCard label="Delivered sales" value={formatPrice(summary.deliveredSales)} />
        <SummaryCard label="Amount collected" value={formatPrice(summary.collected)} />
        <SummaryCard label="Outstanding amount" value={formatPrice(summary.outstanding)} />
      </div>

      <section
        id="outstanding"
        className={`scroll-mt-20 rounded-xl border p-5 ${
          summary.outstandingCount > 0 ? 'border-amber-300 bg-amber-50/60' : 'border-stone-200 bg-white'
        }`}
      >
        <h2 className="text-lg font-semibold text-stone-900">Outstanding</h2>
        <p className="mt-1 text-sm text-stone-600">
          {formatPrice(summary.outstanding)} · {summary.outstandingCount} unpaid delivered{' '}
          {summary.outstandingCount === 1 ? 'order' : 'orders'}
        </p>
        {outstanding.length === 0 ? (
          <p className="mt-4 text-stone-600">No outstanding payments in this period.</p>
        ) : (
          <div className="mt-4">
            <div className="space-y-3 md:hidden">
              {outstanding.map((order) => (
                <MobileOrderRowCard
                  key={order.id}
                  orderId={order.id}
                  orderNumber={order.order_number}
                  customerName={order.customer_name}
                  totalAmount={order.total_amount}
                  status={order.status}
                  paymentMethod={order.payment_method ?? 'pending'}
                  refundStatus={order.refund_status}
                  subtitle={order.mobile}
                  timeLabel="Delivered"
                  timeValue={order.deliveredAt}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <TableScroll>
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-stone-200 text-stone-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Order No</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Delivered</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Payment</th>
                      {communitiesEnabled ? <th className="px-3 py-2 font-medium">Community</th> : null}
                      <th className="px-3 py-2 font-medium">
                        <span className="sr-only">View</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {outstanding.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-2 font-semibold">{formatOrderNumber(order.order_number)}</td>
                        <td className="px-3 py-2">{order.customer_name}</td>
                        <td className="px-3 py-2">{order.mobile}</td>
                        <td className="px-3 py-2 text-stone-500">{formatDateTime(order.deliveredAt)}</td>
                        <td className="px-3 py-2">{formatPrice(order.total_amount)}</td>
                        <td className="px-3 py-2">
                          <PaymentStatusBadge
                            status={order.status}
                            paymentMethod={order.payment_method}
                            refundStatus={order.refund_status}
                          />
                        </td>
                        {communitiesEnabled ? (
                          <td className="px-3 py-2">{order.community_name || '—'}</td>
                        ) : null}
                        <td className="px-3 py-2">
                          <Link href={`/orders/${order.id}`} className="font-medium text-emerald-800">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-stone-600">No orders match these filters.</p>
        ) : (
          <>
            <div className="mt-3 space-y-3 md:hidden">
              {orders.map((order) => (
                <MobileOrderRowCard
                  key={order.id}
                  orderId={order.id}
                  orderNumber={order.order_number}
                  customerName={order.customer_name}
                  totalAmount={order.total_amount}
                  status={order.status}
                  paymentMethod={order.payment_method ?? 'pending'}
                  refundStatus={order.refund_status}
                  subtitle={`${paymentModeLabel(order.payment_method)} · ${orderChannelLabel(order.channel ?? 'app')}${
                    communitiesEnabled && order.community_name ? ` · ${order.community_name}` : ''
                  }`}
                  timeLabel="Placed"
                  timeValue={order.created_at}
                />
              ))}
            </div>
            <div className="hidden md:block">
            <TableScroll>
              <table className="min-w-full mt-3 text-left text-sm">
                <thead className="border-b border-stone-200 text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Order No</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Order status</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Channel</th>
                    {communitiesEnabled ? <th className="px-3 py-2 font-medium">Community</th> : null}
                    <th className="px-3 py-2 font-medium">Placed</th>
                    <th className="px-3 py-2 font-medium">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-3 py-2 font-semibold">{formatOrderNumber(order.order_number)}</td>
                      <td className="px-3 py-2">{order.customer_name}</td>
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
                        <td className="px-3 py-2">{order.community_name || '—'}</td>
                      ) : null}
                      <td className="px-3 py-2 text-stone-500">{formatDateTime(order.created_at)}</td>
                      <td className="px-3 py-2">
                        <Link href={`/orders/${order.id}`} className="font-medium text-emerald-800">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600">
              <p>
                {from}–{to} of {data.totalMatching}
              </p>
              <div className="flex gap-2">
                {filters.page > 1 ? (
                  <Link
                    href={queryWithPage(filters, filters.page - 1)}
                    className="inline-flex min-h-10 items-center rounded-md border border-stone-300 px-3 font-medium text-stone-800"
                  >
                    Previous
                  </Link>
                ) : null}
                {filters.page < data.pageCount ? (
                  <Link
                    href={queryWithPage(filters, filters.page + 1)}
                    className="inline-flex min-h-10 items-center rounded-md border border-stone-300 px-3 font-medium text-stone-800"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
