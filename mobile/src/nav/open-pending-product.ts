import type { Href, Router } from 'expo-router';

import { offerNotificationsAfterPlacingOrder } from '@/notifications/ensure-push-permission';
import { takePendingProductDeepLink } from '@/services/product-deeplink';

const NOTIFY_WAIT_MS = 20_000;

/**
 * After welcome / sign-in: if a share product is queued, show the first-time
 * notification confirmation (when needed), then always open that product.
 * Never block forever if the permission sheet fails to resolve.
 */
export async function openPendingProductOr(router: Router, fallback: Href = '/home') {
  const productId = takePendingProductDeepLink();
  if (!productId) {
    router.replace(fallback);
    return;
  }
  try {
    await Promise.race([
      offerNotificationsAfterPlacingOrder(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, NOTIFY_WAIT_MS);
      }),
    ]);
  } catch {
    // Still open the product if permission flow errors.
  }
  router.replace({
    pathname: '/product/[id]',
    params: { id: productId, fromShare: '1' },
  });
}
