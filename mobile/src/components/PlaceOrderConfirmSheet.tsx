import { StyleSheet, Text, View } from 'react-native';

import { AppDialog } from '@/components/AppDialog';
import { colors, radius, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';

export function PlaceOrderConfirmSheet({
  visible,
  onClose,
  onConfirm,
  totalAmount,
  itemCount,
  addressTitle,
  addressLine,
  mode = 'place',
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalAmount: number;
  itemCount: number;
  addressTitle: string;
  addressLine: string;
  mode?: 'place' | 'update';
}) {
  const isUpdate = mode === 'update';
  const title = isUpdate ? 'Update this order?' : 'Place this order?';
  const confirmLabel = isUpdate ? 'Update order' : 'Place order';
  const itemLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <AppDialog
      visible={visible}
      title={title}
      icon="bag-check"
      onClose={onClose}
      actions={[{ label: confirmLabel, onPress: onConfirm }]}
    >
      <View style={styles.summary}>
        <Text style={styles.total}>{formatPrice(totalAmount)}</Text>
        <Text style={styles.itemCount}>{itemLabel}</Text>
      </View>
      <View style={styles.delivery}>
        <Text style={styles.deliveryLabel} numberOfLines={1}>
          {addressTitle}
        </Text>
        <Text style={styles.deliveryLine} numberOfLines={2}>
          {addressLine}
        </Text>
      </View>
      <Text style={styles.paymentNote}>Pay on delivery · Cash or UPI</Text>
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  summary: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  total: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.primaryDark,
  },
  itemCount: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  delivery: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    marginBottom: spacing.sm,
  },
  deliveryLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  deliveryLine: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  paymentNote: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
