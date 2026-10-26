import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/config/theme';

export default function DeliverLayout() {
  const { loading, profile } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Today's deliveries" }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
