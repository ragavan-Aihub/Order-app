import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getSelectedAddress,
  loadAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          {initial ? (
            <Text style={styles.avatarLabel}>{initial}</Text>
          ) : (
            <Ionicons name="person" size={26} color={colors.primaryText} />
          )}
        </View>
        <View style={styles.heroText}>
          {signedIn && name ? <Text style={styles.greeting}>Hello,</Text> : null}
          <Text style={styles.hello} numberOfLines={1}>
            {signedIn && name ? name : 'Hello'}
          </Text>
          <Text style={styles.heroMeta} numberOfLines={signedIn ? 1 : 2}>
            {signedIn ? formatMobile(mobile) || 'Signed in' : 'Sign in to see orders and save your profile.'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Delivery</Text>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() =>
          signedIn
            ? router.push('/checkout')
            : router.push({ pathname: '/login', params: { next: 'checkout' } })
        }
        accessibilityRole="button"
        accessibilityLabel={delivery ? 'Change delivery address' : 'Add delivery address'}
      >
        <View style={styles.iconTile}>
          <Ionicons name="location" size={20} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          {delivery ? (
            <>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{formatSavedAddressLabel(delivery.label)}</Text>
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillLabel}>Default</Text>
                </View>
              </View>
              <Text style={styles.body} numberOfLines={2}>
                {addressLine}
              </Text>
              {delivery.name ? (
                <Text style={styles.subtle} numberOfLines={1}>
                  {delivery.name}
                  {delivery.mobile ? ` · ${delivery.mobile}` : ''}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Delivery address</Text>
              <Text style={styles.subtle}>No address yet. Add one at checkout.</Text>
            </>
          )}
        </View>
        <Text style={styles.manage}>{delivery ? 'Change' : 'Add'}</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Orders</Text>
      <View style={styles.group}>
        <Pressable
          onPress={() =>
            signedIn ? router.push('/orders') : router.push({ pathname: '/login', params: { next: 'orders' } })
          }
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.iconTile}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>My orders</Text>
            <Text style={styles.subtle}>Track, view items, or cancel</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {signedIn ? (
        <Pressable
          onPress={async () => {
            await signOut();
            await load();
          }}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
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
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    marginBottom: spacing.xs,
    ...shadow.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryText,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
  hello: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.primaryText,
  },
  heroMeta: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  defaultPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  defaultPillLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  subtle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  manage: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    paddingTop: 1,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  signOutButton: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  signOut: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
  pressed: {
    opacity: 0.85,
  },
});
