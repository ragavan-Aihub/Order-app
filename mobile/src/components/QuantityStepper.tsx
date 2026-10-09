import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
  stretch?: boolean;
  /** Tighter control for product grid cards (28px buttons). */
  dense?: boolean;
};

export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
  compact = false,
  stretch = false,
  dense = false,
}: QuantityStepperProps) {
  const useCompact = compact || dense;
  return (
    <View style={[styles.row, useCompact && styles.rowCompact, stretch && styles.rowStretch]}>
      <Pressable
        onPress={onDecrease}
        style={[styles.button, useCompact && styles.buttonCompact, dense && styles.buttonDense]}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
      >
        <Text style={[styles.buttonLabel, useCompact && styles.buttonLabelCompact, dense && styles.buttonLabelDense]}>
          −
        </Text>
      </Pressable>
      <Text
        style={[styles.value, useCompact && styles.valueCompact, dense && styles.valueDense, stretch && styles.valueStretch]}
      >
        {value}
      </Text>
      <Pressable
        onPress={onIncrease}
        style={[styles.button, useCompact && styles.buttonCompact, dense && styles.buttonDense]}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
      >
        <Text style={[styles.buttonLabel, useCompact && styles.buttonLabelCompact, dense && styles.buttonLabelDense]}>
          +
        </Text>
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
  rowCompact: {
    gap: 0,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.28)',
    overflow: 'hidden',
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
  buttonCompact: {
    width: 30,
    height: 30,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  buttonDense: {
    width: 30,
    height: 30,
  },
  buttonLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  buttonLabelCompact: {
    fontSize: 16,
    color: colors.primaryDark,
  },
  buttonLabelDense: {
    fontSize: 15,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  valueCompact: {
    minWidth: 24,
    paddingHorizontal: 2,
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  valueDense: {
    minWidth: 22,
    fontSize: 13,
    fontWeight: '800',
  },
  rowStretch: {
    alignSelf: 'stretch',
  },
  valueStretch: {
    flex: 1,
  },
});
