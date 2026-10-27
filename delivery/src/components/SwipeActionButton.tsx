import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors, radius } from '@/config/theme';

const THUMB = 52;
const PADDING = 4;
const COMPLETE_RATIO = 0.82;

export type SwipeActionKind = 'confirm' | 'dispatch' | 'deliver';

type Props = {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'success';
  compact?: boolean;
  actionKind?: SwipeActionKind;
};

function SwipeThumbIcon({
  kind,
  color,
  size,
}: {
  kind: SwipeActionKind;
  color: string;
  size: number;
}) {
  if (kind === 'dispatch') {
    return <MaterialCommunityIcons name="moped" size={size} color={color} />;
  }
  const name: keyof typeof Ionicons.glyphMap =
    kind === 'confirm' ? 'clipboard-outline' : 'checkmark-done';
  return <Ionicons name={name} size={size} color={color} />;
}

export function SwipeActionButton({
  label,
  onComplete,
  disabled,
  loading,
  variant = 'primary',
  compact,
  actionKind = 'dispatch',
}: Props) {
  const thumbSize = compact ? 44 : THUMB;
  const trackHeight = compact ? 48 : 56;
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const maxSlide = Math.max(0, trackWidth - thumbSize - PADDING * 2);
  const maxSlideShared = useSharedValue(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      setTrackWidth(width);
      maxSlideShared.value = Math.max(0, width - thumbSize - PADDING * 2);
    },
    [maxSlideShared, thumbSize],
  );

  const finish = useCallback(() => {
    onComplete();
    translateX.value = withSpring(0);
  }, [onComplete, translateX]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && !loading)
        .activeOffsetX(8)
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          const max = maxSlideShared.value;
          if (max <= 0) {
            return;
          }
          translateX.value = Math.min(Math.max(0, event.translationX), max);
        })
        .onEnd(() => {
          const max = maxSlideShared.value;
          if (max <= 0) {
            translateX.value = withSpring(0);
            return;
          }
          if (translateX.value >= max * COMPLETE_RATIO) {
            translateX.value = withSpring(max);
            runOnJS(finish)();
          } else {
            translateX.value = withSpring(0);
          }
        }),
    [disabled, finish, loading, maxSlideShared, translateX],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const labelStyle = useAnimatedStyle(() => {
    const max = maxSlideShared.value;
    const progress = max > 0 ? translateX.value / max : 0;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [1, 0.45, 0.15]),
    };
  });

  const hintStyle = useAnimatedStyle(() => {
    const max = maxSlideShared.value;
    const progress = max > 0 ? translateX.value / max : 0;
    return {
      opacity: interpolate(progress, [0, 0.35, 0.7], [1, 0.5, 0]),
      transform: [{ translateX: interpolate(progress, [0, 1], [0, 8]) }],
    };
  });

  const trackColor = variant === 'success' ? colors.success : colors.primary;
  const iconSize = compact ? 22 : 26;

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: trackColor, height: trackHeight },
        disabled && styles.trackDisabled,
      ]}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Swipe the handle to the right to confirm"
    >
      <Animated.Text
        style={[styles.label, compact && styles.labelCompact, labelStyle]}
        numberOfLines={1}
        pointerEvents="none"
      >
        {loading ? 'Updating…' : label}
      </Animated.Text>

      <Animated.View style={[styles.hintChevrons, hintStyle]} pointerEvents="none">
        <Ionicons name="chevron-forward" size={compact ? 14 : 16} color="rgba(255,255,255,0.55)" />
        <Ionicons name="chevron-forward" size={compact ? 14 : 16} color="rgba(255,255,255,0.7)" />
        <Ionicons name="chevron-forward" size={compact ? 14 : 16} color="rgba(255,255,255,0.85)" />
        <Ionicons name="chevron-forward" size={compact ? 14 : 16} color="#FFFFFF" />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.thumb,
            { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2 },
            thumbStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={trackColor} />
          ) : (
            <SwipeThumbIcon kind={actionKind} size={iconSize} color={trackColor} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  labelCompact: {
    fontSize: 14,
    paddingHorizontal: 48,
  },
  track: {
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: PADDING,
    overflow: 'hidden',
  },
  trackDisabled: {
    opacity: 0.55,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: THUMB + 8,
  },
  hintChevrons: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -4,
  },
  thumb: {
    position: 'absolute',
    left: PADDING,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
