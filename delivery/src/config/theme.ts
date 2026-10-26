export const colors = {
  background: '#F5F5F4',
  surface: '#FFFFFF',
  text: '#18181B',
  textMuted: '#71717A',
  primary: '#0F766E',
  primaryDark: '#115E59',
  primarySoft: '#CCFBF1',
  border: '#E7E5E4',
  success: '#15803D',
  danger: '#B91C1C',
  warning: '#C2410C',
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  pill: 999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#115E59',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
