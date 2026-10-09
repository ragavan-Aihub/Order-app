import { useOrderPushRegistration } from '@/notifications/useOrderPushRegistration';

/** Mount inside the shop tabs so push registration runs for signed-in customers. */
export function OrderPushRegistration() {
  useOrderPushRegistration();
  return null;
}
