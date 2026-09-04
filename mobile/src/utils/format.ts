export function formatPrice(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function formatOrderNumber(orderNumber: number | string): string {
  return String(orderNumber);
}
