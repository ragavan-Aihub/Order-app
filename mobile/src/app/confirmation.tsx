import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrderProgress } from '@/components/OrderProgress';
import { PaymentBadge } from '@/components/PaymentBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, radius, spacing } from '@/config/theme';
import { getSupabaseClient } from '@/services/supabase';
import { formatOrderNumber } from '@/utils/format';

export default function ConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, orderNumber, number, status, payment } = useLocalSearchParams<{
    id?: string;
    orderNumber?: string;
    number?: string;
    status?: string;
    payment?: string;
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
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        </View>
        <Text style={styles.title}>Order placed</Text>
        <Text style={styles.message}>
          We received your order. Pay when you receive it — this app does not collect payment.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.meta}>Order number</Text>
        <Text style={styles.orderNumber}>{displayNumber ? formatOrderNumber(displayNumber) : '—'}</Text>
        <View style={styles.divider} />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Status</Text>
          <StatusBadge status={Array.isArray(status) ? status[0] : status ?? 'new'} />
        </View>
        <OrderProgress status={Array.isArray(status) ? status[0] : status ?? 'new'} />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Payment</Text>
          <PaymentBadge method={Array.isArray(payment) ? payment[0] : payment ?? 'pending'} />
        </View>
      </View>
      <View style={styles.spacer} />
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  orderNumber: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
