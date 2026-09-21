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
  const tone = displayPaymentTone(status);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
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
