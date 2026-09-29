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

export type DraftViewLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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
