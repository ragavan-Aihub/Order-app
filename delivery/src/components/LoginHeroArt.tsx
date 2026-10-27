import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/config/theme';

export function LoginHeroArt() {
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no">
      <View style={styles.glow} />
      <View style={styles.scooter}>
        <MaterialCommunityIcons name="moped" size={52} color="#4F46E5" />
        <View style={styles.rider}>
          <Ionicons name="person" size={22} color="#EA580C" />
        </View>
        <View style={styles.parcel}>
          <Ionicons name="cube" size={16} color="#CA8A04" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 4,
    height: 100,
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primarySoft,
    opacity: 0.55,
  },
  scooter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rider: {
    position: 'absolute',
    top: -6,
    left: 10,
    backgroundColor: '#FFEDD5',
    borderRadius: 12,
    padding: 2,
  },
  parcel: {
    position: 'absolute',
    bottom: 2,
    right: -4,
    backgroundColor: '#FEF9C3',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
});
