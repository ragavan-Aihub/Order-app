import { memo, useCallback } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ProductCard } from '@/components/ProductCard';
import { colors, radius } from '@/config/theme';
import type { Product } from '@/types/product';

type HomeProductGridItemProps = {
  product: Product;
  quantity: number;
  highlightFromPush: boolean;
  highlighted: boolean;
  notifyBusy: boolean;
  notifyNotified: boolean;
  onAddToCart: (product: Product, quantity?: number) => boolean;
  onDecrease: (productId: string) => void;
  onIncrease: (productId: string) => void;
  onNotifyPress?: (productId: string, productName: string) => void;
  onLayout?: (layoutY: number) => void;
};

export const HomeProductGridItem = memo(function HomeProductGridItem({
  product,
  quantity,
  highlightFromPush,
  highlighted,
  notifyBusy,
  notifyNotified,
  onAddToCart,
  onDecrease,
  onIncrease,
  onNotifyPress,
  onLayout,
}: HomeProductGridItemProps) {
  const handleAdd = useCallback(() => {
    onAddToCart(product, 1);
  }, [onAddToCart, product]);

  const handleIncrease = useCallback(() => {
    onIncrease(product.id);
  }, [onIncrease, product.id]);

  const handleDecrease = useCallback(() => {
    onDecrease(product.id);
  }, [onDecrease, product.id]);

  const handleNotify = useCallback(() => {
    onNotifyPress?.(product.id, product.name);
  }, [onNotifyPress, product.id, product.name]);

  const itemStyle: ViewStyle[] = [styles.gridItem];
  if (highlighted) {
    itemStyle.push(highlightFromPush ? styles.gridItemHighlightFromPush : styles.gridItemHighlight);
  }

  return (
    <View
      style={itemStyle}
      onLayout={
        onLayout
          ? (event) => {
              onLayout(event.nativeEvent.layout.y);
            }
          : undefined
      }
    >
      <ProductCard
        product={product}
        quantity={quantity}
        onAddToCart={handleAdd}
        onIncrease={handleIncrease}
        onDecrease={handleDecrease}
        notifyNotified={notifyNotified}
        notifyBusy={notifyBusy}
        onNotifyPress={product.available === false && onNotifyPress ? handleNotify : undefined}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  gridItem: {
    width: '50%',
    maxWidth: '50%',
    flexGrow: 0,
    padding: 4,
    alignItems: 'stretch',
  },
  gridItemHighlight: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  gridItemHighlightFromPush: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(234, 88, 12, 0.14)',
    borderWidth: 2,
    borderColor: colors.warning,
  },
});
