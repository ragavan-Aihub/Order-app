import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/config/theme';
import { displayPaymentStatus, displayPaymentTone, formatDisplayPayment } from '@/utils/format';

function paymentIconName(
  status: ReturnType<typeof displayPaymentStatus>,
): keyof typeof Ionicons.glyphMap | null {
  switch (status) {
    case 'paid':
      return 'checkmark-circle';
    case 'pending':
      return 'warning';
    case 'refund_pending':
      return 'time-outline';
    case 'refunded':
      return 'checkmark-done';
    default:
      return null;
  }
}

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
  const iconName = paymentIconName(status);
  const label = formatDisplayPayment({
    status: orderStatus,
    payment_method: method,
    refund_status: refundStatus,
  });

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone.bg },
        bordered && { borderWidth: 1.5, borderColor: tone.fg },
      ]}
    >
      {iconName ? <Ionicons name={iconName} size={14} color={tone.fg} style={styles.icon} /> : null}
      <Text style={[styles.label, { color: tone.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    flexWrap: 'nowrap',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  icon: {
    flexShrink: 0,
  },
  label: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '700',
  },
});
