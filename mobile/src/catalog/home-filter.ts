let selectedCategoryId = '';
const listeners = new Set<() => void>();

export function getHomeCategoryId(): string {
  return selectedCategoryId;
}

export function setHomeCategoryId(id: string) {
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
