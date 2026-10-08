import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTopInset } from '@/utils/safe-area';

import {
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getSelectedAddress,
  loadAddressBook,
  subscribeAddressBook,
} from '@/cart/address-book';
import { AddressPickerSheet } from '@/components/AddressPickerSheet';
import { colors, spacing } from '@/config/theme';
import { getCustomerProfile } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';

export function HomeHeader() {
  const router = useRouter();
  const topInset = useTopInset();
  const [hasAddress, setHasAddress] = useState(false);
  const [placeLabel, setPlaceLabel] = useState('Home');
  const [addressLine, setAddressLine] = useState('Add delivery address');
  const [initial, setInitial] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const showSelected = useCallback(() => {
    const selected = getSelectedAddress();
    if (selected) {
      setHasAddress(true);
      setPlaceLabel(formatSavedAddressLabel(selected.label));
      setAddressLine(formatSavedAddressLine(selected));
    } else {
      setHasAddress(false);
      setPlaceLabel('Home');
      setAddressLine('Add delivery address');
    }
  }, []);

  const load = useCallback(async () => {
    await loadAddressBook();
    showSelected();

    const user = await getSignedInUser();
    if (!user) {
      setInitial(null);
      return;
    }
    const profile = await getCustomerProfile();
    const name = profile?.name?.trim() || '';
    const generic = !name || name.toLowerCase() === 'customer';
    setInitial(generic ? null : name.charAt(0).toUpperCase());
  }, [showSelected]);

  useEffect(() => subscribeAddressBook(showSelected), [showSelected]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  return (
    <View style={[styles.shell, { paddingTop: topInset + spacing.xs }]}>
      <Pressable
        style={({ pressed }) => [styles.address, pressed && styles.pressed]}
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose delivery address"
      >
        <Ionicons name="location-outline" size={17} color={colors.primary} style={styles.pin} />
        <View style={styles.copy}>
          <Text style={styles.line1} numberOfLines={1}>
            Deliver to{' '}
            {hasAddress ? <Text style={styles.line1Strong}>{placeLabel}</Text> : null}
          </Text>
          <View style={styles.line2Row}>
            <Text style={styles.line2} numberOfLines={1}>
              {addressLine}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push('/account')}
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Account"
      >
        {initial ? (
          <Text style={styles.avatarLabel}>{initial}</Text>
        ) : (
          <Ionicons name="person-outline" size={20} color={colors.primary} />
        )}
      </Pressable>
      <AddressPickerSheet
        visible={pickerOpen}
        returnTo="home"
        onClose={() => {
          setPickerOpen(false);
          showSelected();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  address: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing.xs,
  },
  pin: {
    marginTop: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  line1: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  line1Strong: {
    fontWeight: '800',
    color: colors.text,
  },
  line2Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  line2: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
});
