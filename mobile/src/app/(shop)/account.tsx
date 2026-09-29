import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getSelectedAddress, loadAddressBook } from '@/cart/address-book';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing } from '@/config/theme';
import { signOut } from '@/services/auth';
import { getCustomerProfile, type DeliveryDetails } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';

export default function AccountScreen() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);

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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          {initial ? (
            <Text style={styles.avatarLabel}>{initial}</Text>
          ) : (
            <Ionicons name="person" size={26} color={colors.primaryDark} />
          )}
        </View>
        <View style={styles.heroText}>
          <Text style={styles.hello}>{signedIn ? `Hello${name ? `, ${name}` : ''}` : 'Hello'}</Text>
          <Text style={styles.meta}>
            {signedIn ? mobile || 'Signed in' : 'Sign in to see orders and save your profile.'}
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.card}
        onPress={() =>
          signedIn
            ? router.push('/checkout')
            : router.push({ pathname: '/login', params: { next: 'checkout' } })
        }
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>Delivery address</Text>
        {delivery?.address ? (
          <>
            <Text style={styles.body}>{delivery.name}</Text>
            <Text style={styles.body}>{delivery.address}</Text>
            <Text style={styles.body}>
              {delivery.pincode} · {delivery.mobile}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>No address yet. Add one at checkout.</Text>
        )}
        <Text style={styles.rowHint}>Manage</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          signedIn ? router.push('/orders') : router.push({ pathname: '/login', params: { next: 'orders' } })
        }
        style={styles.row}
        accessibilityRole="button"
      >
        <View style={styles.rowLeft}>
          <Ionicons name="receipt-outline" size={22} color={colors.primary} />
          <Text style={styles.rowLabel}>My orders</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      {signedIn ? (
        <Pressable
          onPress={async () => {
            await signOut();
            await load();
          }}
          accessibilityRole="button"
        >
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
  content: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  hello: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  rowHint: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  signOut: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
    paddingVertical: spacing.sm,
  },
});
