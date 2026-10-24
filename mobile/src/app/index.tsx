import { Redirect, useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { WelcomeSignup } from '@/components/WelcomeSignup';
import { colors } from '@/config/theme';
import {
  captureNotificationLaunchTarget,
  markPushLaunchHandled,
  routeForPushLaunch,
  takePendingPushLaunch,
} from '@/notifications/pending-push-deeplink';
import { hasEnteredShop } from '@/nav/shop-entry';
import { getSignedInUser } from '@/services/supabase';

export default function WelcomeScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [launchRedirect, setLaunchRedirect] = useState<Href | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          await captureNotificationLaunchTarget();
          if (!active) {
            return;
          }
          const launch = takePendingPushLaunch();
          if (launch) {
            setLaunchRedirect(routeForPushLaunch(launch));
            void markPushLaunchHandled(launch.responseId);
            return;
          }
          const [user, entered] = await Promise.all([getSignedInUser(), hasEnteredShop()]);
          if (!active) {
            return;
          }
          if (user || entered) {
            setShowWelcome(false);
            router.replace('/home');
            return;
          }
          setShowWelcome(true);
          setReady(true);
        } catch {
          if (active) {
            setReady(true);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [router]),
  );

  if (launchRedirect) {
    return <Redirect href={launchRedirect} />;
  }

  if (!showWelcome) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <WelcomeSignup allowSkip next="home" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
