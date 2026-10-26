import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthContext';
import { colors } from '@/config/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.primaryDark,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="(deliver)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
