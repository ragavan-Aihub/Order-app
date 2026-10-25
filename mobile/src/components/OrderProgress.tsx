import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';
import type { OrderStatusEvent } from '@/types/order';
import { formatStepTime } from '@/utils/format';

const STEPS = [
  { status: 'new', label: 'New' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'out_for_delivery', label: 'Out for Delivery' },
  { status: 'delivered', label: 'Delivered' },
] as const;

function rank(status: string) {
  switch (status) {
    case 'confirmed':
      return 1;
    case 'out_for_delivery':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
}

export function latestStatusTime(events: OrderStatusEvent[] | undefined, status: string): string | null {
  let latest: string | null = null;
  for (const event of events ?? []) {
    if (event.status === status && (!latest || event.created_at > latest)) {
      latest = event.created_at;
    }
  }
  return latest;
}

export function OrderProgress({
  status,
  events,
  placedAt,
}: {
  status: string;
  events?: OrderStatusEvent[];
  placedAt?: string | null;
}) {
  if (status === 'cancelled') {
    const cancelledAt = latestStatusTime(events, 'cancelled');
    return (
      <View style={styles.cancelledBox}>
        <Text style={styles.cancelledLabel}>Cancelled</Text>
        {cancelledAt ? <Text style={styles.time}>{formatStepTime(cancelledAt)}</Text> : null}
      </View>
    );
  }
  const current = rank(status);
  const allComplete = status === 'delivered';
  const stepTime = (index: number) => {
    if (!allComplete && index > current) {
      return null;
    }
    const step = STEPS[index].status;
    const at = index === 0 ? placedAt || latestStatusTime(events, step) : latestStatusTime(events, step);
    return at ? formatStepTime(at) || null : null;
  };
  return (
    <View style={styles.list} accessibilityRole="progressbar">
      {STEPS.map((step, index) => {
        const done = allComplete || index < current;
        const here = !allComplete && index === current;
        const last = index === STEPS.length - 1;
        const time = stepTime(index);
        const hint =
          here && step.status === 'new' && status === 'new' ? 'Shop will confirm soon' : null;
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
                {done ? <Ionicons name="checkmark" size={11} color={colors.primaryText} /> : null}
                {here && !done ? <View style={styles.currentCore} /> : null}
              </View>
              {last ? null : (
                <View style={[styles.line, (allComplete || index < current) && styles.lineOn]} />
              )}
            </View>
            <View style={styles.copy}>
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.label,
                    styles.labelFlex,
                    done && styles.labelDone,
                    here && styles.labelCurrent,
                    !done && !here && styles.labelUpcoming,
                  ]}
                >
                  {step.label}
                </Text>
                {time ? (
                  <Text style={[styles.timeRight, here && styles.timeCurrent]}>{time}</Text>
                ) : null}
              </View>
              {hint ? <Text style={styles.stepHint}>{hint}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 0,
  },
  row: {
    flexDirection: 'row',
    minHeight: 26,
  },
  rail: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  currentCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dotUpcoming: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginTop: 2,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: '#D4D4D8',
  },
  line: {
    flex: 1,
    width: 2,
    minHeight: 6,
    backgroundColor: colors.border,
    marginVertical: 0,
  },
  lineOn: {
    backgroundColor: colors.primary,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 7,
    paddingBottom: 4,
    justifyContent: 'flex-start',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    color: colors.textMuted,
  },
  labelFlex: {
    flex: 1,
    minWidth: 0,
  },
  labelDone: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  labelCurrent: {
    fontSize: 15,
    lineHeight: 19,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  labelUpcoming: {
    color: '#A1A1AA',
    fontWeight: '600',
  },
  timeRight: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  timeCurrent: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  stepHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: '500',
  },
  cancelledBox: {
    paddingVertical: 4,
  },
  cancelledLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
});
