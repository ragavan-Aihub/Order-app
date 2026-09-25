import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ViewCartBar, VIEW_CART_BAR_SPACE } from '@/components/ViewCartBar';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { getReorderOrders } from '@/services/orders';
import { getAvailableProducts } from '@/services/products';
import { getSignedInUser } from '@/services/supabase';
import type { OrderWithItems } from '@/types/order';
import type { Product } from '@/types/product';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export default function ReorderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, itemCount } = useCart();
  const { offline } = useNetworkStatus();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    try {
      const user = await getSignedInUser();
      setSignedIn(Boolean(user));
      if (!user) {
        setOrders([]);
        return;
      }
      const [rows, products] = await Promise.all([getReorderOrders(), getAvailableProducts()]);
      setOrders(rows);
      setCatalog(products);
    } catch {
      setSignedIn(false);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  function reorder(order: OrderWithItems) {
    const available = new Map(catalog.map((product) => [product.id, product]));
    let added = 0;
    let skipped = 0;
    for (const item of order.order_items) {
      const product = item.product_id ? available.get(item.product_id) : undefined;
      if (!product) {
        skipped += 1;
        continue;
      }
      addItem(product, item.quantity);
      added += 1;
    }
    if (added === 0) {
      setNotice('Those items are no longer available. Browse Home for what’s in stock.');
      return;
    }
    setNotice(
      skipped > 0
        ? `Added ${added}. ${skipped} ${skipped === 1 ? 'item is' : 'items are'} no longer available.`
        : `Added ${added} ${added === 1 ? 'item' : 'items'} to your cart.`,
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <EmptyState
        title="Reorder"
        message="Sign in to quickly order from what you bought before."
        actionLabel="Sign in"
        onAction={() => router.push({ pathname: '/login', params: { next: 'reorder' } })}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom:
              (itemCount > 0 ? VIEW_CART_BAR_SPACE : spacing.lg) + Math.max(insets.bottom, spacing.md),
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <Text style={styles.title}>Reorder</Text>
        {offline ? <OfflineBanner /> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {orders.length === 0 ? (
          <Text style={styles.empty}>
            {offline
              ? 'Connect to the internet to load orders you can reorder.'
              : 'You have not placed an order yet. Shop from Home, then reorder it here in one tap.'}
          </Text>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.card}>
              <Text style={styles.number}>{formatOrderNumber(order.order_number)}</Text>
              <Text style={styles.meta}>{formatDateTime(order.created_at)}</Text>
              <Text style={styles.items} numberOfLines={3}>
                {order.order_items.map((item) => `${item.product_name} × ${item.quantity}`).join(', ')}
              </Text>
              <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
              <Pressable
                onPress={() => reorder(order)}
                style={styles.button}
                accessibilityRole="button"
              >
                <Text style={styles.buttonLabel}>Reorder</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
      <ViewCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  empty: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  notice: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  number: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  items: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  button: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
});
