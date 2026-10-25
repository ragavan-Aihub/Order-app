/** Home calls this after the product catalog has painted. */
let offerWhenCatalogReady: (() => void) | null = null;
let catalogReady = false;

function dispatchCatalogReadyOffer(): void {
  offerWhenCatalogReady?.();
}

export function registerNotificationAutoOffer(handler: (() => void) | null): void {
  offerWhenCatalogReady = handler;
  if (handler && catalogReady) {
    dispatchCatalogReadyOffer();
  }
}

export function notifyHomeCatalogReady(): void {
  catalogReady = true;
  dispatchCatalogReadyOffer();
}

export function isHomeCatalogReadyForNotificationOffer(): boolean {
  return catalogReady;
}

/** Sign-out: home will notify again on next catalog paint / focus. */
export function resetNotificationCatalogOffer(): void {
  catalogReady = false;
}

/** Auth completed while home is already showing products. */
export function replayNotificationOfferAfterAuth(): void {
  if (catalogReady) {
    dispatchCatalogReadyOffer();
  }
}
