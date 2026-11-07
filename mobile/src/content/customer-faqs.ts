export type CustomerFaq = {
  question: string;
  answer: string;
};

export const CUSTOMER_FAQS: CustomerFaq[] = [
  {
    question: 'When do I get a notification?',
    answer:
      'After you allow notifications, the phone alerts you when the shop confirms the order, sends it out, or marks it delivered. You also get an alert when a Coming soon item you tapped Notify me on is ready. If nothing arrives, turn notifications on for Farm2Flavour in your phone Settings. Tap the alert to open that order.',
  },
  {
    question: 'I placed the order and then remembered a change. Can I still update it?',
    answer:
      'Yes, while it is Placed or Confirmed. Open Your Orders, tap Modify, then add an item, change a quantity, or remove one, and tap Update order. Once it is Out for delivery, call the shop.',
  },
  {
    question: 'Can I cancel the order?',
    answer:
      'You can cancel only while it is still Placed, before the shop confirms. After that, call the shop.',
  },
  {
    question: 'It says I already have an order for this address.',
    answer:
      'One address can have only one open order. Modify that order, or send the new one to another saved address. When the first order is Out for delivery, you can place another to the same address.',
  },
  {
    question: 'Can I send this order to a different address?',
    answer:
      'While it is Placed or Confirmed, open the order, tap Modify, change Deliver to at the top, then tap Update order. After it is on the way, the address stays as placed.',
  },
  {
    question: 'When do I pay?',
    answer:
      'You pay the person who delivers, by cash or UPI. The app does not take payment.',
  },
  {
    question: 'I already paid, but the order still shows not paid.',
    answer:
      'The shop records the payment after delivery. Until they save Cash or UPI, the order can still show as not paid. If it stays that way, call the shop.',
  },
  {
    question: 'The shop changed my order. Where do I see what changed?',
    answer:
      'Open the order and tap View changes. You will see what was added, removed, or changed, and the new total.',
  },
  {
    question: 'How do I know the shop has accepted the order?',
    answer:
      'Open Your Orders. Placed means it is waiting. Confirmed means the shop accepted it. Out for delivery means it is on the way.',
  },
  {
    question: 'A product says Coming soon. Can I add it?',
    answer:
      'Not yet. It is shown so you know it is on the way, but it cannot be added. Tap Notify me if you want a message when it can be ordered.',
  },
  {
    question: 'How do I sign in?',
    answer:
      'Tap Continue with Google and choose the Google account on the phone. Or Continue with Email: we send a sign-in link from Supabase Auth (subject Your sign-in link). That is this shop finishing sign-in. Open it on this phone.',
  },
];
