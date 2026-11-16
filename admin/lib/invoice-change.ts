export type InvoiceLineChange = 'no_difference' | 'excess' | 'short' | 'removed' | 'added';
export type InvoiceOrderChange = 'no_difference' | 'excess' | 'short' | 'mixed';

export function invoiceLineChange(orderedQty: number, billedQty: number): InvoiceLineChange {
  if (orderedQty > 0 && billedQty <= 0) {
    return 'removed';
  }
  if (orderedQty <= 0 && billedQty > 0) {
    return 'added';
  }
  if (billedQty > orderedQty) {
    return 'excess';
  }
  if (billedQty < orderedQty) {
    return 'short';
  }
  return 'no_difference';
}

export function invoiceLineChangeLabel(change: InvoiceLineChange): string {
  switch (change) {
    case 'no_difference':
      return 'No difference';
    case 'excess':
      return 'Excess';
    case 'short':
      return 'Short';
    case 'removed':
      return 'Removed';
    case 'added':
      return 'Added';
  }
}

export function invoiceOrderChangeLabel(change: InvoiceOrderChange): string {
  switch (change) {
    case 'no_difference':
      return 'No difference';
    case 'excess':
      return 'Excess';
    case 'short':
      return 'Short';
    case 'mixed':
      return 'Mixed';
  }
}
