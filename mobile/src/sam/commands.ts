export type SamCommand = {
  id: string;
  label: string;
  prompt: string;
};

export const SAM_COMMANDS: SamCommand[] = [
  { id: 'confirm', label: 'Confirm', prompt: 'Confirm' },
  { id: 'place', label: 'Place order', prompt: 'Place order' },
  { id: 'show', label: 'Browse products', prompt: 'Show products' },
  { id: 'where', label: 'Where is my order?', prompt: 'Where is my order?' },
  { id: 'contents', label: "What's in my order?", prompt: "What's in my order?" },
  { id: 'new', label: 'Start another order', prompt: 'Start another order' },
];

export const OPEN_ORDER_CHIPS: SamCommand[] = [
  { id: 'where', label: 'Where is my order?', prompt: 'Where is my order?' },
  { id: 'contents', label: "What's in my order?", prompt: "What's in my order?" },
  { id: 'modify', label: 'Modify order', prompt: 'Modify order' },
  { id: 'cancel', label: 'Cancel this order', prompt: 'Cancel this order' },
  { id: 'new', label: 'Start another order', prompt: 'Start another order' },
];

export const ORDER_STATUS_FOLLOWUPS: SamCommand[] = OPEN_ORDER_CHIPS;

export const PLACE_NEW_CHOICES: SamCommand[] = [
  { id: 'new-address', label: 'New address', prompt: 'New address' },
  { id: 'edit-existing', label: 'Edit existing order', prompt: 'Edit existing order' },
];

export function utteranceKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CONFIRM = new Set([
  'confirm',
  'yes',
  'yes place the order',
  'place the order',
  'yes place order',
  'place order',
  'place',
  'update',
  'update order',
  'update the order',
  'save order',
  'ஆமாம்',
  'உறுதி',
  'ஆர்டர் செய்யலாம்',
  'confirm pannunga',
  'order pannunga',
  'seri',
  'ok',
  'okay',
  'aamaam',
  'aama',
]);

export function isPlaceOrConfirm(transcript: string) {
  return CONFIRM.has(utteranceKey(transcript));
}

export function isModifyOrder(transcript: string) {
  const t = utteranceKey(transcript);
  return (
    t === 'modify order' ||
    t === 'modify this order' ||
    t === 'modify' ||
    t === 'change order' ||
    t === 'edit order' ||
    t === 'edit the existing order' ||
    t === 'edit existing order' ||
    t === 'modify the existing order' ||
    t === 'modify existing order' ||
    t === 'change the existing order' ||
    t === 'change existing order' ||
    t === 'edit this order' ||
    t === 'i want to change my order' ||
    t === 'change my order' ||
    t === 'remove one item' ||
    t === 'remove an item' ||
    t === 'remove item'
  );
}

export function isCancelOrder(transcript: string) {
  const t = utteranceKey(transcript);
  return t === 'cancel order' || t === 'cancel my order' || t === 'cancel this order';
}

export function isWhereIsMyOrder(transcript: string) {
  const t = utteranceKey(transcript);
  return (
    t === 'where is my order' ||
    t === 'order status' ||
    t === 'track my order' ||
    t === 'track order' ||
    t === 'where is the order'
  );
}

export function isWhatsInMyOrder(transcript: string) {
  const t = utteranceKey(transcript);
  return (
    t.includes('whats in my order') ||
    t.includes('what is in my order') ||
    t.includes('what s in my order') ||
    t.includes('whats in the order') ||
    t === 'show my items' ||
    t === 'show my order' ||
    t === 'what is in the order' ||
    /\bwhats in\b/.test(t)
  );
}

export function isPlaceNewOrder(transcript: string) {
  const t = utteranceKey(transcript);
  return (
    t === 'place a new order' ||
    t === 'new order' ||
    t === 'place new order' ||
    t === 'start another order' ||
    t === 'start a new order' ||
    t === 'another order'
  );
}

export function mentionsExistingOrder(transcript: string) {
  const t = utteranceKey(transcript);
  return /\b(my order|this order|the order)\b/.test(t);
}

export function isNewAddress(transcript: string) {
  const t = utteranceKey(transcript);
  return t === 'new address' || t === 'different address' || t === 'another address';
}

export function commandSuggestions(typed: string) {
  const term = typed.trim().toLowerCase();
  if (term.length < 2) {
    return [] as SamCommand[];
  }
  return SAM_COMMANDS.filter(
    (command) =>
      command.label.toLowerCase().startsWith(term) ||
      command.prompt.toLowerCase().startsWith(term) ||
      command.label.toLowerCase().includes(term),
  ).slice(0, 6);
}
