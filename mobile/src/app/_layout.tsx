import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CartProvider } from '@/cart/CartContext';
import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { colors, spacing } from '@/config/theme';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={errorStyles.screen}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error.message}</Text>
      <Pressable onPress={retry} style={errorStyles.button} accessibilityRole="button">
        <Text style={errorStyles.buttonLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.danger,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  buttonLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default function RootLayout() {
  useEffect(() => {
    loadDeliveryDraft().catch(() => undefined);
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
