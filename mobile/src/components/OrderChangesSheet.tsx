import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/config/theme';
import { diffOrderModification } from '@/order-modifications/diff';
import type { OrderModification } from '@/types/order';
import { formatPrice } from '@/utils/format';

export function OrderChangesSheet({
  visible,
  modification,
  onClose,
}: {
  visible: boolean;
  modification: OrderModification | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!modification) {
    return null;
  }

  const changes = diffOrderModification(modification);
  const totalDelta = modification.new_total - modification.previous_total;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>What changed</Text>
          <Text style={styles.subtitle}>The shop updated items on this order.</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {changes.length === 0 ? (
              <Text style={styles.empty}>Items were updated. Review the list below your order.</Text>
            ) : (
              changes.map((change, index) => (
                <View key={`${change.kind}-${change.name}-${index}`} style={styles.changeRow}>
                  <Text style={styles.changeText}>
                    {change.kind === 'added'
                      ? `Added ${change.name} × ${change.quantity}`
                      : change.kind === 'removed'
                        ? `Removed ${change.name} × ${change.quantity}`
                        : `${change.name}: ${change.from} → ${change.to}`}
                  </Text>
                </View>
              ))
            )}

            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>Order total</Text>
              <Text style={styles.totalLine}>
                {formatPrice(modification.previous_total)} → {formatPrice(modification.new_total)}
              </Text>
              {totalDelta !== 0 ? (
                <Text style={styles.totalHint}>
                  {totalDelta > 0
                    ? `Total increased by ${formatPrice(totalDelta)}. Pay on delivery as agreed with the shop.`
                    : `Total decreased by ${formatPrice(Math.abs(totalDelta))}.`}
                </Text>
              ) : null}
            </View>

            {modification.reason ? (
              <View style={styles.reasonBlock}>
                <Text style={styles.reasonLabel}>Note from shop</Text>
                <Text style={styles.reasonText}>{modification.reason}</Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  scroll: {
    maxHeight: 320,
  },
  scrollContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  changeRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  changeText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    fontWeight: '500',
  },
  totalBlock: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    gap: 4,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  totalLine: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  totalHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  reasonBlock: {
    marginTop: spacing.sm,
    gap: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  doneBtn: {
    marginTop: spacing.sm,
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  doneLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
