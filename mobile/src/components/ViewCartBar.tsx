import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { useCart } from '@/cart/CartContext';
import { colors, radius, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';
import { hapticTap } from '@/utils/haptics';

/** Matches shop tab bar content height (icons only; labels hidden on Android). */
export const SHOP_TAB_BAR_HEIGHT = 52;

/** Distance from tab scene bottom to pill bottom (scene ends above tab bar). */
export const CART_BOTTOM_INSET = 12;

export const FLOATING_CART_BAR_HEIGHT = 44;

export function viewCartScrollPadding(_bottomInset: number, hasCart: boolean) {
  if (!hasCart) {
    return spacing.md;
  }
  return CART_BOTTOM_INSET + FLOATING_CART_BAR_HEIGHT + spacing.lg;
}

/** @deprecated Use viewCartScrollPadding with safe-area bottom inset. */
export const VIEW_CART_BAR_SPACE = CART_BOTTOM_INSET + FLOATING_CART_BAR_HEIGHT + spacing.md;

export function ViewCartBar({
  inline = false,
}: {
  inline?: boolean;
}) {
  const router = useRouter();
  const { itemCount, totalAmount } = useCart();

  if (itemCount <= 0) {
    return null;
  }

  const amountLabel = formatPrice(totalAmount);
  const itemLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      pointerEvents="box-none"
      style={[inline ? styles.inlineWrap : styles.wrap]}
    >
      <Pressable
        onPress={() => {
          hapticTap();
          router.push('/cart');
        }}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${amountLabel}, ${itemLabel}`}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="bag-handle" size={18} color={colors.primaryText} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
          </View>
        </View>
        <Text style={styles.itemLabel}>{itemLabel}</Text>
        <View style={styles.dot} />
        <Text style={styles.amount} numberOfLines={1}>
          {amountLabel}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: CART_BOTTOM_INSET,
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  inlineWrap: {
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  pill: {
    height: FLOATING_CART_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: '#115E59',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillPressed: {
    opacity: 0.92,
    backgroundColor: colors.primaryDark,
  },
  iconWrap: {
    width: 22,
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  itemLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  amount: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
});
