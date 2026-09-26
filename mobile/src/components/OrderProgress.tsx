import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/config/theme';

const STEPS = [
  { status: 'new', label: 'Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'delivered', label: 'Delivered' },
] as const;

function rank(status: string) {
  switch (status) {
    case 'confirmed':
      return 1;
    case 'preparing':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
}

export function OrderProgress({ status }: { status: string }) {
  const current = rank(status);
  return (
    <View style={styles.row}>
      {STEPS.map((step, index) => {
        const done = index < current;
        const here = index === current;
        const last = index === STEPS.length - 1;
        return (
          <View key={step.status} style={styles.step}>
            <View style={styles.track}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  here && styles.dotCurrent,
                  !done && !here && styles.dotUpcoming,
                ]}
              >
                {done ? <Ionicons name="checkmark" size={13} color={colors.primaryText} /> : null}
                {here ? <View style={styles.currentCore} /> : null}
              </View>
              {last ? null : <View style={[styles.line, index < current && styles.lineOn]} />}
            </View>
            <Text
              style={[
                styles.label,
                done && styles.labelDone,
                here && styles.labelCurrent,
                !done && !here && styles.labelUpcoming,
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
            {here ? <Text style={styles.now}>Current</Text> : <View style={styles.nowSpacer} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingTop: 2,
  },
  step: {
    flex: 1,
    minWidth: 0,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 3,
  },
  lineOn: {
    backgroundColor: colors.primary,
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
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
    fontSize: 10,
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  nowSpacer: {
    height: 13,
  },
});
