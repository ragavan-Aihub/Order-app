import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadAddressBook } from '@/cart/address-book';
import { colors, spacing } from '@/config/theme';
import { markEnteredShop } from '@/nav/shop-entry';
import { consumeAuthUrl, isAuthCallbackUrl, watchAuthDeepLinks } from '@/services/auth-deeplink';
import { takeAuthNext } from '@/services/google-auth';

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finish(url: string | null) {
      if (!url) {
        if (active) router.replace('/');
        return;
      }
      const outcome = await consumeAuthUrl(url);
      if (!outcome) {
        if (active) router.replace('/');
        return;
      }
      if (!active) return;
      if (outcome.status === 'success') {
        await markEnteredShop();
        await loadAddressBook();
        router.replace(await takeAuthNext());
        return;
      }
      if (outcome.status === 'cancelled') {
        router.replace('/');
        return;
      }
      setMessage(outcome.message);
    }

    const query = new URLSearchParams();
    for (const key of Object.keys(params)) {
      const value = first(params[key]);
      if (value) query.set(key, value);
    }
    if (query.toString()) {
      void finish(`farm2flavour://auth/callback?${query.toString()}`);
    }

    const stop = watchAuthDeepLinks((url) => {
      if (!active) return;
      if (isAuthCallbackUrl(url)) {
        void finish(url);
        return;
      }
      if (!query.toString()) {
        router.replace('/');
      }
    });
    return () => {
      active = false;
      stop();
    };
  }, [params, router]);

  return (
    <View style={styles.screen}>
      {message ? (
        <>
          <Text style={styles.message}>{message}</Text>
          <Pressable onPress={() => router.replace('/')} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonLabel}>Back to sign-in</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: '#DDF1E3',
    gap: spacing.md,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.danger,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
