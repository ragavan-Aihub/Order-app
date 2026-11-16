export const REPORT_CATALOG = [
  {
    href: '/reports/item-sales',
    title: 'Item-wise sales summary',
    description: 'Qty and amount sold for each product and pack size.',
  },
  {
    href: '/reports/daily',
    title: 'Daily sales summary',
    description: 'Orders, sales, collections, and outstanding by day.',
  },
  {
    href: '/reports/collections',
    title: 'Collections and outstanding',
    description: 'Cash and UPI collected, and unpaid delivered orders.',
  },
  {
    href: '/reports/customers',
    title: 'Customer-wise sales',
    description: 'How much each customer ordered, last order, and dues.',
  },
  {
    href: '/reports/invoice-variance',
    title: 'Ordered vs billed',
    description: 'Order list first, then line-by-line ordered vs invoiced.',
  },
  {
    href: '/reports/sales-orders',
    title: 'Sales order details',
    description: 'Order-by-order register for the period, with item lines.',
  },
] as const;
