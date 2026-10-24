/** Route params for Home after a “now available” push tap (new key each tap re-runs focus logic). */
export function homeParamsForAvailableProductPush(productId: string) {
  return {
    focusProduct: productId,
    fromAvailablePush: '1' as const,
    pushOpenKey: String(Date.now()),
  };
}
