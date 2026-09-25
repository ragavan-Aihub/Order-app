import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useShopCatalog } from '@/catalog/ShopCatalogContext';
import { setHomeCategoryId } from '@/catalog/home-filter';
import { HomeHeader } from '@/components/HomeHeader';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ViewCartBar, VIEW_CART_BAR_SPACE } from '@/components/ViewCartBar';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { useCart } from '@/cart/CartContext';

export default function CategoriesScreen() {
  const router = useRouter();
  const { categories } = useShopCatalog();
  const { itemCount } = useCart();
  const { offline } = useNetworkStatus();

  function openCategory(id: string) {
    setHomeCategoryId(id);
    router.push('/home');
  }

  return (
    <View style={styles.screen}>
      <HomeHeader />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: itemCount > 0 ? VIEW_CART_BAR_SPACE + spacing.md : spacing.xl },
        ]}
      >
        {offline ? <OfflineBanner /> : null}
        <Text style={styles.title}>Categories</Text>
        {categories.length === 0 ? (
          <Text style={styles.empty}>No categories yet. Browse all products on Home.</Text>
        ) : (
          <View style={styles.grid}>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => openCategory(item.id)}
                style={styles.card}
                accessibilityRole="button"
              >
                <Text style={styles.cardName} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
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
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  empty: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  card: {
    width: '50%',
    padding: 6,
  },
  cardName: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    minHeight: 88,
    overflow: 'hidden',
  },
});
