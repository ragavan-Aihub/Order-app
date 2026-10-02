export type SamIntent =
  | 'ADD_ITEMS'
  | 'REMOVE_ITEM'
  | 'CHANGE_QUANTITY'
  | 'CLEAR_DRAFT'
  | 'CONFIRM'
  | 'CANCEL'
  | 'SHOW_PRODUCTS'
  | 'SEARCH_PRODUCTS'
  | 'PRODUCT_INFORMATION'
  | 'PRODUCT_AVAILABILITY'
  | 'PRODUCT_PRICE'
  | 'INGREDIENTS'
  | 'ORDER_STATUS'
  | 'ORDER_HISTORY'
  | 'HOW_TO_ORDER'
  | 'FARM2FLAVOURS_HELP'
  | 'GENERAL_HELP'
  | 'GREETING'
  | 'ABOUT_SAM'
  | 'SAM_CAPABILITIES'
  | 'IRRELEVANT'
  | 'NOTE_PRODUCT_INFO'
  | 'UNKNOWN';

export type SamLanguage = 'en' | 'ta' | 'mix';

export type DetectedLlmLanguage = 'en' | 'ta' | 'tanglish';

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
  detected_language?: DetectedLlmLanguage;
  target_product?: string | null;
  search_query?: string | null;
  user_query_summary?: string;
  requires_clarification?: boolean;
  clarification_question?: string | null;
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

export type SamTurnMessage = {
  role: 'user' | 'sam';
  text: string;
};

export type SamTurnRequest = {
  transcript: string;
  businessId: string;
  draft: DraftLine[];
  pendingNoteProductId?: string | null;
  recentTurns?: SamTurnMessage[];
  displayedNames?: string[];
  waitingForConfirm?: boolean;
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

export type PromptContext = {
  catalogNames: string[];
  cartLines: { name: string; quantity: number }[];
  displayedNames: string[];
  recentTurns: SamTurnMessage[];
  transcript: string;
  hint?: string | null;
};
