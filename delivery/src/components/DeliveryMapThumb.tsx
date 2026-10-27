import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius } from '@/config/theme';

type Props = {
  size?: number;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Map-style preview tile (matches shop confirmation), tappable to open Maps. */
export function DeliveryMapThumb({ size = 88, onPress, style }: Props) {
  const inner = (
    <View style={[styles.mapThumb, { width: size, height: size, borderRadius: radius.sm }, style]}>
      <View style={[styles.mapRoadH, { top: size * 0.22 }]} />
      <View style={[styles.mapRoadH, styles.mapRoadHMid, { top: size * 0.48, height: 2 }]} />
      <View style={[styles.mapRoadV, { left: size * 0.38 }]} />
      <View style={[styles.mapPark, { width: size * 0.22, height: size * 0.16 }]} />
      <Ionicons
        name="location"
        size={Math.round(size * 0.28)}
        color={colors.success}
        style={[styles.mapPinIcon, { left: size * 0.32, top: size * 0.18 }]}
      />
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open in maps">
        {inner}
      </Pressable>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  mapThumb: {
    backgroundColor: '#E4EBF0',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  mapRoadH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F8FAFC',
    opacity: 0.95,
  },
  mapRoadHMid: {
    opacity: 0.75,
  },
  mapRoadV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  mapPark: {
    position: 'absolute',
    right: 4,
    top: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(134, 239, 172, 0.45)',
  },
  mapPinIcon: {
    position: 'absolute',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
