export type DeliveryOutcome = 'delivered' | 'not_delivered';
export type DeliveryNextAction = 'complete' | 'reschedule' | 'cancel' | 'choose';

export type NotDeliveredReason = {
  code: string;
  label: string;
  action: DeliveryNextAction;
};

export const NOT_DELIVERED_REASONS: NotDeliveredReason[] = [
  { code: 'home_locked', label: 'Home locked / no one home', action: 'reschedule' },
  { code: 'come_later', label: 'Customer asked to come later', action: 'reschedule' },
  { code: 'address_not_found', label: 'Could not find address', action: 'reschedule' },
  { code: 'rider_issue', label: 'Rider / vehicle issue', action: 'reschedule' },
  { code: 'refused', label: 'Customer refused the order', action: 'cancel' },
  { code: 'customer_cancel', label: 'Customer asked to cancel', action: 'cancel' },
  { code: 'bad_address', label: 'Wrong / incomplete address', action: 'cancel' },
  { code: 'other', label: 'Other', action: 'choose' },
];

export type DeliveryAttempt = {
  id: string;
  order_id: string;
  outcome: DeliveryOutcome;
  reason_code: string | null;
  reason_text: string;
  next_action: Exclude<DeliveryNextAction, 'choose'>;
  created_at: string;
};

export function reasonByCode(code: string): NotDeliveredReason | undefined {
  return NOT_DELIVERED_REASONS.find((item) => item.code === code);
}
