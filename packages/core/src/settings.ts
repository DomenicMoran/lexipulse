import { DEFAULT_PACING, MAX_WPM, MIN_WPM, clampWpm } from './pacing.js';
import type { AccentName, FontKey, PacingMatrix, RsvpSettings, ThemeName } from './types.js';

export const THEMES: readonly ThemeName[] = ['oled', 'graphite', 'sepia', 'minimal'] as const;
export const ACCENTS: readonly AccentName[] = ['coral', 'amber', 'cyber'] as const;
export const FONTS: readonly FontKey[] = [
  'jetbrains-mono',
  'ibm-plex-mono',
  'system-mono',
  'inter',
  'literata',
] as const;

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

export const FONT_LABELS: Record<FontKey, string> = {
  'jetbrains-mono': 'JetBrains Mono',
  'ibm-plex-mono': 'IBM Plex Mono',
  'system-mono': 'System Mono (SF Mono / Roboto Mono)',
  inter: 'Inter',
  literata: 'Literata',
};

/** Monospace faces eliminate the horizontal jitter that makes RSVP feel like flicker. */
export const MONOSPACE_FONTS: ReadonlySet<FontKey> = new Set<FontKey>([
  'jetbrains-mono',
  'ibm-plex-mono',
  'system-mono',
]);

export const WPM_MIN = MIN_WPM;
export const WPM_MAX = MAX_WPM;
export const WPM_STEP = 10;

export const DEFAULT_SETTINGS: RsvpSettings = {
  wpm: 350,
  pacing: DEFAULT_PACING,
  theme: 'oled',
  accent: 'coral',
  fontFamily: 'jetbrains-mono',
  fontSize: 48,
  showFocusGuides: true,
  showProgress: true,
  showStats: true,
  contextWords: 0,
  warmupTokens: 8,
  pauseOnParagraph: false,
  rewindTokens: 10,
  soundEnabled: false,
  ttsEnabled: false,
  ttsVoice: null,
  keepAwake: true,
  reduceMotion: false,

  readerMode: 'rsvp',
  readerFontSize: 19,
  readerLineHeight: 1.65,
  readerMargin: 22,
  readerJustify: false,
  readerFont: 'literata',
  readerPaged: false,
  readerAutoScroll: 0,
  readerBionic: 0,
  readerRuler: 0,
  readerOverlay: 'none',
  dailyGoalWords: 0,
};

export const READER_MODES = ['rsvp', 'page'] as const;
export const READER_FONTS = ['literata', 'inter', 'system', 'open-dyslexic'] as const;
export const OVERLAYS = ['none', 'cream', 'peach', 'rose', 'mint', 'sky', 'lilac'] as const;
export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePacing(value: unknown): PacingMatrix {
  if (typeof value !== 'object' || value === null) return DEFAULT_PACING;
  const p = value as Partial<PacingMatrix>;
  return {
    longWord: num(p.longWord, DEFAULT_PACING.longWord, 1, 4),
    longWordThreshold: num(p.longWordThreshold, DEFAULT_PACING.longWordThreshold, 3, 20),
    sentenceEnd: num(p.sentenceEnd, DEFAULT_PACING.sentenceEnd, 1, 5),
    clauseEnd: num(p.clauseEnd, DEFAULT_PACING.clauseEnd, 1, 5),
    paragraphEnd: num(p.paragraphEnd, DEFAULT_PACING.paragraphEnd, 1, 6),
    numeric: num(p.numeric, DEFAULT_PACING.numeric, 1, 4),
    shortWord: num(p.shortWord, DEFAULT_PACING.shortWord, 0.5, 1),
    minDurationMs: num(p.minDurationMs, DEFAULT_PACING.minDurationMs, 10, 500),
    maxDurationMs: num(p.maxDurationMs, DEFAULT_PACING.maxDurationMs, 500, 10_000),
  };
}

/**
 * Coerce anything read back from disk into valid settings.
 * Persisted user settings outlive schema changes; a stray `wpm: "fast"` from an old
 * build must not brick the player.
 */
