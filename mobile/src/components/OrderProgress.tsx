import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';
import type { OrderStatusEvent } from '@/types/order';
import { formatStepTime } from '@/utils/format';

const STEPS = [
  { status: 'new', label: 'New', icon: 'bag-handle-outline' as const },
  { status: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' as const },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: 'bicycle-outline' as const, delivery: true },
  { status: 'delivered', label: 'Delivered', icon: 'home-outline' as const },
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
  compact = false,
  visual = 'default',
}: {
  status: string;
  events?: OrderStatusEvent[];
  placedAt?: string | null;
  /** Tighter stepper for confirmation and other dense layouts. */
  compact?: boolean;
  /** Confirmation-style timeline with step icons and dotted rail. */
  visual?: 'default' | 'rich';
}) {
  const rich = visual === 'rich';
  const richCompact = rich && compact;
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
          (rich || !compact) && here && step.status === 'new' && status === 'new'
            ? 'Shop will confirm soon'
            : null;
        const active = done || here;
        return (
          <View
            key={step.status}
            style={[
              styles.row,
              compact && !rich && styles.rowCompact,
              rich && !compact && styles.rowRich,
              richCompact && styles.rowRichCompact,
            ]}
          >
            <View style={[styles.rail, rich && styles.railRich, richCompact && styles.railRichCompact]}>
              <View
                style={[
                  styles.dot,
                  rich && styles.dotRich,
                  richCompact && styles.dotRichCompact,
                  !rich && done && styles.dotDone,
                  !rich && here && styles.dotCurrent,
                  rich && here && styles.dotRichCurrent,
                  richCompact && here && styles.dotRichCurrentCompact,
                  rich && done && styles.dotRichDone,
                  !rich && !done && !here && styles.dotUpcoming,
                  rich && !active && styles.dotRichUpcoming,
                  richCompact && !active && styles.dotRichUpcomingCompact,
                ]}
              >
                {rich ? (
                  done ? (
                    <Ionicons name="checkmark" size={richCompact ? 14 : 16} color={colors.primaryText} />
                  ) : 'delivery' in step && step.delivery ? (
                    <MaterialCommunityIcons
                      name="moped"
                      size={richCompact ? 14 : 16}
                      color={active ? colors.primaryText : '#A1A1AA'}
                    />
                  ) : (
                    <Ionicons
                      name={step.icon}
                      size={richCompact ? 14 : 16}
                      color={active ? colors.primaryText : '#A1A1AA'}
                    />
                  )
                ) : (
                  <>
                    {done ? <Ionicons name="checkmark" size={11} color={colors.primaryText} /> : null}
                    {here && !done ? <View style={styles.currentCore} /> : null}
                  </>
                )}
              </View>
              {last ? null : rich ? (
                <View
                  style={[
                    styles.lineDotted,
                    (allComplete || index < current) && styles.lineDottedOn,
                  ]}
                />
              ) : (
                <View style={[styles.line, (allComplete || index < current) && styles.lineOn]} />
              )}
            </View>
            <View
              style={[
                styles.copy,
                compact && !rich && styles.copyCompact,
                rich && styles.copyRich,
                richCompact && styles.copyRichCompact,
              ]}
            >
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.label,
                    styles.labelFlex,
                    done && styles.labelDone,
                    here && styles.labelCurrent,
                    here && compact && !rich && styles.labelCurrentCompact,
                    rich && here && styles.labelRichCurrent,
                    richCompact && here && styles.labelRichCurrentCompact,
                    !done && !here && styles.labelUpcoming,
                  ]}
                >
                  {step.label}
                </Text>
                {time ? (
                  <Text
                    style={[
                      styles.timeRight,
                      here && styles.timeCurrent,
                      rich && here && styles.timeRichCurrent,
                      richCompact && styles.timeRichCompact,
                    ]}
                  >
                    {time}
                  </Text>
                ) : null}
              </View>
              {hint ? <Text style={[styles.stepHint, richCompact && styles.stepHintCompact]}>{hint}</Text> : null}
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
  rowCompact: {
    minHeight: 22,
  },
  rowRich: {
    minHeight: 34,
  },
  rowRichCompact: {
    minHeight: 28,
  },
  rail: {
    width: 20,
    alignItems: 'center',
  },
  railRich: {
    width: 32,
  },
  railRichCompact: {
    width: 28,
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
  dotRich: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dotRichCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  dotRichCurrent: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.success,
    borderWidth: 0,
  },
  dotRichCurrentCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  dotRichDone: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  dotRichUpcoming: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 0,
    backgroundColor: '#F4F4F5',
    borderWidth: 0,
  },
  dotRichUpcomingCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  lineDotted: {
    flex: 1,
    width: 0,
    marginVertical: 2,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D4D4D8',
    marginLeft: 14,
    alignSelf: 'stretch',
  },
  lineDottedOn: {
    borderColor: colors.primary,
    opacity: 0.45,
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
  copyCompact: {
    paddingBottom: 1,
  },
  copyRich: {
    paddingLeft: spacing.sm,
    paddingBottom: 6,
  },
  copyRichCompact: {
    paddingBottom: 2,
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
  labelRichCurrent: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.success,
    fontWeight: '800',
  },
  labelRichCurrentCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  labelCurrentCompact: {
    fontSize: 13,
    lineHeight: 17,
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
  timeRichCurrent: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  timeRichCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  stepHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: '500',
  },
  stepHintCompact: {
    marginTop: 0,
    fontSize: 11,
    lineHeight: 14,
  },
  cancelledBox: {
    paddingVertical: 4,
  },
  cancelledLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
