export const colors = {
  /** Warm stone canvas — visible behind white cards (order detail, lists). */
  background: '#F5F5F4',
  surface: '#FFFFFF',
  /** Inset sections inside grouped cards — breaks up large white fields. */
  surfaceInset: '#F0FDFA',
  text: '#18181B',
  textMuted: '#71717A',
  /** Bottom tab labels/icons when not selected — darker than textMuted for readability. */
  tabBarInactive: '#52525B',
  primary: '#0F766E',
  primaryDark: '#115E59',
  primarySoft: '#CCFBF1',
  /** Subtle brand wash for grouped sections (cart footer, highlights). */
  canvasTint: '#F0FDFA',
  primaryText: '#FFFFFF',
  border: '#E7E5E4',
  success: '#15803D',
  danger: '#B91C1C',
  warning: '#C2410C',
  info: '#1D4ED8',
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#115E59',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0F766E',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;
