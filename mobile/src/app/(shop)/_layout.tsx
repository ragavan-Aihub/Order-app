import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { ShopCatalogProvider, useShopCatalog } from '@/catalog/ShopCatalogContext';
import { colors } from '@/config/theme';

export const unstable_settings = {
  initialRouteName: 'home',
};

function ShopTabs() {
  const { categoriesEnabled } = useShopCatalog();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          headerShown: false,
          href: categoriesEnabled ? '/categories' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'My orders',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reorder"
        options={{
          title: 'Reorder',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="refresh-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          href: null,
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

export default function ShopTabsLayout() {
  return (
    <ShopCatalogProvider>
      <ShopTabs />
    </ShopCatalogProvider>
  );
}
