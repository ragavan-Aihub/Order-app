import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useCart } from '@/cart/CartContext';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';

/** Matches shop tab bar content height (icons only; labels hidden on Android). */
export const SHOP_TAB_BAR_HEIGHT = 52;

/** Distance from tab scene bottom to pill bottom (scene ends above tab bar). */
export const CART_BOTTOM_INSET = 6;

/** Compact corner pill height (reference-style quick access). */
export const FLOATING_CART_BAR_HEIGHT = 44;

export function viewCartScrollPadding(_bottomInset: number, hasCart: boolean) {
  if (!hasCart) {
    return spacing.md;
  }
  return CART_BOTTOM_INSET + FLOATING_CART_BAR_HEIGHT + spacing.md;
}

/** @deprecated Use viewCartScrollPadding with safe-area bottom inset. */
export const VIEW_CART_BAR_SPACE = CART_BOTTOM_INSET + FLOATING_CART_BAR_HEIGHT + spacing.md;

export function ViewCartBar({
  inline = false,
}: {
  inline?: boolean;
}) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { itemCount, totalAmount } = useCart();

  /** Shop tab bar: Home | Order again | My Order — anchor cart above the third tab. */
  const myOrderTabLeft = (screenWidth / 3) * 2;
  const myOrderTabWidth = screenWidth / 3;

  if (itemCount <= 0) {
    return null;
  }

  const bottomOffset = inline ? undefined : CART_BOTTOM_INSET;
  const amountLabel = formatPrice(totalAmount);

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
        accessibilityLabel={`View cart, ${amountLabel}, ${itemCount} items`}
      >
        <Ionicons name="bag-handle" size={18} color={colors.primaryDark} />
        <Text style={styles.amount} numberOfLines={1}>
          {amountLabel}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
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
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.2)',
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
  amount: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
