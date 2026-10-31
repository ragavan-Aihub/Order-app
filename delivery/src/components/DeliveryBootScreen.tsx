import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';

const CREAM = '#F7F6EF';

export function DeliveryBootScreen() {
  return (
    <View style={styles.screen}>
      <Image
        source={require('../../assets/images/brand-mark.png')}
        style={styles.mark}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.title}>Farm2Flavour</Text>
      <Text style={styles.subtitle}>Delivery</Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM,
    paddingHorizontal: spacing.lg,
  },
  mark: {
    width: 168,
    height: 168,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  spinner: {
    marginTop: spacing.lg,
  },
});
