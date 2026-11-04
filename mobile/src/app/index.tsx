import { Redirect, useFocusEffect, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { View } from 'react-native';

import {
  captureNotificationLaunchTarget,
  markPushLaunchHandled,
  routeForPushLaunch,
  takePendingPushLaunch,
} from '@/notifications/pending-push-deeplink';
import { hasEnteredShop } from '@/nav/shop-entry';
import { hasStoredSession } from '@/services/supabase';

function hideSplash() {
  SplashScreen.hideAsync().catch(() => undefined);
}

type Opening =
  | { kind: 'home' }
  | { kind: 'welcome' }
  | { kind: 'redirect'; href: Href };

type WelcomeProps = { allowSkip: boolean; next: string };

async function decideOpening(): Promise<Opening> {
  await captureNotificationLaunchTarget();
  const launch = takePendingPushLaunch();
  if (launch) {
    void markPushLaunchHandled(launch.responseId);
    return { kind: 'redirect', href: routeForPushLaunch(launch) };
  }
  if ((await hasEnteredShop()) || (await hasStoredSession())) {
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
  const [WelcomeScreenView, setWelcomeScreenView] = useState<ComponentType<WelcomeProps> | null>(null);
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

  useEffect(() => {
    if (opening?.kind !== 'welcome') {
      return;
    }
    let active = true;
    void import('@/components/WelcomeSignup').then((mod) => {
      if (active) {
        setWelcomeScreenView(() => mod.WelcomeSignup);
      }
    });
    return () => {
      active = false;
    };
  }, [opening]);

  if (opening?.kind === 'redirect') {
    return <Redirect href={opening.href} />;
  }

  if (opening?.kind !== 'welcome' || !WelcomeScreenView) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#DDF1E3' }} onLayout={hideSplash}>
      <WelcomeScreenView allowSkip next="home" />
    </View>
  );
}
