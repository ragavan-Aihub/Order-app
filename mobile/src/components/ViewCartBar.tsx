import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCart } from '@/cart/CartContext';
import { colors, radius, spacing } from '@/config/theme';

export function ViewCartBar({
  inline = false,
}: {
  inline?: boolean;
}) {
  const router = useRouter();
  const { itemCount } = useCart();

  if (itemCount <= 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={inline ? styles.inlineWrap : styles.wrap}>
      <Pressable
        onPress={() => router.push('/cart')}
        style={styles.bar}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
      >
        <Ionicons name="bag-handle" size={16} color={colors.primaryText} />
        <Text style={styles.title}>View cart</Text>
        <Text style={styles.meta}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
      </Pressable>
    </View>
  );
}

export const VIEW_CART_BAR_SPACE = 56;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.sm,
    alignItems: 'center',
  },
  inlineWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  bar: {
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    shadowColor: '#115E59',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  title: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  meta: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
});
