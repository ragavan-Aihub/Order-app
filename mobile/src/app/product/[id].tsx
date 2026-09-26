import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { ViewCartBar } from '@/components/ViewCartBar';
import { colors, spacing } from '@/config/theme';
import { getProductById } from '@/services/products';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

export default function ProductDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { addItem, itemCount } = useCart();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

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
        <Image
          source={product.image_url ? { uri: product.image_url } : undefined}
          style={[styles.image, comingSoon && styles.imageSoon]}
          contentFit="cover"
        />
        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          {product.description ? <Text style={styles.description}>{product.description}</Text> : null}
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
        </View>
      </ScrollView>
      {itemCount > 0 ? <ViewCartBar inline /> : null}
      {comingSoon ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <Text style={styles.soonBanner}>Coming soon</Text>
        </View>
      ) : (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <QuantityStepper
            value={quantity}
            onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
            onIncrease={() => setQuantity((value) => value + 1)}
          />
          <View style={styles.footerAction}>
            <PrimaryButton
              label={`Add · ${formatPrice(lineTotal)}`}
              onPress={() => {
                addItem(product, quantity);
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
  image: {
    width: '100%',
    height: 200,
    backgroundColor: colors.border,
  },
  imageSoon: {
    opacity: 0.45,
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
  footerAction: {
    flex: 1,
  },
  soonBanner: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.warning,
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
