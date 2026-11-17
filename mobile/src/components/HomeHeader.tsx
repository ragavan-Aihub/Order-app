import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { usePendingNav } from '@/hooks/usePendingNav';
import {
  getCustomerProfileCached,
  peekCustomerProfileCached,
} from '@/services/customer-profile';
import { fetchInboxUnreadCount } from '@/services/inbox';
import { getSignedInUser } from '@/services/supabase';

export function HomeHeader() {
  const router = useRouter();
  const topInset = useTopInset();
  const { pending, pendingKey, runPendingNav } = usePendingNav();
  const [hasAddress, setHasAddress] = useState(false);
  const [placeLabel, setPlaceLabel] = useState('Home');
  const [addressLine, setAddressLine] = useState('Add delivery address');
  const peeked = peekCustomerProfileCached();
  const peekedName = peeked?.name?.trim() || '';
  const peekedGeneric = !peekedName || peekedName.toLowerCase() === 'customer';
  const [initial, setInitial] = useState<string | null>(
    peeked && !peekedGeneric ? peekedName.charAt(0).toUpperCase() : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unread, setUnread] = useState(0);

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
      setUnread(0);
      return;
    }
    const [profile, count] = await Promise.all([getCustomerProfileCached(), fetchInboxUnreadCount()]);
    const name = profile?.name?.trim() || '';
    const generic = !name || name.toLowerCase() === 'customer';
    setInitial(generic ? null : name.charAt(0).toUpperCase());
    setUnread(count);
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
        onPress={() => {
          if (pending) {
            return;
          }
          runPendingNav(() => router.push('/notifications'), 'notifications');
        }}
        disabled={pending}
        style={({ pressed }) => [styles.bell, pressed && !pending && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ busy: pending && pendingKey === 'notifications' }}
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        {pending && pendingKey === 'notifications' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>{unread > 9 ? '9+' : String(unread)}</Text>
              </View>
            ) : null}
          </>
        )}
      </Pressable>
      <Pressable
        onPress={() => {
          if (pending) {
            return;
          }
          runPendingNav(() => router.push('/account'), 'account');
        }}
        disabled={pending}
        style={({ pressed }) => [styles.avatar, pressed && !pending && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ busy: pending && pendingKey === 'account' }}
        accessibilityLabel="Account"
      >
        {pending && pendingKey === 'account' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : initial ? (
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
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    color: colors.primaryText,
    fontSize: 9,
    fontWeight: '800',
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
