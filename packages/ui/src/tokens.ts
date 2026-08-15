/**
 * LexiPulse design tokens.
 *
 * Plain data, no framework: the web app turns these into CSS custom properties, the
 * native app feeds them straight into StyleSheet. One source of truth means a theme
 * cannot drift between the two products.
 *
 * The look is deliberately restrained — near-black surfaces, hairline borders, one
 * saturated accent. In a reader, every pixel of decoration competes with the word the
 * user is trying to see.
 */

export type ThemeName = 'oled' | 'graphite' | 'sepia' | 'minimal';
export type AccentName = 'coral' | 'amber' | 'cyber';

export interface ThemeColors {
  /** Page background. */
  bg: string;
  /** Raised surface: cards, sheets, the player frame. */
  surface: string;
  /** Surface one step further up: popovers, active rows. */
  surfaceHover: string;
  /** Hairline border. Never heavier than 1 px. */
  border: string;
  /** Slightly stronger border for focus rings and active states. */
  borderStrong: string;
  /** Primary reading text. */
  text: string;
  /** Secondary labels. */
  textMuted: string;
  /** Tertiary, disabled. */
  textFaint: string;
  /** Background of the RSVP stage — usually one notch darker than `surface`. */
  stage: string;
  /** The vertical focus rails above and below the ORP column. */
  rail: string;
  /** Overlay behind modals. */
  overlay: string;
  /** Colour scheme hint for form controls and scrollbars. */
  scheme: 'dark' | 'light';
}

export interface AccentColors {
  /** The ORP character and primary actions. */
  base: string;
  /** Hover / pressed. */
  strong: string;
  /** 12 % tint for badges and selected rows. */
  soft: string;
  /** Readable text colour on top of `base`. */
  on: string;
  /** Glow used sparingly on the player focus point. */
  glow: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  oled: {
    bg: '#000000',
    surface: '#0A0A0B',
    surfaceHover: '#141416',
    border: '#1C1C1F',
    borderStrong: '#2A2A2E',
    text: '#EDEDEF',
    textMuted: '#8A8A93',
    textFaint: '#55555C',
    stage: '#000000',
    rail: '#2A2A2E',
    overlay: 'rgba(0, 0, 0, 0.72)',
    scheme: 'dark',
  },
  graphite: {
    bg: '#111113',
    surface: '#18181B',
    surfaceHover: '#212125',
    border: '#27272B',
    borderStrong: '#3A3A40',
    text: '#EDEDEF',
    textMuted: '#9A9AA3',
    textFaint: '#63636B',
    stage: '#141417',
    rail: '#3A3A40',
    overlay: 'rgba(0, 0, 0, 0.66)',
    scheme: 'dark',
  },
  sepia: {
    bg: '#F4ECD8',
    surface: '#FBF5E6',
    surfaceHover: '#F0E5CB',
    border: '#E0D3B4',
    borderStrong: '#C9B894',
    text: '#3B3228',
    textMuted: '#6F6355',
    textFaint: '#9A8C79',
    stage: '#FBF5E6',
    rail: '#D6C7A6',
    overlay: 'rgba(59, 50, 40, 0.45)',
    scheme: 'light',
  },
  minimal: {
    bg: '#FFFFFF',
    surface: '#FAFAFA',
    surfaceHover: '#F2F2F3',
    border: '#E6E6E8',
    borderStrong: '#D2D2D6',
    text: '#111113',
    textMuted: '#6B6B73',
    textFaint: '#9B9BA3',
    stage: '#FFFFFF',
    rail: '#D2D2D6',
    overlay: 'rgba(17, 17, 19, 0.4)',
    scheme: 'light',
  },
};

export const ACCENTS: Record<AccentName, AccentColors> = {
  coral: {
    base: '#FF4D4D',
    strong: '#FF6B6B',
    soft: 'rgba(255, 77, 77, 0.12)',
    on: '#1A0505',
    glow: 'rgba(255, 77, 77, 0.35)',
  },
  amber: {
    base: '#FFB020',
    strong: '#FFC24D',
    soft: 'rgba(255, 176, 32, 0.12)',
    on: '#1A1200',
    glow: 'rgba(255, 176, 32, 0.35)',
  },
  cyber: {
    base: '#22E584',
    strong: '#4DEF9E',
    soft: 'rgba(34, 229, 132, 0.12)',
    on: '#03180D',
    glow: 'rgba(34, 229, 132, 0.35)',
  },
};

