import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { InteractionManager } from 'react-native';

import { NotificationPermissionSheet } from '@/components/NotificationPermissionSheet';
import {
  isNotificationPrepromptDismissed,
  setNotificationPrepromptDismissed,
} from '@/notifications/notification-preprompt-dismissed';
import {
  isHomeCatalogReadyForNotificationOffer,
  registerNotificationAutoOffer,
  replayNotificationOfferAfterAuth,
  resetNotificationCatalogOffer,
} from '@/notifications/notification-permission-offer';
import {
  registerNotificationPreprompt,
  type NotificationPrepromptResult,
} from '@/notifications/notification-permission-prequest';
import { registerForOrderPush } from '@/notifications/order-push';
import { isPushAvailable } from '@/notifications/push-runtime';
import { requestOsNotificationPermissionOnce } from '@/notifications/request-os-notification-permission';
import { getSupabaseClient } from '@/services/supabase';

const OFFER_AFTER_CATALOG_MS = 350;

type PermissionSnapshot = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

function shouldShowCustomPreprompt(permission: PermissionSnapshot): boolean {
  if (permission.status === 'granted') {
    return false;
  }
  if (permission.status === 'denied' && permission.canAskAgain === false) {
    return false;
  }
  return true;
}

export function NotificationPermissionProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const offeredRef = useRef(false);
  const evalInFlight = useRef(false);
  const pendingRef = useRef<((result: NotificationPrepromptResult) => void) | null>(null);
  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishPending = useCallback((result: NotificationPrepromptResult) => {
    pendingRef.current?.(result);
    pendingRef.current = null;
  }, []);

  const runAllowFlow = useCallback(async (): Promise<NotificationPrepromptResult> => {
    const permission = await requestOsNotificationPermissionOnce();
    if (permission === 'granted') {
      await setNotificationPrepromptDismissed();
      await registerForOrderPush();
      return 'granted';
    }
    await setNotificationPrepromptDismissed();
    return 'denied';
  }, []);

  const showPreprompt = useCallback((): Promise<NotificationPrepromptResult> => {
    return new Promise((resolve) => {
      pendingRef.current = resolve;
      setVisible(true);
    });
  }, []);

  useEffect(() => {
    registerNotificationPreprompt(showPreprompt);
    return () => registerNotificationPreprompt(null);
  }, [showPreprompt]);

  const tryOfferPreprompt = useCallback(async () => {
    if (!isPushAvailable() || offeredRef.current || evalInFlight.current) {
      return;
    }
    if (!isHomeCatalogReadyForNotificationOffer()) {
      return;
    }
    evalInFlight.current = true;
    try {
      if (await isNotificationPrepromptDismissed()) {
        offeredRef.current = true;
        return;
      }
      const permission = await Notifications.getPermissionsAsync();
      if (permission.status === 'granted') {
        offeredRef.current = true;
        void registerForOrderPush();
        return;
      }
      if (!shouldShowCustomPreprompt(permission)) {
        offeredRef.current = true;
        return;
      }
      offeredRef.current = true;
      setVisible(true);
    } finally {
      evalInFlight.current = false;
    }
  }, []);

  const tryOfferRef = useRef(tryOfferPreprompt);
  tryOfferRef.current = tryOfferPreprompt;

  const scheduleOfferAfterCatalog = useCallback(() => {
    if (offerTimerRef.current) {
      clearTimeout(offerTimerRef.current);
    }
    offerTimerRef.current = setTimeout(() => {
      void tryOfferRef.current();
    }, OFFER_AFTER_CATALOG_MS);
  }, []);

  const scheduleOfferRef = useRef(scheduleOfferAfterCatalog);
  scheduleOfferRef.current = scheduleOfferAfterCatalog;

  useEffect(() => {
    const schedule = () => scheduleOfferRef.current();
    registerNotificationAutoOffer(schedule);
    return () => {
      registerNotificationAutoOffer(null);
      if (offerTimerRef.current) {
        clearTimeout(offerTimerRef.current);
        offerTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        resetNotificationCatalogOffer();
        offeredRef.current = false;
        return;
      }
      if (event === 'SIGNED_IN') {
        offeredRef.current = false;
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        replayNotificationOfferAfterAuth();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const closeWithoutAllow = useCallback(async () => {
    await setNotificationPrepromptDismissed();
    setVisible(false);
    finishPending('denied');
  }, [finishPending]);

  const onNotNow = () => {
    void closeWithoutAllow();
  };

  const onAllow = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setVisible(false);
    void (async () => {
      try {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        const result = await runAllowFlow();
        finishPending(result);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <>
      {children}
      <NotificationPermissionSheet
        visible={visible}
        busy={busy}
        onAllow={onAllow}
        onNotNow={onNotNow}
      />
    </>
  );
}
