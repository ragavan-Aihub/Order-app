import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_CLEAR_MS = 2500;

/**
 * Immediate “opening…” feedback for router navigations.
 * Sets pending on press, clears when this screen regains focus or after a short timeout.
 */
export function usePendingNav(clearAfterMs = DEFAULT_CLEAR_MS) {
  const [pending, setPending] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingNav = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPending(false);
    setPendingKey(null);
  }, []);

  const runPendingNav = useCallback(
    (navigate: () => void, key?: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setPending(true);
      setPendingKey(key ?? null);
      navigate();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setPending(false);
        setPendingKey(null);
      }, clearAfterMs);
    },
    [clearAfterMs],
  );

  useFocusEffect(
    useCallback(() => {
      clearPendingNav();
    }, [clearPendingNav]),
  );

  useEffect(() => () => clearPendingNav(), [clearPendingNav]);

  return { pending, pendingKey, runPendingNav, clearPendingNav };
}
