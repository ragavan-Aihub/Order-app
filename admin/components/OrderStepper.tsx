import { Check, X } from 'lucide-react';

import type { OrderStatusEvent } from '@/types/order';
import { WORKFLOW_STEPS, normalizeStatus, workflowStepIndex } from '@/types/order-workflow';
import { formatStepTime } from '@/utils/format';

export function StepTrack({
  steps,
  current,
  finished,
  label,
  size = 'md',
  times,
}: {
  steps: string[];
  current: number;
  finished: boolean;
  label: string;
  size?: 'sm' | 'md';
  times?: (string | null)[];
}) {
  const dot = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const lineTop = size === 'sm' ? 'top-[9px]' : 'top-[13px]';
  const icon = size === 'sm' ? 11 : 15;

  return (
    <ol className="flex w-full items-start" aria-label={label}>
      {steps.map((step, index) => {
        const done = index < current || (finished && index === current);
        const active = index === current && !finished;
        const time = times?.[index] ?? null;
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span
                aria-hidden
                className={`absolute right-1/2 ${lineTop} h-0.5 w-full ${
                  index <= current ? 'bg-emerald-600' : 'bg-stone-200'
                }`}
              />
            ) : null}
            <span
              className={`relative z-10 flex ${dot} items-center justify-center rounded-full ${
                done
                  ? 'bg-emerald-600 text-white'
                  : active
                    ? 'border-2 border-emerald-600 bg-white'
                    : 'border-2 border-stone-300 bg-white'
              }`}
            >
              {done ? <Check size={icon} strokeWidth={3} aria-hidden /> : null}
              {active ? (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-30" aria-hidden />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden />
                </>
              ) : null}
            </span>
            <span
              className={`mt-1.5 px-0.5 leading-tight ${size === 'sm' ? 'text-[11px]' : 'text-xs'} ${
                active
                  ? 'font-semibold text-emerald-800'
                  : done
                    ? 'font-medium text-stone-700'
                    : 'text-stone-400'
              }`}
            >
              {step}
              {active ? <span className="sr-only"> (current)</span> : null}
            </span>
            {time ? (
              <span className="mt-0.5 px-0.5 text-[11px] leading-tight text-stone-500 tabular-nums">{time}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function latestEventAt(events: OrderStatusEvent[], status: string): string | null {
  let latest: string | null = null;
  for (const event of events) {
    if (normalizeStatus(event.status) === status && (!latest || event.created_at > latest)) {
      latest = event.created_at;
    }
  }
  return latest;
}

export function OrderStepper({
  status,
  cancelReason,
  size = 'md',
  events,
  placedAt,
}: {
  status: string;
  cancelReason?: string | null;
  size?: 'sm' | 'md';
  events?: OrderStatusEvent[];
  placedAt?: string | null;
}) {
  const history = events ?? [];

  if (normalizeStatus(status) === 'cancelled') {
    const cancelledAt = latestEventAt(history, 'cancelled');
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
          <X size={12} strokeWidth={3} aria-hidden />
        </span>
        <div>
          <p className="font-semibold">Order cancelled</p>
          {cancelReason ? <p className="text-red-700">{cancelReason}</p> : null}
          {cancelledAt ? <p className="mt-0.5 text-xs text-red-700/80">{formatStepTime(cancelledAt)}</p> : null}
        </div>
      </div>
    );
  }

  const current = workflowStepIndex(status);
  const showTimes = events !== undefined || Boolean(placedAt);
  const times = showTimes
    ? WORKFLOW_STEPS.map((step, index) => {
        if (index > current) {
          return null;
        }
        const at = index === 0 ? (placedAt ?? latestEventAt(history, step.status)) : latestEventAt(history, step.status);
        return at ? formatStepTime(at) : null;
      })
    : undefined;

  return (
    <StepTrack
      steps={WORKFLOW_STEPS.map((step) => step.label)}
      current={current}
      finished={normalizeStatus(status) === 'delivered'}
      label="Order progress"
      size={size}
      times={times}
    />
  );
}
