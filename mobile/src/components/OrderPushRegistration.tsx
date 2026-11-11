import { useAvailableProductOrder } from '@/notifications/useAvailableProductOrder';
import { useOrderPushRegistration } from '@/notifications/useOrderPushRegistration';

/** Mount inside the shop tabs so push registration runs for signed-in customers. */
export function OrderPushRegistration() {
  useOrderPushRegistration();
  useAvailableProductOrder();
  return null;
}
