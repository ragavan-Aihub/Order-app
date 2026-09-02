import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';

export default function CartScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your cart is empty</Text>
      <Text style={styles.message}>
        Add a product from the catalog to start an order. Cart quantities and totals will be added
        next.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
});
