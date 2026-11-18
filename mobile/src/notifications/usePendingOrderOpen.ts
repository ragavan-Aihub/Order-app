import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import {
  subscribePendingOrderOpen,
  takePendingOrderOpen,
} from '@/notifications/pending-order-open';

/** After Home mounts from a cold-start order push, open the order on top of the shop tabs. */
export function usePendingOrderOpen() {
  const router = useRouter();

  useEffect(() => {
    const openQueued = () => {
      const id = takePendingOrderOpen();
      if (!id) {
        return;
      }
      router.push({ pathname: '/order/[id]', params: { id } });
    };

    openQueued();
    return subscribePendingOrderOpen(() => {
      openQueued();
    });
  }, [router]);
}
