let selectedCategoryId = '';
const listeners = new Set<() => void>();

export function getHomeCategoryId(): string {
  return selectedCategoryId;
}

/** Update stored category without notifying subscribers (e.g. Home chip tap). */
export function assignHomeCategoryId(id: string) {
  selectedCategoryId = id;
}

export function setHomeCategoryId(id: string) {
  if (selectedCategoryId === id) {
    return;
  }
  selectedCategoryId = id;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeHomeCategory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
