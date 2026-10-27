import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/config/theme';

export function PaymentStatusChip({
  paymentMethod,
  orderStatus,
  compact,
}: {
  paymentMethod: string;
  orderStatus: string;
  compact?: boolean;
}) {
  const paid = paymentMethod === 'cash' || paymentMethod === 'upi';
  if (paid) {
    const label = paymentMethod === 'upi' ? 'Paid · UPI' : 'Paid · Cash';
    return (
      <View style={[styles.chip, styles.chipPaid, compact && styles.chipCompact]}>
        <Ionicons name="checkmark-circle" size={compact ? 14 : 16} color={colors.success} />
        <Text style={styles.chipPaidText}>{label}</Text>
      </View>
    );
  }

  const outstanding = orderStatus === 'delivered';
  return (
    <View style={[styles.chip, outstanding ? styles.chipOutstanding : styles.chipPending, compact && styles.chipCompact]}>
      <Ionicons name="alert-circle" size={compact ? 14 : 16} color={outstanding ? colors.danger : colors.warning} />
      <Text style={outstanding ? styles.chipOutstandingText : styles.chipPendingText}>
        {outstanding ? 'Payment outstanding' : 'Payment pending'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: 8,
  },
  chipPending: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  chipOutstanding: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  chipPaid: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  chipPendingText: {
    color: colors.warning,
    fontWeight: '600',
    fontSize: 14,
  },
  chipOutstandingText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  chipPaidText: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 14,
  },
  chipCompact: {
    marginTop: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
});
