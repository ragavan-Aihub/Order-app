export type SamIntent =
  | 'ADD_ITEMS'
  | 'REMOVE_ITEM'
  | 'CHANGE_QUANTITY'
  | 'CLEAR_DRAFT'
  | 'CONFIRM'
  | 'CANCEL'
  | 'PRODUCT_INFORMATION'
  | 'INGREDIENTS'
  | 'ORDER_STATUS'
  | 'GENERAL_HELP'
  | 'NOTE_PRODUCT_INFO'
  | 'UNKNOWN';

export type SamLanguage = 'en' | 'ta' | 'mix';

export type ConversationState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'DRAFT_READY'
  | 'WAITING_FOR_CONFIRMATION'
  | 'CLARIFICATION_REQUIRED'
  | 'CONFIRMED'
  | 'ORDER_CREATED'
  | 'CANCELLED'
  | 'ERROR';

export type ParsedItem = {
  product_name: string;
  quantity: number;
};

export type ParsedIntent = {
  intent: SamIntent;
  items: ParsedItem[];
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  ingredients: string | null;
  price: number;
  available: boolean;
  active: boolean;
};

export type DraftLine = {
  productId: string;
  quantity: number;
};

export type DraftViewLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type SamTurnRequest = {
  transcript: string;
  businessId: string;
  draft: DraftLine[];
  pendingNoteProductId?: string | null;
};

export type SamTurnResponse = {
  reply: string;
  language: SamLanguage;
  intent: SamIntent;
  conversationState: ConversationState;
  draft: { items: DraftViewLine[]; total: number };
  canPlace: boolean;
  pendingNoteProductId: string | null;
  match?: { query: string; productIds: string[] }[];
};
