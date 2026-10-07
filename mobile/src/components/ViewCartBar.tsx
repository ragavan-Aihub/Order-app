import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';

/** Matches shop tab bar content height (icons + labels). */
export const SHOP_TAB_BAR_HEIGHT = 56;

/** Gap between cart pill bottom edge and top of tab bar content. */
const CART_ABOVE_TAB_GAP = 0;

/** Compact corner pill height (reference-style quick access). */
export const FLOATING_CART_BAR_HEIGHT = 44;

export function viewCartScrollPadding(bottomInset: number, hasCart: boolean) {
  const tabStack = SHOP_TAB_BAR_HEIGHT + bottomInset;
  if (!hasCart) {
    return tabStack + spacing.md;
  }
  // Corner pill — minimal extra scroll; tab stack keeps controls clear of the nav bar.
  return tabStack + spacing.md;
}

/** @deprecated Use viewCartScrollPadding with safe-area bottom inset. */
export const VIEW_CART_BAR_SPACE = SHOP_TAB_BAR_HEIGHT + spacing.md;

export function ViewCartBar({
  inline = false,
}: {
  inline?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { itemCount, totalAmount } = useCart();

  /** Shop tab bar: Home | Order again | My Order — anchor cart above the third tab. */
  const myOrderTabLeft = (screenWidth / 3) * 2;
  const myOrderTabWidth = screenWidth / 3;

  if (itemCount <= 0) {
    return null;
  }

  const bottomOffset = inline
    ? undefined
    : insets.bottom + SHOP_TAB_BAR_HEIGHT + CART_ABOVE_TAB_GAP;
  const countLabel = itemCount > 99 ? '99+' : String(itemCount);

  return (
    <View
      pointerEvents="box-none"
      style={[
        inline ? styles.inlineWrap : styles.wrap,
        !inline && bottomOffset != null
          ? {
              bottom: bottomOffset,
              left: myOrderTabLeft,
              width: myOrderTabWidth,
            }
          : null,
      ]}
    >
      <Pressable
        onPress={() => router.push('/cart')}
        style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${itemCount} items, ${formatPrice(totalAmount)}`}
      >
        <Ionicons name="bag-handle" size={18} color={colors.primarySoft} />
        <Text style={styles.count}>{countLabel}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  inlineWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignSelf: 'flex-end',
  },
  bar: {
    height: FLOATING_CART_BAR_HEIGHT,
    minWidth: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 4,
    ...shadow.sm,
  },
  barPressed: {
    opacity: 0.92,
  },
  count: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'center',
  },
});
