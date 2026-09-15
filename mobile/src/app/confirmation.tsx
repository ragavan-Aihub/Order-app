import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, radius, spacing } from '@/config/theme';
import { getSupabaseClient } from '@/services/supabase';
import { formatOrderNumber } from '@/utils/format';

export default function ConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, orderNumber, number, status } = useLocalSearchParams<{
    id?: string;
    orderNumber?: string;
    number?: string;
    status?: string;
  }>();
  const passedNumber = [orderNumber, number].flat().find((value) => value && value !== 'undefined');
  const [displayNumber, setDisplayNumber] = useState(passedNumber ?? '');

  useEffect(() => {
    if (displayNumber || !id) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    supabase
      .from('orders')
      .select('order_number')
      .eq('id', Array.isArray(id) ? id[0] : id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.order_number != null) {
          setDisplayNumber(String(data.order_number));
        }
      });
  }, [displayNumber, id]);

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
      </View>
      <Text style={styles.title}>Order placed</Text>
      <Text style={styles.message}>We received your order. Pay when you receive it — this app does not collect payment.</Text>
      <View style={styles.card}>
        <Text style={styles.meta}>Order number</Text>
        <Text style={styles.orderNumber}>{displayNumber ? formatOrderNumber(displayNumber) : '—'}</Text>
        <StatusBadge status={status ?? 'new'} />
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="View my orders" onPress={() => router.replace('/orders')} />
        <SecondaryButton label="Continue shopping" onPress={() => router.replace('/home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  meta: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  orderNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
