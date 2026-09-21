import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';

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
                  (done || here) && styles.dotOn,
                  here && styles.dotCurrent,
                ]}
              >
                {done ? <Text style={styles.check}>✓</Text> : null}
              </View>
              {last ? null : <View style={[styles.line, index < current && styles.lineOn]} />}
            </View>
            <Text style={[styles.label, (done || here) && styles.labelOn]}>{step.label}</Text>
            {here ? <Text style={styles.now}>Current</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingTop: 4,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotOn: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  check: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  line: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  lineOn: {
    backgroundColor: colors.primary,
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelOn: {
    color: colors.primaryDark,
  },
  now: {
    marginTop: 2,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
});
