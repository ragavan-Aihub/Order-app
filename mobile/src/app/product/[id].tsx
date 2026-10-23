import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { fetchProductByIdLive, invalidateProductCatalogCache } from '@/services/products';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

export default function ProductDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const addToCart = useAddToCart();
  const { id: idParam, fromAvailablePush: fromPushParam } = useLocalSearchParams<{
    id: string;
    fromAvailablePush?: string;
  }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const fromAvailablePush =
    (Array.isArray(fromPushParam) ? fromPushParam[0] : fromPushParam) === '1';
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const loadedIdRef = useRef<string | null>(null);
  const { isNotified, busyId, onNotifyPress, refresh: refreshNotifyInterests } = useProductNotifyInterests();

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setLoading(false);
        return;
      }
      let active = true;
      const needsFullScreenLoader = loadedIdRef.current !== id || fromAvailablePush;
      if (needsFullScreenLoader) {
        setLoading(true);
      }
      void (async () => {
        if (fromAvailablePush) {
          invalidateProductCatalogCache();
        }
        await refreshNotifyInterests();
        try {
          const next = await fetchProductByIdLive(id);
          if (active) {
            setProduct(next);
            if (next) {
              loadedIdRef.current = id;
            }
          }
        } catch {
          if (active) {
            setProduct(null);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [fromAvailablePush, id, refreshNotifyInterests]),
  );

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
  const footerLoading = loading && fromAvailablePush;

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
          {comingSoon ? null : <Text style={styles.price}>{formatPrice(product.price)}</Text>}
        </View>
      </ScrollView>
      {itemCount > 0 ? <ViewCartBar inline /> : null}
      {footerLoading ? (
        <View style={[styles.footer, styles.footerCentered, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : comingSoon ? (
        <View style={[styles.footer, styles.footerStack, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <View style={styles.footerNotifyRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            <Pressable
              onPress={() => void onNotifyPress(product.id, product.name)}
              disabled={busyId === product.id || isNotified(product.id)}
              style={[
                styles.notifyButton,
                styles.notifyButtonInline,
                isNotified(product.id) && styles.notifyButtonOn,
                isNotified(product.id) && styles.notifyButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isNotified(product.id) }}
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
          {isNotified(product.id) ? (
            <Text style={styles.notifyHelper}>{productNotifyCopy.helper}</Text>
          ) : null}
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
  footerCentered: {
    justifyContent: 'center',
    minHeight: 72,
  },
  footerAction: {
    flex: 1,
  },
  footerNotifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  notifyHelper: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  notifyButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  notifyButtonInline: {
    minHeight: 40,
    minWidth: 120,
  },
  notifyButtonOn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  notifyButtonDisabled: {
    opacity: 0.55,
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
