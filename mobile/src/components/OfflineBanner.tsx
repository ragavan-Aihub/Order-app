import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';

export function OfflineBanner() {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text style={styles.text}>You're offline. Saved products stay in your cart.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.warning,
  },
});
