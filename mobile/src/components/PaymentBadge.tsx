import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/config/theme';
import { displayPaymentStatus, displayPaymentTone, formatDisplayPayment } from '@/utils/format';

export function PaymentBadge({
  method,
  orderStatus,
  refundStatus,
}: {
  method: string;
  orderStatus?: string;
  refundStatus?: string | null;
}) {
  const status = displayPaymentStatus({
    status: orderStatus,
    payment_method: method,
    refund_status: refundStatus,
  });
  if (status === 'not_applicable') {
    return null;
  }
  const tone = displayPaymentTone(status);
  const bordered = status === 'pending';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone.bg },
        bordered && { borderWidth: 1.5, borderColor: tone.fg },
      ]}
    >
      <Text style={[styles.label, { color: tone.fg }]}>
        {formatDisplayPayment({
          status: orderStatus,
          payment_method: method,
          refund_status: refundStatus,
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
