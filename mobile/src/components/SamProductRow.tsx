import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, spacing } from '@/config/theme';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

type SamProductRowProps = {
  product: Product;
  onAdd: () => void;
};

export function SamProductRow({ product, onAdd }: SamProductRowProps) {
  const comingSoon = product.available === false;

  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <Text style={[styles.name, comingSoon && styles.dimmedText]} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.metaLine}>
          {formatPrice(product.price)}
          {comingSoon ? '  ·  Coming soon' : ''}
        </Text>
      </View>
      {comingSoon ? null : (
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.name}`}
        >
          <Ionicons name="add" size={16} color={colors.primaryDark} />
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      )}
    </View>
  );
}

type SamOrderLineProps = {
  product: Product;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

export function SamOrderLine({
  product,
  quantity,
  onIncrease,
  onDecrease,
  onRemove,
}: SamOrderLineProps) {
  const unit = product.price;
  const line = unit * quantity;
  return (
    <View style={styles.orderRow}>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.metaLine}>
          {quantity} × {formatPrice(unit)} = {formatPrice(line)}
        </Text>
      </View>
      <View style={styles.actions}>
        <QuantityStepper compact value={quantity} onDecrease={onDecrease} onIncrease={onIncrease} />
        <Pressable
          onPress={onRemove}
          style={styles.trash}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${product.name}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    minHeight: 52,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dimmedText: {
    color: colors.textMuted,
  },
  metaLine: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trash: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  add: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.8,
  },
});
