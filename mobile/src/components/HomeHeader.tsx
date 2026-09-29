import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getSelectedAddress,
  loadAddressBook,
  subscribeAddressBook,
} from '@/cart/address-book';
import { colors, spacing } from '@/config/theme';
import { getCustomerProfile } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';

export function HomeHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [addressLine, setAddressLine] = useState('Add a delivery address');
  const [label, setLabel] = useState('Home');
  const [initial, setInitial] = useState<string | null>(null);

  const load = useCallback(async () => {
    await loadAddressBook();
    const selected = getSelectedAddress();
    if (selected) {
      setLabel(formatSavedAddressLabel(selected.label));
      setAddressLine(formatSavedAddressLine(selected));
    } else {
      setLabel('Deliver to');
      setAddressLine('Add a delivery address');
    }

    const user = await getSignedInUser();
    if (!user) {
      setInitial(null);
      return;
    }
    const profile = await getCustomerProfile();
    const name = profile?.name?.trim() || '';
    const generic = !name || name.toLowerCase() === 'customer';
    setInitial(generic ? null : name.charAt(0).toUpperCase());
  }, []);

  useEffect(() => subscribeAddressBook(() => {
    load().catch(() => undefined);
  }), [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  return (
    <View style={[styles.band, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        style={styles.address}
        onPress={() => router.push('/checkout')}
        accessibilityRole="button"
        accessibilityLabel="Choose delivery address"
      >
        <Text style={styles.kicker}>{label.toUpperCase()}</Text>
        <View style={styles.addressRow}>
          <Text style={styles.addressValue} numberOfLines={1}>
            {addressLine}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.primaryDark} />
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push('/account')}
        style={styles.avatar}
        accessibilityRole="button"
        accessibilityLabel="Account"
      >
        {initial ? (
          <Text style={styles.avatarLabel}>{initial}</Text>
        ) : (
          <Ionicons name="person" size={20} color={colors.primaryText} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  address: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.primaryDark,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
});
