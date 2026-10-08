import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ShopCatalogProvider } from '@/catalog/ShopCatalogContext';
import { colors } from '@/config/theme';

export const unstable_settings = {
  initialRouteName: 'home',
};

function ShopTabs() {
  return (
    <Tabs
      safeAreaInsets={{ top: 0 }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.tabBarInactive,
        /** Icons only — labels clash with Android 3-button / gesture nav bar. */
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 8,
          paddingBottom: 6,
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarIconStyle: { marginTop: 0 },
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buy-again"
        options={{
          title: 'Order again',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'repeat' : 'repeat-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'My Order',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="reorder"
        options={{
          title: 'Reorder',
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          href: null,
          headerShown: false,
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

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    paddingTop: 0,
  },
});
