import { Check, X } from 'lucide-react';

import { WORKFLOW_STEPS, normalizeStatus, workflowStepIndex } from '@/types/order-workflow';

export function StepTrack({
  steps,
  current,
  finished,
  label,
  size = 'md',
}: {
  steps: string[];
  current: number;
  finished: boolean;
  label: string;
  size?: 'sm' | 'md';
}) {
  const dot = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const lineTop = size === 'sm' ? 'top-[9px]' : 'top-[13px]';
  const icon = size === 'sm' ? 11 : 15;

  return (
    <ol className="flex w-full items-start" aria-label={label}>
      {steps.map((step, index) => {
        const done = index < current || (finished && index === current);
        const active = index === current && !finished;
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
          </li>
        );
      })}
    </ol>
  );
}

export function OrderStepper({
  status,
  cancelReason,
  size = 'md',
}: {
  status: string;
  cancelReason?: string | null;
  size?: 'sm' | 'md';
}) {
  if (normalizeStatus(status) === 'cancelled') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
          <X size={12} strokeWidth={3} aria-hidden />
        </span>
        <div>
          <p className="font-semibold">Order cancelled</p>
          {cancelReason ? <p className="text-red-700">{cancelReason}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <StepTrack
      steps={WORKFLOW_STEPS.map((step) => step.label)}
      current={workflowStepIndex(status)}
      finished={normalizeStatus(status) === 'delivered'}
      label="Order progress"
      size={size}
    />
  );
}
