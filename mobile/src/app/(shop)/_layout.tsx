import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShopCatalogProvider } from '@/catalog/ShopCatalogContext';
import { OrderPushRegistration } from '@/components/OrderPushRegistration';
import { colors, radius } from '@/config/theme';
import { NotificationPermissionProvider } from '@/notifications/NotificationPermissionProvider';

function ShopTabBarButton({ children, style, accessibilityState, ...rest }: BottomTabBarButtonProps) {
  const focused = accessibilityState?.selected;
  return (
    <Pressable {...rest} style={[styles.tabButton, style]}>
      <View style={styles.tabButtonContent}>
        {focused ? <View style={styles.tabButtonPill} pointerEvents="none" /> : null}
        {children}
      </View>
    </Pressable>
  );
}

function TabLabel({ label, color, focused }: { label: string; color: string; focused: boolean }) {
  return (
    <Text
      style={[styles.tabLabel, { color }, focused && styles.tabLabelFocused]}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
    >
      {label}
    </Text>
  );
}

export const unstable_settings = {
  initialRouteName: 'home',
};

function ShopTabs() {
  const insets = useSafeAreaInsets();
  /** Android 3-button nav often reports bottom inset 0 — reserve space so icons stay tappable. */
  const navBottom =
    insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 22 : 0;
  const tabBarPaddingBottom = Math.max(6, navBottom > 0 ? 4 : 8);

  return (
    <Tabs
      safeAreaInsets={{ top: 0, bottom: navBottom }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarButton: (props) => <ShopTabBarButton {...props} />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 4,
          paddingBottom: tabBarPaddingBottom,
          height: 62 + navBottom,
          ...Platform.select({
            ios: {
              shadowColor: '#18181B',
              shadowOpacity: 0.07,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: -4 },
            },
            default: {
              elevation: 6,
            },
          }),
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarIconStyle: { marginTop: 2, marginBottom: 0 },
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: ({ color, focused }) => <TabLabel label="Home" color={color} focused={focused} />,
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buy-again"
        options={{
          title: 'Order again',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel label="Order again" color={color} focused={focused} />
          ),
          tabBarAccessibilityLabel: 'Order again',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'repeat' : 'repeat-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarLabel: ({ color, focused }) => <TabLabel label="Orders" color={color} focused={focused} />,
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
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
      <NotificationPermissionProvider>
        <OrderPushRegistration />
        <ShopTabs />
      </NotificationPermissionProvider>
    </ShopCatalogProvider>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    paddingTop: 0,
    backgroundColor: colors.background,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  tabButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  tabButtonPill: {
    position: 'absolute',
    top: 0,
    width: 52,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
    lineHeight: 13,
  },
  tabLabelFocused: {
    fontWeight: '700',
  },
});
