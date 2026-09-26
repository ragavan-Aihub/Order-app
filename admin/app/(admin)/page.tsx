import Link from 'next/link';

import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import { getDashboardData } from '@/services/reports';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

function KpiCard({
  label,
  value,
  hint,
  href,
  attention = false,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  attention?: boolean;
}) {
  const card = (
    <div
      className={`rounded-xl border bg-white p-4 ${
        attention ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200'
      }`}
    >
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${attention ? 'text-amber-800' : 'text-stone-900'}`}>{value}</p>
      {hint ? <p className={`mt-1 text-sm ${attention ? 'font-medium text-amber-800' : 'text-stone-500'}`}>{hint}</p> : null}
    </div>
  );
  if (!href) {
    return card;
  }
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
      {card}
    </Link>
  );
}

export default async function DashboardPage() {
  const result = await getDashboardData();

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
        <div className="rounded-xl border border-red-200 bg-white p-5 text-stone-700">
          <p className="font-medium text-red-800">Could not load today’s figures.</p>
          <p className="mt-1 text-sm">{result.message}</p>
          <Link href="/" className="mt-3 inline-block font-medium text-emerald-800">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  const data = result.data;
  const outstandingHref = '/reports?range=30d&status=delivered&payment=pending&focus=outstanding';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-stone-600">What needs your attention today</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Orders today"
          value={String(data.ordersToday)}
          hint={data.showYesterdayCompare ? `${data.ordersYesterday} yesterday` : undefined}
        />
        <KpiCard label="Sales today" value={formatPrice(data.salesToday)} />
        <KpiCard label="Delivered today" value={String(data.deliveredToday)} />
        <KpiCard
          label="Outstanding"
          value={formatPrice(data.outstandingAmount)}
          hint={`${data.outstandingCount} unpaid delivered ${data.outstandingCount === 1 ? 'order' : 'orders'}`}
          href={outstandingHref}
          attention={data.outstandingCount > 0}
        />
      </div>

      <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800">
        {data.insight}
      </p>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link href="/orders" className="font-medium text-emerald-800">
            All orders
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-stone-600">No orders yet. New orders will show up here.</p>
        ) : (
          <TableScroll>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Payment</th>
                  <th className="px-3 py-2 font-medium">Placed</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.recent.map((order) => (
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
        )}
      </section>
    </div>
  );
}
