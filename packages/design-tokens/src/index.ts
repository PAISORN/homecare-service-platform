export const colors = {
  primary: '#075E5A',
  action: '#087F76',
  accent: '#D97745',
  background: '#F7F4EC',
  surface: '#FFFEFB',
  surfaceMuted: '#F1EEE6',
  text: '#10233B',
  textMuted: '#66758A',
  border: '#E8E3D9',
  mint: '#DFF2EC',
  sky: '#E4F1F9',
  blush: '#F7E6DC',
  shadow: '#123B3A',
  success: '#15803D',
  warning: '#B45309',
  danger: '#DC2626',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
export const radii = {
  button: 16,
  card: 20,
  navigation: 28,
  pill: 999,
} as const;
export const typography = {
  family: 'Noto Sans Thai',
  bodySize: 16,
  supportSize: 14,
  sectionTitleSize: 22,
  pageTitleSize: 30,
} as const;
export const motion = { quick: 150, standard: 200 } as const;
