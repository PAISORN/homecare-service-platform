export const colors = {
  primary: '#1E40AF',
  action: '#2563EB',
  accent: '#EA580C',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
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
export const radii = { button: 12, card: 16, pill: 999 } as const;
export const typography = {
  family: 'Noto Sans Thai',
  bodySize: 16,
  supportSize: 14,
  sectionTitleSize: 22,
  pageTitleSize: 30,
} as const;
export const motion = { quick: 150, standard: 200 } as const;
