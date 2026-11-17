import { memo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { ProductCard } from '@/components/ProductCard';
import { colors, radius } from '@/config/theme';
import { usePendingNav } from '@/hooks/usePendingNav';
import type { Product } from '@/types/product';
import { sellingTypeOf } from '@/utils/selling-units';

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
  favorited?: boolean;
  favoriteBusy?: boolean;
  onFavoritePress?: (productId: string) => void;
  rail?: boolean;
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
  favorited = false,
  favoriteBusy = false,
  onFavoritePress,
  rail = false,
  onLayout,
}: HomeProductGridItemProps) {
  const router = useRouter();
  const { pending, runPendingNav } = usePendingNav();
  const needsDetails = sellingTypeOf(product) !== 'quantity';

  const openProduct = useCallback(() => {
    runPendingNav(() => {
      router.push({ pathname: '/product/[id]', params: { id: product.id } });
    }, product.id);
  }, [product.id, router, runPendingNav]);

  const handleAdd = useCallback(() => {
    if (needsDetails) {
      openProduct();
      return;
    }
    onAddToCart(product, 1);
  }, [needsDetails, onAddToCart, openProduct, product]);

  const handleIncrease = useCallback(() => {
    onIncrease(product.id);
  }, [onIncrease, product.id]);

  const handleDecrease = useCallback(() => {
    onDecrease(product.id);
  }, [onDecrease, product.id]);

  const handleNotify = useCallback(() => {
    onNotifyPress?.(product.id, product.name);
  }, [onNotifyPress, product.id, product.name]);

  const itemStyle: ViewStyle[] = [rail ? styles.railItem : styles.gridItem];
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
        quantity={needsDetails ? 0 : quantity}
        compact={rail}
        onPress={openProduct}
        onAddToCart={handleAdd}
        onIncrease={handleIncrease}
        onDecrease={handleDecrease}
        notifyNotified={notifyNotified}
        notifyBusy={notifyBusy}
        onNotifyPress={product.available === false && onNotifyPress ? handleNotify : undefined}
        favorited={favorited}
        favoriteBusy={favoriteBusy}
        onFavoritePress={onFavoritePress ? () => onFavoritePress(product.id) : undefined}
      />
      {pending ? (
        <View style={styles.pendingOverlay} pointerEvents="none" accessibilityLabel="Opening product">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
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
  railItem: {
    width: '100%',
    flexGrow: 0,
    padding: 0,
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
  pendingOverlay: {
    ...StyleSheet.absoluteFill,
    margin: 4,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
});
