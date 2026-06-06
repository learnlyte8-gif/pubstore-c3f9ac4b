// Mirrors the web design system (Cloud-White palette + Sora/Manrope).
// Hex values are HSL → hex conversions of the tokens in `src/index.css`.

import { DefaultTheme, type Theme } from '@react-navigation/native';

export const palette = {
  background: '#FFFFFF',
  foreground: '#0F172A',
  muted: '#64748B',
  mutedSurface: '#F1F5F9',
  border: '#E2E8F0',
  primary: '#3B82F6',
  primaryForeground: '#FFFFFF',
  accent: '#0EA5E9',
  ridesMint: '#10B981',
  ridesCta: '#0F172A',
  danger: '#EF4444',
  warning: '#F59E0B',
};

export const fonts = {
  display: 'Sora',
  body: 'Manrope',
  mono: 'JetBrainsMono',
};

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    card: palette.background,
    text: palette.foreground,
    border: palette.border,
    primary: palette.primary,
    notification: palette.danger,
  },
};

export const theme = {
  colors: palette,
  fonts,
  navigation: navigationTheme,
  radii: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
  spacing: (n: number) => n * 4,
};

export type AppTheme = typeof theme;
