import { StyleSheet } from 'react-native';

import {
  ACCENTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
  MOTION,
  RADIUS,
  SPACE,
  THEMES,
  type AccentColors,
  type AccentName,
  type ThemeColors,
  type ThemeName,
} from '@lexipulse/ui/tokens';

/**
 * The design tokens, translated for React Native.
 *
 * `@lexipulse/ui/tokens` is deliberately plain data — the web app turns it into CSS
 * variables, here it becomes numbers. Importing the subpath rather than the package root
 * matters: the root also exports the web components, and those touch the DOM.
 */
export type { AccentName, ThemeName };

export interface Theme {
  name: ThemeName;
  accentName: AccentName;
  colors: ThemeColors;
  accent: AccentColors;
  /** True when the theme wants light status-bar content. */
  dark: boolean;
  space: typeof SPACING;
  radius: typeof RADII;
  font: typeof FONTS;
  hairline: number;
}

/** The 4 px grid from the token file, as numbers. */
const SPACING = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

const RADII = {
  sm: Number.parseInt(RADIUS.sm, 10),
  md: Number.parseInt(RADIUS.md, 10),
  lg: Number.parseInt(RADIUS.lg, 10),
  xl: Number.parseInt(RADIUS.xl, 10),
  full: 9999,
} as const;

/**
 * Font family names. These are the keys `useFonts()` registers, so they are stable on
 * both platforms — see the note in app.config.ts about why the family name is not left to
 * native font embedding.
 */
export const MONO_REGULAR = 'JetBrainsMono';
export const MONO_BOLD = 'JetBrainsMono-Bold';

const FONTS = {
  size: FONT_SIZE,
  weight: FONT_WEIGHT,
  lineHeight: LINE_HEIGHT,
  mono: MONO_REGULAR,
  monoBold: MONO_BOLD,
} as const;

export function buildTheme(name: ThemeName, accentName: AccentName): Theme {
  const colors = THEMES[name];
  return {
    name,
    accentName,
    colors,
    accent: ACCENTS[accentName],
    dark: colors.scheme === 'dark',
    space: SPACING,
    radius: RADII,
    font: FONTS,
    hairline: StyleSheet.hairlineWidth,
  };
}

/** Animation timings, in the shape Reanimated wants. */
export const DURATION = MOTION.duration;

export { SPACE };
