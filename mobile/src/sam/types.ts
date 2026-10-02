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

export type SamTurnResponse = {
  reply: string;
  language: 'en' | 'ta' | 'mix';
  intent: SamIntent;
  conversationState: string;
  draft: { items: DraftViewLine[]; total: number };
  canPlace: boolean;
  pendingNoteProductId: string | null;
};
