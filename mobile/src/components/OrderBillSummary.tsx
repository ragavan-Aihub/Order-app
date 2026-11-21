import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';
import type { DeliveryBreakdown } from '@/utils/delivery-charge';
import { formatPrice } from '@/utils/format';

export function OrderBillSummary({
  breakdown,
  compact = false,
  nudge,
}: {
  breakdown: DeliveryBreakdown;
  compact?: boolean;
  nudge?: string | null;
}) {
  const showDelivery = breakdown.listedCharge > 0;
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.row}>
        <Text style={styles.label}>Item total</Text>
        <Text style={styles.value}>{formatPrice(breakdown.itemsSubtotal)}</Text>
      </View>
      {showDelivery ? (
        <View style={styles.row}>
          <Text style={styles.label}>Delivery</Text>
          {breakdown.freeQualified ? (
            <View style={styles.deliveryRight}>
              <Text style={styles.struck}>{formatPrice(breakdown.listedCharge)}</Text>
              <Text style={styles.free}>Free</Text>
            </View>
          ) : (
            <Text style={styles.value}>{formatPrice(breakdown.charged)}</Text>
          )}
        </View>
      ) : null}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatPrice(breakdown.billTotal)}</Text>
      </View>
      {nudge ? <Text style={styles.nudge}>{nudge}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    paddingVertical: spacing.sm,
  },
  wrapCompact: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  deliveryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  struck: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  free: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  nudge: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#6D28D9',
    lineHeight: 18,
  },
});