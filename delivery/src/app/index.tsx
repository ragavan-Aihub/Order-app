import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/config/theme';
import { isSupabaseConfigured } from '@/config/env';

export default function IndexScreen() {
  const { loading, profile } = useAuth();

  if (!isSupabaseConfigured) {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (profile) {
    return <Redirect href="/(deliver)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
