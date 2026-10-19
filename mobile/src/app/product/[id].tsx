import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { useAddToCart } from '@/cart/useAddToCart';
import { CART_LIMIT_QTY, MAX_ITEM_QTY } from '@/cart/limits';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { ViewCartBar } from '@/components/ViewCartBar';
import { productNotifyCopy } from '@/copy/product-notify';
import { colors, radius, spacing } from '@/config/theme';
import { useProductNotifyInterests } from '@/hooks/useProductNotifyInterests';
import { getProductById } from '@/services/products';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

export default function ProductDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const addToCart = useAddToCart();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { isNotified, busyId, onNotifyPress } = useProductNotifyInterests();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    getProductById(id)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Product not found.</Text>
      </View>
    );
  }

  const comingSoon = product.available === false;

  const lineTotal = product.price * quantity;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: product.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageWrap}>
          <ProductImage
            uri={product.image_url}
            style={styles.image}
            dimmed={comingSoon}
            recyclingKey={product.id}
            accessibilityLabel={product.name}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          {product.description ? <Text style={styles.description}>{product.description}</Text> : null}
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
        </View>
      </ScrollView>
      {itemCount > 0 ? <ViewCartBar inline /> : null}
      {comingSoon ? (
        <View style={[styles.footer, styles.footerStack, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <Text style={styles.notifyHelper}>{productNotifyCopy.helper}</Text>
          <Pressable
            onPress={() => void onNotifyPress(product.id, product.name)}
            disabled={busyId === product.id}
            style={[styles.notifyButton, isNotified(product.id) && styles.notifyButtonOn]}
            accessibilityRole="button"
          >
            {busyId === product.id ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <Text style={[styles.notifyButtonText, isNotified(product.id) && styles.notifyButtonTextOn]}>
                {isNotified(product.id) ? productNotifyCopy.notified : productNotifyCopy.notifyMe}
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <QuantityStepper
            value={quantity}
            onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
            onIncrease={() =>
              setQuantity((value) => {
                if (value >= MAX_ITEM_QTY) {
                  Alert.alert('Order limit', CART_LIMIT_QTY);
                  return value;
                }
                return value + 1;
              })
            }
          />
          <View style={styles.footerAction}>
            <PrimaryButton
              label={`Add · ${formatPrice(lineTotal)}`}
              onPress={() => {
                addToCart(product, quantity);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.lg,
  },
  imageWrap: {
    width: '100%',
    height: 200,
    backgroundColor: '#E4E4E7',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  footerAction: {
    flex: 1,
  },
  notifyHelper: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  notifyButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  notifyButtonOn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  notifyButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  notifyButtonTextOn: {
    color: colors.primaryDark,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  empty: {
    fontSize: 18,
    color: colors.textMuted,
  },
});
