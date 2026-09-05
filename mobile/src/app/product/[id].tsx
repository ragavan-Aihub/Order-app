import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, spacing } from '@/config/theme';
import { getProductById } from '@/services/products';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

export default function ProductDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
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

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
      ]}
    >
      <Image
        source={product.image_url ? { uri: product.image_url } : undefined}
        style={styles.image}
        contentFit="cover"
      />
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.description}>{product.description}</Text>
      <Text style={styles.price}>{formatPrice(product.price)}</Text>
      <QuantityStepper
        value={quantity}
        onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
        onIncrease={() => setQuantity((value) => value + 1)}
      />
      <PrimaryButton
        label="Add to Cart"
        onPress={() => {
          addItem(product, quantity);
          router.push('/cart');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
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
