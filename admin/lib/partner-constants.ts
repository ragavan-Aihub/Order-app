export const PARTNER_SCOPES = ['catalog.read', 'orders.read', 'orders.write'] as const;

export const PARTNER_CHANNELS = [
  { id: 'api', label: 'Partner API' },
  { id: 'whatsapp', label: 'WhatsApp' },
] as const;
