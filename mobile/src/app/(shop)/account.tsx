import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTopInset } from '@/utils/safe-area';

import {
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getSelectedAddress,
  loadAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart } from '@/cart/CartContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { signOut } from '@/services/auth';
import { getCustomerProfile } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';

function formatMobile(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : value;
}

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const { clearCart, refreshOpenOrder } = useCart();
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<SavedAddress | null>(null);

  const load = useCallback(async () => {
    const user = await getSignedInUser();
    setSignedIn(Boolean(user));
    await loadAddressBook();
    if (!user) {
      setName(null);
      setMobile(null);
      setDelivery(null);
      return;
    }
    const profile = await getCustomerProfile();
    const saved = getSelectedAddress();
    const profileName = profile?.name?.trim() || '';
    const generic = !profileName || profileName.toLowerCase() === 'customer';
    setName(generic ? saved?.name?.trim() || null : profileName);
    setMobile(profile?.mobile || user.phone || saved?.mobile || null);
    setDelivery(saved);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const initial = signedIn && name?.trim() ? name.trim().charAt(0).toUpperCase() : null;
  const addressLine = delivery ? formatSavedAddressLine(delivery) : '';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: topInset + spacing.md }]}
    >
      <View style={styles.profile}>
        <View style={styles.profileGlow} pointerEvents="none" />
        <View style={styles.avatar}>
          {initial ? (
            <Text style={styles.avatarLabel}>{initial}</Text>
          ) : (
            <Ionicons name="person" size={26} color={colors.primaryText} />
          )}
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name} numberOfLines={1}>
            {signedIn ? name || 'Welcome' : 'Welcome'}
          </Text>
          {signedIn ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.phone} numberOfLines={1}>
                {formatMobile(mobile) || 'Signed in'}
              </Text>
            </View>
          ) : (
            <Text style={styles.phone} numberOfLines={2}>
              Sign in to see orders and save your profile.
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Delivery</Text>
      <Pressable
        style={({ pressed }) => [styles.delivery, pressed && styles.pressed]}
        onPress={() =>
          signedIn
            ? router.push('/checkout')
            : router.push({ pathname: '/login', params: { next: 'checkout' } })
        }
        accessibilityRole="button"
        accessibilityLabel={delivery ? 'Change delivery address' : 'Add delivery address'}
      >
        <Ionicons name="location-outline" size={20} color={colors.primary} style={styles.pin} />
        <View style={styles.deliveryBody}>
          {delivery ? (
            <>
              <Text style={styles.deliveryTitle} numberOfLines={1}>
                {formatSavedAddressLabel(delivery.label)}
                <Text style={styles.deliveryDefault}> · Default</Text>
              </Text>
              <Text style={styles.address} numberOfLines={2}>
                {addressLine}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.deliveryTitle}>No address yet</Text>
              <Text style={styles.address}>Add one at checkout.</Text>
            </>
          )}
        </View>
        <Text style={styles.change}>{delivery ? 'Change' : 'Add'}</Text>
      </Pressable>

      <View style={styles.spacer} />

      {signedIn ? (
        <Pressable
          onPress={async () => {
            await signOut();
            clearCart();
            refreshOpenOrder();
            await load();
          }}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="log-out-outline" size={17} color={colors.textMuted} />
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      ) : (
        <PrimaryButton
          label="Sign in"
          onPress={() => router.push({ pathname: '/login', params: { next: 'account' } })}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    ...shadow.md,
  },
  profileGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryText,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.primaryText,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phone: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.85)',
  },
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  delivery: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  pin: {
    marginTop: 1,
  },
  deliveryBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  deliveryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  deliveryDefault: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  address: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textMuted,
  },
  change: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    paddingTop: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  signOutButton: {
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
  },
  signOutPressed: {
    backgroundColor: colors.border,
  },
  signOut: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
