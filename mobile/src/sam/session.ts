import type { DraftViewLine } from '@/sam/types';

let items: DraftViewLine[] = [];
let pendingNoteProductId: string | null = null;

export function getSamDraftItems() {
  return items;
}

export function setSamDraftItems(next: DraftViewLine[]) {
  items = next;
}

export function getPendingNoteProductId() {
  return pendingNoteProductId;
}

export function setPendingNoteProductId(id: string | null) {
  pendingNoteProductId = id;
}

export function clearSamSession() {
  items = [];
  pendingNoteProductId = null;
}
