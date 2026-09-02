import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '@/components/ProductCard';
import { colors, spacing } from '@/config/theme';
import { getAvailableProducts } from '@/services/products';
import type { Product } from '@/types/product';

export default function ProductListScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getAvailableProducts()
      .then((items) => {
        if (isMounted) {
          setProducts(items);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Products</Text>
        <Pressable onPress={() => router.push('/cart')} accessibilityRole="button">
          <Text style={styles.link}>Cart</Text>
        </Pressable>
      </View>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onPress={() => router.push(`/product/${product.id}`)}
          onAddToCart={() => router.push('/cart')}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
