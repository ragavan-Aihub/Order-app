import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function QuantityStepper({ value, onDecrease, onIncrease }: QuantityStepperProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onDecrease} style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonLabel}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable onPress={onIncrease} style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
});
