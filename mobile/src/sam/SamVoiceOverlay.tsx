import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/config/theme';

const ORB = 132;

export function SamVoiceOverlay({
  volume,
  heard,
  bottomInset,
  onCancel,
  onDone,
}: {
  volume: Animated.Value;
  heard: string;
  bottomInset: number;
  onCancel: () => void;
  onDone: () => void;
}) {
  const appear = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [appear, breath]);

  const motion = useMemo(() => {
    const level = Animated.add(Animated.multiply(breath, 0.2), volume);
    const range = { inputRange: [0, 1.2], extrapolate: 'clamp' as const };
    return {
      core: level.interpolate({ ...range, outputRange: [1, 1.1] }),
      inner: level.interpolate({ ...range, outputRange: [1.06, 1.3] }),
      innerOpacity: level.interpolate({ ...range, outputRange: [0.28, 0.5] }),
      outer: level.interpolate({ ...range, outputRange: [1.12, 1.6] }),
      outerOpacity: level.interpolate({ ...range, outputRange: [0.1, 0.28] }),
    };
  }, [breath, volume]);

  return (
    <Animated.View style={[styles.screen, { opacity: appear }]} accessibilityViewIsModal>
      <Text style={styles.kicker}>Listening</Text>

      <View style={styles.center}>
        <View style={styles.orbBox}>
          <Animated.View
            style={[styles.halo, { opacity: motion.outerOpacity, transform: [{ scale: motion.outer }] }]}
          />
          <Animated.View
            style={[styles.halo, { opacity: motion.innerOpacity, transform: [{ scale: motion.inner }] }]}
          />
          <Animated.View style={[styles.core, { transform: [{ scale: motion.core }] }]}>
            <View style={styles.coreShine} />
          </Animated.View>
        </View>
        <Text
          style={heard ? styles.heard : styles.placeholder}
          numberOfLines={4}
          accessibilityLiveRegion="polite"
        >
          {heard || 'Go ahead, I’m listening…'}
        </Text>
        <Text style={styles.hint}>I’ll send it when you pause</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: bottomInset + spacing.lg }]}>
        <View style={styles.control}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.round, styles.roundQuiet, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Cancel listening"
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.controlLabel}>Cancel</Text>
        </View>
        <View style={styles.control}>
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.round, styles.roundPrimary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Send now"
          >
            <Ionicons name="arrow-up" size={28} color={colors.primaryText} />
          </Pressable>
          <Text style={styles.controlLabel}>Send now</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingTop: 72,
  },
  kicker: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  orbBox: {
    width: ORB * 1.7,
    height: ORB * 1.7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  halo: {
    position: 'absolute',
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: colors.primary,
  },
  core: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  coreShine: {
    position: 'absolute',
    top: ORB * 0.12,
    left: ORB * 0.18,
    width: ORB * 0.42,
    height: ORB * 0.3,
    borderRadius: ORB,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heard: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  placeholder: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.textMuted,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: spacing.md,
  },
  control: {
    alignItems: 'center',
    gap: 6,
  },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundQuiet: {
    backgroundColor: colors.background,
  },
  roundPrimary: {
    backgroundColor: colors.primary,
  },
  controlLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.75,
  },
});
