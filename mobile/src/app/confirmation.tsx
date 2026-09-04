import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/config/theme';
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
      <Text style={styles.title}>Order received</Text>
      <Text style={styles.message}>Your order has been placed. Payment is not collected in the app.</Text>
      <Text style={styles.meta}>Order number</Text>
      <Text style={styles.orderNumber}>{displayNumber ? formatOrderNumber(displayNumber) : '—'}</Text>
      <Text style={styles.meta}>Status</Text>
      <Text style={styles.value}>{status ?? 'new'}</Text>
      <PrimaryButton label="Back to products" onPress={() => router.replace('/products')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  meta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  orderNumber: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
});
