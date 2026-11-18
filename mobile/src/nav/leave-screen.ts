import type { Href, Router } from 'expo-router';

/** Leave a root-stack screen opened without history (push / cold start). */
export function leaveScreen(router: Router, fallback: Href = '/home') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
