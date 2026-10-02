import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/config/theme';

const STEPS = [
  { status: 'new', label: 'Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'out_for_delivery', label: 'Out for delivery' },
  { status: 'delivered', label: 'Delivered' },
] as const;

function rank(status: string) {
  switch (status) {
    case 'confirmed':
    case 'preparing':
      return 1;
    case 'out_for_delivery':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
}

export function OrderProgress({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <View style={styles.cancelledBox}>
        <Text style={styles.cancelledLabel}>Cancelled</Text>
      </View>
    );
  }
  const current = rank(status);
  return (
    <View style={styles.list} accessibilityRole="progressbar">
      {STEPS.map((step, index) => {
        const done = index < current;
        const here = index === current;
        const last = index === STEPS.length - 1;
        return (
          <View key={step.status} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  here && styles.dotCurrent,
                  !done && !here && styles.dotUpcoming,
                ]}
              >
                {done ? <Ionicons name="checkmark" size={12} color={colors.primaryText} /> : null}
                {here ? <View style={styles.currentCore} /> : null}
              </View>
              {last ? null : <View style={[styles.line, index < current && styles.lineOn]} />}
            </View>
            <View style={styles.copy}>
              <Text
                style={[
                  styles.label,
                  done && styles.labelDone,
                  here && styles.labelCurrent,
                  !done && !here && styles.labelUpcoming,
                ]}
              >
                {step.label}
              </Text>
              {here ? <Text style={styles.now}>Current</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    minHeight: 36,
  },
  rail: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  currentCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotUpcoming: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  line: {
    flex: 1,
    width: 2,
    minHeight: 14,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  lineOn: {
    backgroundColor: colors.primary,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 10,
    paddingBottom: 10,
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    color: colors.text,
  },
  labelDone: {
    color: colors.primaryDark,
  },
  labelCurrent: {
    color: colors.primary,
    fontWeight: '800',
  },
  labelUpcoming: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  now: {
    marginTop: 1,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '800',
  },
  cancelledBox: {
    paddingVertical: 8,
  },
  cancelledLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
});