export function normalizeSettings(input: unknown): RsvpSettings {
  if (typeof input !== 'object' || input === null) return { ...DEFAULT_SETTINGS };
  const s = input as Partial<RsvpSettings>;
  return {
    wpm: clampWpm(num(s.wpm, DEFAULT_SETTINGS.wpm, WPM_MIN, WPM_MAX)),
    pacing: normalizePacing(s.pacing),
    theme: pick(s.theme, THEMES, DEFAULT_SETTINGS.theme),
    accent: pick(s.accent, ACCENTS, DEFAULT_SETTINGS.accent),
    fontFamily: pick(s.fontFamily, FONTS, DEFAULT_SETTINGS.fontFamily),
    fontSize: num(s.fontSize, DEFAULT_SETTINGS.fontSize, 20, 120),
    showFocusGuides: bool(s.showFocusGuides, DEFAULT_SETTINGS.showFocusGuides),
    showProgress: bool(s.showProgress, DEFAULT_SETTINGS.showProgress),
    showStats: bool(s.showStats, DEFAULT_SETTINGS.showStats),
    contextWords: Math.round(num(s.contextWords, DEFAULT_SETTINGS.contextWords, 0, 4)),
    warmupTokens: Math.round(num(s.warmupTokens, DEFAULT_SETTINGS.warmupTokens, 0, 60)),
    pauseOnParagraph: bool(s.pauseOnParagraph, DEFAULT_SETTINGS.pauseOnParagraph),
    rewindTokens: Math.round(num(s.rewindTokens, DEFAULT_SETTINGS.rewindTokens, 1, 100)),
    soundEnabled: bool(s.soundEnabled, DEFAULT_SETTINGS.soundEnabled),
    ttsEnabled: bool(s.ttsEnabled, DEFAULT_SETTINGS.ttsEnabled),
    ttsVoice: typeof s.ttsVoice === 'string' ? s.ttsVoice : null,
    keepAwake: bool(s.keepAwake, DEFAULT_SETTINGS.keepAwake),
    reduceMotion: bool(s.reduceMotion, DEFAULT_SETTINGS.reduceMotion),

    readerMode: pick(s.readerMode, READER_MODES, DEFAULT_SETTINGS.readerMode),
    readerFontSize: num(s.readerFontSize, DEFAULT_SETTINGS.readerFontSize, 12, 42),
    readerLineHeight: num(s.readerLineHeight, DEFAULT_SETTINGS.readerLineHeight, 1.1, 2.6),
    readerMargin: num(s.readerMargin, DEFAULT_SETTINGS.readerMargin, 0, 72),
    readerJustify: bool(s.readerJustify, DEFAULT_SETTINGS.readerJustify),
    readerFont: pick(s.readerFont, READER_FONTS, DEFAULT_SETTINGS.readerFont),
    readerPaged: bool(s.readerPaged, DEFAULT_SETTINGS.readerPaged),
    readerAutoScroll: num(s.readerAutoScroll, DEFAULT_SETTINGS.readerAutoScroll, 0, 200),
    readerBionic: Math.round(num(s.readerBionic, DEFAULT_SETTINGS.readerBionic, 0, 5)),
    readerRuler: Math.round(num(s.readerRuler, DEFAULT_SETTINGS.readerRuler, 0, 3)),
    readerOverlay: pick(s.readerOverlay, OVERLAYS, DEFAULT_SETTINGS.readerOverlay),
    dailyGoalWords: Math.round(num(s.dailyGoalWords, DEFAULT_SETTINGS.dailyGoalWords, 0, 20000)),
  };
}

/** Presets that map a reading intent onto the whole matrix in one tap. */
export interface SpeedPreset {
  id: string;
  label: string;
  description: string;
  wpm: number;
  pacing: PacingMatrix;
  warmupTokens: number;
}

export const SPEED_PRESETS: readonly SpeedPreset[] = [
  {
    id: 'study',
    label: 'Study',
    description: 'Slow, generous pauses. For dense material you have to retain.',
    wpm: 220,
    pacing: { ...DEFAULT_PACING, sentenceEnd: 2.2, paragraphEnd: 2.6, longWord: 1.35 },
    warmupTokens: 12,
  },
  {
    id: 'read',
    label: 'Read',
    description: 'The default. Comfortable pace with natural sentence rhythm.',
    wpm: 350,
    pacing: DEFAULT_PACING,
    warmupTokens: 8,
  },
  {
    id: 'skim',
    label: 'Skim',
    description: 'Fast pass with trimmed pauses. For triaging a long article.',
    wpm: 600,
    pacing: { ...DEFAULT_PACING, sentenceEnd: 1.5, clauseEnd: 1.3, paragraphEnd: 1.6 },
    warmupTokens: 6,
  },
  {
    id: 'sprint',
    label: 'Sprint',
    description: 'Maximum throughput. Trained readers only.',
    wpm: 900,
    pacing: { ...DEFAULT_PACING, sentenceEnd: 1.35, clauseEnd: 1.2, paragraphEnd: 1.4, shortWord: 0.85 },
    warmupTokens: 16,
  },
] as const;

export function applyPreset(settings: RsvpSettings, presetId: string): RsvpSettings {
  const preset = SPEED_PRESETS.find((p) => p.id === presetId);
  if (!preset) return settings;
  return {
    ...settings,
    wpm: preset.wpm,
    pacing: preset.pacing,
    warmupTokens: preset.warmupTokens,
  };
}
