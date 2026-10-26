import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShopCatalogProvider } from '@/catalog/ShopCatalogContext';
import { OrderPushRegistration } from '@/components/OrderPushRegistration';
import { colors, radius } from '@/config/theme';
import { NotificationPermissionProvider } from '@/notifications/NotificationPermissionProvider';

function ShopTabBarButton({ children, style, accessibilityState, ...rest }: BottomTabBarButtonProps) {
  const focused = accessibilityState?.selected;
  return (
    <Pressable {...rest} style={[styles.tabButton, style]}>
      {focused ? <View style={styles.tabButtonPill} pointerEvents="none" /> : null}
      <View style={styles.tabButtonIcon}>{children}</View>
    </Pressable>
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
  const tabBarPaddingBottom = 8;

  return (
    <Tabs
      safeAreaInsets={{ top: 0, bottom: navBottom }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.tabBarInactive,
        /** Icons only — labels clash with Android 3-button / gesture nav bar. */
        tabBarShowLabel: false,
        tabBarButton: (props) => <ShopTabBarButton {...props} />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 8,
          paddingBottom: tabBarPaddingBottom,
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
          paddingVertical: 4,
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
  },
  tabButtonPill: {
    position: 'absolute',
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  tabButtonIcon: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
