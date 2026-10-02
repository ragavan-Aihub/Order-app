export const colors = {
  background: '#F4F4F5',
  surface: '#FFFFFF',
  text: '#18181B',
  textMuted: '#71717A',
  primary: '#0F766E',
  primaryDark: '#115E59',
  primarySoft: '#CCFBF1',
  primaryText: '#FFFFFF',
  border: '#E4E4E7',
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
    shadowColor: '#18181B',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
