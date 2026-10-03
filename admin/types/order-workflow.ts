import { NEXT_STATUSES, type OrderStatus } from '@/types/order';

export const WORKFLOW_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'new', label: 'Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'out_for_delivery', label: 'Out for delivery' },
  { status: 'delivered', label: 'Delivered' },
];

export type WorkflowAction = {
  target: OrderStatus;
  label: string;
  short: string;
  confirmTitle: (orderNumber: string) => string;
  confirmLabel: string;
};

const ACTIONS: Partial<Record<OrderStatus, WorkflowAction>> = {
  new: {
    target: 'confirmed',
    label: 'Confirm order',
    short: 'Confirm',
    confirmTitle: (no) => `Confirm order ${no}?`,
    confirmLabel: 'Confirm order',
  },
  confirmed: {
    target: 'out_for_delivery',
    label: 'Mark out for delivery',
    short: 'Out for delivery',
    confirmTitle: (no) => `Mark order ${no} as Out for delivery?`,
    confirmLabel: 'Yes, out for delivery',
  },
  out_for_delivery: {
    target: 'delivered',
    label: 'Mark as delivered',
    short: 'Delivered',
    confirmTitle: (no) => `Mark order ${no} as Delivered?`,
    confirmLabel: 'Yes, delivered',
  },
};

export function normalizeStatus(status: string): OrderStatus {
  return (status === 'preparing' ? 'confirmed' : status) as OrderStatus;
}

export function workflowStepIndex(status: string): number {
  return WORKFLOW_STEPS.findIndex((step) => step.status === normalizeStatus(status));
}

export function nextAction(status: string): WorkflowAction | null {
  return ACTIONS[normalizeStatus(status)] ?? null;
}

export function canCancel(status: string): boolean {
  return (NEXT_STATUSES[normalizeStatus(status)] ?? []).includes('cancelled');
}
