import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const isUpdate = mode === 'update';
  const title = isUpdate ? 'Update this order?' : 'Place this order?';
  const confirmLabel = isUpdate ? 'Update order' : 'Place order';
  const itemLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.total}>{formatPrice(totalAmount)}</Text>
            <Text style={styles.itemCount}>{itemLabel}</Text>
          </View>

          <View style={styles.deliveryBlock}>
            <Text style={styles.deliveryLabel} numberOfLines={1}>
              {addressTitle}
            </Text>
            <Text style={styles.deliveryLine} numberOfLines={2}>
              {addressLine}
            </Text>
          </View>

          <Text style={styles.paymentNote}>Pay on delivery · Cash or UPI</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.confirmPressed]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  total: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.primaryDark,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  deliveryBlock: {
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
  },
  deliveryLine: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '500',
  },
  paymentNote: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  confirmBtn: {
    flex: 1.15,
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  confirmPressed: {
    opacity: 0.92,
  },
  confirmLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryText,
  },
  pressed: {
    opacity: 0.88,
  },
});
