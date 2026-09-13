import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDeliveryDraft, loadDeliveryDraft } from '@/cart/delivery-draft';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing } from '@/config/theme';
import { signOut } from '@/services/auth';
import { getCustomerProfile, getLastDeliveryDetails, type DeliveryDetails } from '@/services/orders';
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
    if (!user) {
      setName(null);
      setMobile(null);
      const draft = await loadDeliveryDraft();
      setDelivery(draft);
      return;
    }
    const [profile, last, draft] = await Promise.all([
      getCustomerProfile(),
      getLastDeliveryDetails(),
      loadDeliveryDraft(),
    ]);
    setName(profile?.name || last?.name || draft?.name || null);
    setMobile(profile?.mobile || last?.mobile || draft?.mobile || user.phone || null);
    setDelivery(
      last ??
        draft ??
        getDeliveryDraft() ??
        null,
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hello}>{signedIn ? `Hello${name ? `, ${name}` : ''}` : 'Hello'}</Text>
      {signedIn ? (
        <Text style={styles.meta}>{mobile || 'Signed in'}</Text>
      ) : (
        <Text style={styles.meta}>Sign in to see your profile and orders.</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery address</Text>
        {delivery?.address ? (
          <>
            <Text style={styles.body}>{delivery.name}</Text>
            <Text style={styles.body}>{delivery.mobile}</Text>
            <Text style={styles.body}>{delivery.address}</Text>
            <Text style={styles.body}>Pincode {delivery.pincode}</Text>
          </>
        ) : (
          <Text style={styles.meta}>No saved address yet. It is stored when you place an order.</Text>
        )}
      </View>

      <Pressable
        onPress={() =>
          signedIn ? router.push('/orders') : router.push({ pathname: '/login', params: { next: 'orders' } })
        }
        style={styles.row}
        accessibilityRole="button"
      >
        <Text style={styles.rowLabel}>My orders</Text>
        <Text style={styles.rowHint}>View</Text>
      </Pressable>

      {signedIn ? (
        <PrimaryButton
          label="Sign out"
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
        />
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
  hello: {
    fontSize: 26,
    fontWeight: '700',
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
    fontSize: 16,
    lineHeight: 24,
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
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  rowHint: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});
