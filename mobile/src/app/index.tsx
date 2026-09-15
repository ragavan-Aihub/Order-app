import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { WelcomeSignup } from '@/components/WelcomeSignup';
import { colors } from '@/config/theme';
import { hasEnteredShop } from '@/nav/shop-entry';
import { getSignedInUser } from '@/services/supabase';

export default function WelcomeScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getSignedInUser(), hasEnteredShop()])
        .then(([user, entered]) => {
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
        })
        .catch(() => {
          if (active) {
            setReady(true);
          }
        });
      return () => {
        active = false;
      };
    }, [router]),
  );

  if (!showWelcome) {
    return <Redirect href="/home" />;
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
