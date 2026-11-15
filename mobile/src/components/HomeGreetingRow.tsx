import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';
import { getCustomerProfile } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';

function greetingPhrase(hour: number) {
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function firstNameOf(name: string | null | undefined) {
  const trimmed = name?.trim() ?? '';
  if (!trimmed || trimmed.toLowerCase() === 'customer') {
    return null;
  }
  return trimmed.split(/\s+/)[0] ?? null;
}

export function HomeGreetingRow() {
  const [firstName, setFirstName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const user = await getSignedInUser();
        if (!user) {
          if (active) {
            setFirstName(null);
          }
          return;
        }
        const profile = await getCustomerProfile();
        if (active) {
          setFirstName(firstNameOf(profile?.name));
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const hello = greetingPhrase(new Date().getHours());
  const title = firstName ? `${hello}, ${firstName}` : hello;

  return (
    <View style={styles.wrap}>
      <Text style={styles.hello} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: 2,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  hello: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
});
