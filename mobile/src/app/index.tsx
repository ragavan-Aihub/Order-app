import { Redirect, useFocusEffect, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { GoogleSignIn } from '@/components/GoogleSignIn';

import {
  captureNotificationLaunchTarget,
  markPushLaunchHandled,
  routeForPushLaunch,
  takePendingPushLaunch,
} from '@/notifications/pending-push-deeplink';
import { hasEnteredShop } from '@/nav/shop-entry';
import {
  captureInitialProductDeepLink,
  peekPendingProductDeepLink,
  takePendingProductDeepLink,
} from '@/services/product-deeplink';
import { hasStoredSession } from '@/services/supabase';

function hideSplash() {
  SplashScreen.hideAsync().catch(() => undefined);
}

type Opening =
  | { kind: 'home' }
  | { kind: 'welcome' }
  | { kind: 'redirect'; href: Href };

async function decideOpening(): Promise<Opening> {
  await captureNotificationLaunchTarget();
  const launch = takePendingPushLaunch();
  if (launch) {
    void markPushLaunchHandled(launch.responseId);
    return { kind: 'redirect', href: routeForPushLaunch(launch) };
  }
  await captureInitialProductDeepLink();
  const sharedProductId = peekPendingProductDeepLink();
  const entered = hasEnteredShop();
  let session = false;
  try {
    session = await Promise.race([
      hasStoredSession(),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 2500);
      }),
    ]);
  } catch {
    session = false;
  }
  const canBrowse = entered || session;
  if (sharedProductId && canBrowse) {
    takePendingProductDeepLink();
    return {
      kind: 'redirect',
      href: { pathname: '/product/[id]', params: { id: sharedProductId, fromShare: '1' } },
    };
  }
  // Not signed in / never entered shop: keep product queued and show welcome first.
  if (canBrowse) {
    return { kind: 'home' };
  }
  return { kind: 'welcome' };
}

let coldStart: Promise<Opening> | null = null;

function startOpening() {
  if (!coldStart) {
    coldStart = decideOpening();
  }
  return coldStart;
}

void startOpening();

export default function WelcomeScreen() {
  const router = useRouter();
  const [opening, setOpening] = useState<Opening | null>(null);
  const openedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const pending = openedOnce.current ? decideOpening() : startOpening();
      openedOnce.current = true;
      void pending
        .then((next) => {
          if (!active) {
            return;
          }
          setOpening(next);
          if (next.kind === 'redirect') {
            hideSplash();
            return;
          }
          if (next.kind === 'home') {
            router.replace('/home');
          }
        })
        .catch(() => {
          if (active) {
            setOpening({ kind: 'welcome' });
          }
        });
      return () => {
        active = false;
      };
    }, [router]),
  );

  if (opening?.kind === 'redirect') {
    return <Redirect href={opening.href} />;
  }

  if (opening?.kind !== 'welcome') {
    return <View style={{ flex: 1, backgroundColor: '#DDF1E3' }} onLayout={hideSplash} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#DDF1E3' }} onLayout={hideSplash}>
      <GoogleSignIn allowSkip next="home" />
    </View>
  );
}
