import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useCart } from '@/cart/CartContext';
import { goModifyOrder } from '@/cart/modify-flow';
import { colors, radius, spacing } from '@/config/theme';
import { formatOrderNumber } from '@/utils/format';

export function ModifyOrderBar({
  variant,
  onExit,
  style,
}: {
  variant: 'cart' | 'shop';
  onExit?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { openOrder, editingOrderId, hasOrderChanges, revertEditChanges, clearCart, beginEditOrder } = useCart();

  if (!openOrder || editingOrderId !== openOrder.id) {
    return null;
  }
  const order = openOrder;
  const leave = onExit ?? clearCart;

  function confirmDiscard() {
    Alert.alert('Discard changes?', 'Your order goes back to how it was saved. You can keep modifying it.', [
      { text: 'Keep changes', style: 'cancel' },
      {
        text: 'Discard changes',
        style: 'destructive',
        onPress: () => {
          if (!revertEditChanges()) {
            goModifyOrder(order, beginEditOrder, { skipConfirm: true });
          }
        },
      },
    ]);
  }

  function confirmExit() {
    if (!hasOrderChanges) {
      leave();
      return;
    }
    Alert.alert('Leave without saving?', 'Your order stays as it was.', [
      { text: 'Keep modifying', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: leave },
    ]);
  }

  return (
    <View style={[styles.bar, style]}>
      <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          Modifying order #{formatOrderNumber(order.order_number)}
        </Text>
        {variant === 'shop' ? (
          <Text style={styles.hint} numberOfLines={1}>
            Items you add go into this order
          </Text>
        ) : null}
      </View>
      {variant === 'cart' && hasOrderChanges ? (
        <Pressable
          onPress={confirmDiscard}
          style={({ pressed }) => [styles.pill, styles.pillDanger, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Discard changes"
          hitSlop={4}
        >
          <Ionicons name="arrow-undo-outline" size={15} color={colors.danger} />
          <Text style={[styles.pillLabel, styles.pillDangerLabel]}>Discard</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={confirmExit}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Exit modify order"
        hitSlop={4}
      >
        <Ionicons name="close" size={15} color={colors.text} />
        <Text style={styles.pillLabel}>Exit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  hint: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    opacity: 0.85,
  },
  pill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pillDanger: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  pillDangerLabel: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.88,
  },
});
