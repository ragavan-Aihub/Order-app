import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CartProvider } from '@/cart/CartContext';
import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { colors } from '@/config/theme';

export default function RootLayout() {
  useEffect(() => {
    loadDeliveryDraft();
  }, []);
  return (
    <SafeAreaProvider>
      <CartProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false, title: 'Login' }} />
          <Stack.Screen name="products" options={{ title: 'Products' }} />
          <Stack.Screen name="product/[id]" options={{ title: 'Product details' }} />
          <Stack.Screen name="cart" options={{ title: 'Cart' }} />
          <Stack.Screen name="checkout" options={{ title: 'Delivery details' }} />
          <Stack.Screen name="verify" options={{ title: 'Verify OTP' }} />
          <Stack.Screen name="confirmation" options={{ title: 'Order confirmation' }} />
        </Stack>
      </CartProvider>
    </SafeAreaProvider>
  );
}
