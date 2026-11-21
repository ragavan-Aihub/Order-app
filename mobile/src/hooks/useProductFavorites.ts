import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useProductFavoritesContext } from '@/favorites/ProductFavoritesContext';

/** Refreshes on screen focus; favourite state is shared app-wide via ProductFavoritesProvider. */
export function useProductFavorites() {
  const value = useProductFavoritesContext();

  useFocusEffect(
    useCallback(() => {
      void value.refreshFavorites(false);
    }, [value.refreshFavorites]),
  );

  return value;
}