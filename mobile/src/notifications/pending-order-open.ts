type Listener = (orderId: string) => void;

let pendingOrderId: string | null = null;
const listeners = new Set<Listener>();
let lastQueuedId = '';
let lastQueuedAt = 0;

/** Queue an order to open after the shop shell is mounted (cold-start push). */
export function queuePendingOrderOpen(orderId: string) {
  const id = orderId.trim();
  if (!id) {
    return;
  }
  const now = Date.now();
  if (id === lastQueuedId && now - lastQueuedAt < 2500) {
    return;
  }
  lastQueuedId = id;
  lastQueuedAt = now;
  pendingOrderId = id;
  listeners.forEach((listener) => listener(id));
}

export function subscribePendingOrderOpen(listener: Listener) {
  listeners.add(listener);
  if (pendingOrderId) {
    listener(pendingOrderId);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function takePendingOrderOpen() {
  const id = pendingOrderId;
  pendingOrderId = null;
  return id;
}
