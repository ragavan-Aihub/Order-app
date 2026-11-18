import { useAvailableProductOrder } from '@/notifications/useAvailableProductOrder';
import { useOrderPushRegistration } from '@/notifications/useOrderPushRegistration';
import { usePendingOrderOpen } from '@/notifications/usePendingOrderOpen';

/** Mount inside the shop tabs so push registration runs for signed-in customers. */
export function OrderPushRegistration() {
  useOrderPushRegistration();
  useAvailableProductOrder();
  usePendingOrderOpen();
  return null;
}
