'use client';

import { CheckCircle2, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

const NOTICE_MS = 4000;
const MAX_NOTICES = 3;

type Notice = { id: number; message: string };

const NoticeContext = createContext<((message: string) => void) | null>(null);

export function ActionNoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const show = useCallback(
    (message: string) => {
      nextId.current += 1;
      const id = nextId.current;
      setNotices((current) => [...current.slice(-(MAX_NOTICES - 1)), { id, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), NOTICE_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <NoticeContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-emerald-800/20"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p className="flex-1">{notice.message}</p>
            <button
              type="button"
              onClick={() => dismiss(notice.id)}
              aria-label="Dismiss message"
              className="-m-1 rounded-md p-1 text-emerald-50 hover:bg-emerald-800"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

export function useActionNotice() {
  const show = useContext(NoticeContext);
  if (!show) {
    throw new Error('useActionNotice must be used inside ActionNoticeProvider.');
  }
  return useMemo(() => ({ show }), [show]);
}

/**
 * Refreshes the page data after a successful action and shows the message only once the
 * refreshed data is on screen. `refreshing` stays true until then, so buttons can keep
 * showing progress instead of looking finished while the page still shows old data.
 */
export function useActionComplete() {
  const router = useRouter();
  const notice = useActionNotice();
  const [refreshing, startTransition] = useTransition();
  const queued = useRef<string | null>(null);

  useEffect(() => {
    if (!refreshing && queued.current) {
      const message = queued.current;
      queued.current = null;
      notice.show(message);
    }
  }, [notice, refreshing]);

  const complete = useCallback(
    (message: string) => {
      queued.current = message;
      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  return { complete, refreshing };
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" aria-hidden />;
}
