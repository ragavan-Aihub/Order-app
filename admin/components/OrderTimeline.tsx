import { ORDER_STATUSES, type OrderStatus, type OrderStatusEvent } from '@/types/order';
import { formatDateTime } from '@/utils/format';

const TRACK: OrderStatus[] = [
  'new',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

function label(status: string) {
  return ORDER_STATUSES.find((item) => item.value === status)?.label ?? status;
}

function caption(status: string, note: string | null) {
  if (status === 'new') {
    return 'Order placed by customer';
  }
  if (status === 'cancelled') {
    return note || 'Cancelled';
  }
  return note || 'Updated by admin';
}

export function OrderTimeline({
  currentStatus,
  events,
  cancelReason,
}: {
  currentStatus: OrderStatus;
  events: OrderStatusEvent[];
  cancelReason?: string | null;
}) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Order Timeline</h2>
      <ol className="space-y-4">
        {TRACK.map((step) => {
          const event = [...events].reverse().find((item) => item.status === step);
          const current = currentStatus === step;
          const reached = Boolean(event) || (step === 'new' && events.length === 0);
          const skippedDelivered =
            currentStatus === 'cancelled' && (step === 'delivered' || step === 'out_for_delivery');
          const done = reached && !current && !skippedDelivered;
          return (
            <li key={step} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  current
                    ? 'border-4 border-emerald-700 bg-white'
                    : done
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-200 text-stone-500'
                }`}
              >
                {done ? '✓' : current ? '' : '×'}
              </span>
              <div>
                <p className={`font-semibold ${reached || current ? 'text-stone-900' : 'text-stone-400'}`}>
                  {label(step)}
                </p>
                <p className="text-sm text-stone-500">
                  {event ? formatDateTime(event.created_at) : '—'}
                </p>
                <p className="text-sm text-stone-500">
                  {current || done ? caption(step, event?.note ?? cancelReason ?? null) : '—'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {currentStatus === 'cancelled' && cancelReason ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Cancellation</p>
          <p>{cancelReason}</p>
        </div>
      ) : null}
    </div>
  );
}
