'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function ActionNotice({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p role="status" aria-live="polite" className="text-sm font-medium text-emerald-800">
      {message}
    </p>
  );
}

export function useActionNotice() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setMessage(null);
  }, []);

  const show = useCallback((next: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setMessage(next);
    timer.current = setTimeout(() => {
      setMessage(null);
      timer.current = null;
    }, 4000);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return { message, show, clear };
}
