import { StyleSheet, View } from 'react-native';

import { colors } from '@/config/theme';

const PINS = [
  { top: '12%', left: '8%', color: colors.primary },
  { top: '22%', right: '14%', color: '#EF4444' },
  { top: '68%', left: '6%', color: '#8B5CF6' },
  { top: '78%', right: '10%', color: colors.primary },
  { top: '48%', right: '6%', color: '#F59E0B' },
] as const;

const BOXES = [
  { top: '18%', right: '22%', rotate: '12deg', tint: '#FDE68A' },
  { top: '55%', left: '12%', rotate: '-8deg', tint: '#A7F3D0' },
  { top: '72%', left: '28%', rotate: '6deg', tint: '#DDD6FE' },
  { top: '32%', left: '18%', rotate: '-14deg', tint: '#FECACA' },
] as const;

export function LoginMapBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.base} />
      {Array.from({ length: 7 }).map((_, row) => (
        <View
          key={`h-${row}`}
          style={[styles.gridLineH, { top: `${8 + row * 14}%` }]}
        />
      ))}
      {Array.from({ length: 5 }).map((_, col) => (
        <View
          key={`v-${col}`}
          style={[styles.gridLineV, { left: `${10 + col * 20}%` }]}
        />
      ))}
      <View style={[styles.route, styles.routeA]} />
      <View style={[styles.route, styles.routeB]} />
      {BOXES.map((box, index) => (
        <View
          key={`box-${index}`}
          style={[
            styles.package,
            { top: box.top, left: 'left' in box ? box.left : undefined, right: 'right' in box ? box.right : undefined, backgroundColor: box.tint, transform: [{ rotate: box.rotate }] },
          ]}
        />
      ))}
      {PINS.map((pin, index) => (
        <View
          key={`pin-${index}`}
          style={[
            styles.pin,
            {
              top: pin.top,
              left: 'left' in pin ? pin.left : undefined,
              right: 'right' in pin ? pin.right : undefined,
              backgroundColor: pin.color,
            },
          ]}
        >
          <View style={styles.pinInner} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ECFEFF',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(15, 118, 110, 0.08)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(15, 118, 110, 0.06)',
  },
  route: {
    position: 'absolute',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: 'rgba(15, 118, 110, 0.2)',
    borderRadius: 999,
  },
  routeA: {
    top: '28%',
    left: '-10%',
    width: '70%',
    height: '22%',
    transform: [{ rotate: '-8deg' }],
  },
  routeB: {
    top: '58%',
    right: '-15%',
    width: '75%',
    height: '18%',
    transform: [{ rotate: '10deg' }],
  },
  package: {
    position: 'absolute',
    width: 28,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    opacity: 0.85,
  },
  pin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  pinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
