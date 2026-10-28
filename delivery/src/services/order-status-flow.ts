import { NEXT_STATUSES, orderStatusLabel, type OrderStatus } from '@/types/order';

const FLOW: OrderStatus[] = ['new', 'confirmed', 'out_for_delivery', 'delivered'];

export function normalizeOrderStatus(raw: string): OrderStatus {
  return (raw === 'preparing' ? 'confirmed' : raw) as OrderStatus;
}

export function isPaymentCollected(method: string): boolean {
  return method === 'cash' || method === 'upi';
}

function statusRank(status: OrderStatus): number {
  if (status === 'cancelled') {
    return -1;
  }
  const index = FLOW.indexOf(status);
  return index >= 0 ? index : 0;
}

export type StatusTransitionIssue = {
  outcome: 'already_applied' | 'updated_elsewhere' | 'blocked';
  message: string;
};

export function classifyStatusTransition(
  currentStatus: OrderStatus,
  requested: OrderStatus,
): StatusTransitionIssue | null {
  if (NEXT_STATUSES[currentStatus].includes(requested)) {
    return null;
  }

  const currentLabel = orderStatusLabel(currentStatus);

  if (currentStatus === requested) {
    return {
      outcome: 'already_applied',
      message: `This order is already ${currentLabel.toLowerCase()}.`,
    };
  }

  if (currentStatus === 'cancelled') {
    return {
      outcome: 'updated_elsewhere',
      message: 'This order was cancelled. No further delivery steps apply.',
    };
  }

  if (statusRank(currentStatus) > statusRank(requested)) {
    return {
      outcome: 'updated_elsewhere',
      message: `This order was updated elsewhere (for example in admin). It is now ${currentLabel.toLowerCase()}.`,
    };
  }

  return {
    outcome: 'blocked',
    message: `This order is ${currentLabel.toLowerCase()}. That step is not available anymore.`,
  };
}