export const THEME_LABELS: Record<ThemeName, string> = {
  oled: 'OLED Black',
  graphite: 'Graphite',
  sepia: 'Sepia',
  minimal: 'Minimal White',
};

export const ACCENT_LABELS: Record<AccentName, string> = {
  coral: 'Coral Red',
  amber: 'Neon Amber',
  cyber: 'Cyber Green',
};

/** 4 px base grid. Everything in the product snaps to it. */
export const SPACE = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
} as const;

export const RADIUS = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
} as const;

export const FONT_STACKS = {
  /** UI text. */
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  /**
   * The player face. Monospace is not a style choice here: with a proportional face
   * every word shifts the pivot by a fraction of a character and the stream reads as
   * flicker. A fixed advance width makes the ORP column mathematically stable.
   */
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', 'IBM Plex Mono', Menlo, Consolas, monospace",
  /** Optional serif for long-form reading views. */
  serif: "'Literata', Georgia, 'Times New Roman', serif",
} as const;

/** Type scale, 1.25 ratio, in px. */
export const FONT_SIZE = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 25,
  '2xl': 31,
  '3xl': 39,
  '4xl': 49,
  '5xl': 61,
  '6xl': 76,
} as const;

export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const LINE_HEIGHT = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.55,
  relaxed: 1.7,
} as const;

/** Negative tracking on display sizes; the mono player never gets tracking. */
export const LETTER_SPACING = {
  tighter: '-0.03em',
  tight: '-0.015em',
  normal: '0em',
  wide: '0.02em',
  wider: '0.08em',
} as const;

export const SHADOW = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.24)',
  md: '0 4px 16px rgba(0, 0, 0, 0.28)',
  lg: '0 16px 48px rgba(0, 0, 0, 0.36)',
} as const;

/**
 * Motion. Short and mostly opacity/transform — a reader must never wait on an
 * animation, and nothing here may run during playback.
 */
export const MOTION = {
  duration: {
    instant: 80,
    fast: 140,
    normal: 220,
    slow: 360,
  },
  easing: {
    /** Default for entrances and layout shifts. */
    standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
    /** Exits. */
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
    /** Springy, used only on discrete controls. */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const Z = {
  base: 0,
  sticky: 10,
  header: 20,
  overlay: 40,
  modal: 50,
  toast: 60,
} as const;

/** Breakpoints in px, mobile-first. */
export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export interface ResolvedTheme {
  name: ThemeName;
  accentName: AccentName;
  colors: ThemeColors;
  accent: AccentColors;
}

export function resolveTheme(name: ThemeName, accentName: AccentName): ResolvedTheme {
  return {
    name,
    accentName,
    colors: THEMES[name],
    accent: ACCENTS[accentName],
  };
}

/** CSS custom properties for a theme — what the web app writes onto `<html>`. */
export function themeCssVars(name: ThemeName, accentName: AccentName): Record<string, string> {
  const { colors, accent } = resolveTheme(name, accentName);
  return {
    '--lx-bg': colors.bg,
    '--lx-surface': colors.surface,
    '--lx-surface-hover': colors.surfaceHover,
    '--lx-border': colors.border,
    '--lx-border-strong': colors.borderStrong,
    '--lx-text': colors.text,
    '--lx-text-muted': colors.textMuted,
    '--lx-text-faint': colors.textFaint,
    '--lx-stage': colors.stage,
    '--lx-rail': colors.rail,
    '--lx-overlay': colors.overlay,
    '--lx-accent': accent.base,
    '--lx-accent-strong': accent.strong,
    '--lx-accent-soft': accent.soft,
    '--lx-accent-on': accent.on,
    '--lx-accent-glow': accent.glow,
  };
}

/** Serialised form for a `<style>` block or an inline `style` attribute. */
export function themeCssText(name: ThemeName, accentName: AccentName): string {
  return Object.entries(themeCssVars(name, accentName))
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');
}
