import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/config/theme';

export function ListenGlobe({ active }: { active: boolean }) {
  const pulse = useSharedValue(0.7);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
      return;
    }
    pulse.value = withTiming(0.7, { duration: 220 });
  }, [active, pulse]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.25 + pulse.value * 0.35,
  }));
  const core = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + pulse.value * 0.15 }],
  }));

  return (
    <View style={styles.wrap} accessibilityElementsHidden>
      <Animated.View style={[styles.ring, ring]} />
      <Animated.View style={[styles.core, core]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  core: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primaryDark,
  },
});
