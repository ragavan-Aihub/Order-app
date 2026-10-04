import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';
import type { OrderStatusEvent } from '@/types/order';
import { formatStepTime } from '@/utils/format';

const STEPS = [
  { status: 'new', label: 'Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'out_for_delivery', label: 'Out for delivery' },
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
  const stepTime = (index: number) => {
    if (index > current) {
      return null;
    }
    const step = STEPS[index].status;
    const at = index === 0 ? placedAt || latestStatusTime(events, step) : latestStatusTime(events, step);
    return at ? formatStepTime(at) || null : null;
  };
  return (
    <View style={styles.list} accessibilityRole="progressbar">
      {STEPS.map((step, index) => {
        const done = index < current;
        const here = index === current;
        const last = index === STEPS.length - 1;
        const time = stepTime(index);
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
              <View style={styles.labelRow}>
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
                {here ? (
                  <View style={styles.nowPill}>
                    <Text style={styles.now}>Current</Text>
                  </View>
                ) : null}
              </View>
              {time ? <Text style={styles.time}>{time}</Text> : null}
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
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  currentCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotUpcoming: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    color: colors.text,
  },
  labelDone: {
    color: colors.text,
    fontWeight: '600',
  },
  labelCurrent: {
    fontSize: 15,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  labelUpcoming: {
    color: '#A1A1AA',
    fontWeight: '500',
  },
  nowPill: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  now: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  time: {
    marginTop: 1,
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
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
