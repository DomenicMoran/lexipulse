/**
 * Page-mode typography: the typefaces and tints readers pick from.
 *
 * The RSVP stage needs a monospace face, because the fixation column only holds still if
 * every character is the same width. Page mode needs the opposite — a face built for
 * paragraphs. So the two carry separate settings rather than one shared "font".
 */
import type { OverlayKey, ReaderFontKey } from '@lexipulse/core';

/** Registered in `app/_layout.tsx` alongside the mono faces. */
export const READER_SERIF = 'LexiReadSerif';
export const READER_SANS = 'LexiReadSans';
export const READER_DYSLEXIC = 'LexiReadDyslexic';

export function readerFontFamily(key: ReaderFontKey): string | undefined {
  switch (key) {
    case 'literata':
      return READER_SERIF;
    case 'inter':
      return READER_SANS;
    case 'open-dyslexic':
      return READER_DYSLEXIC;
    case 'system':
    default:
      // Undefined means the platform's own UI face, which is what "system" should be.
      return undefined;
  }
}

/**
 * Irlen-style tints, laid over the page at low alpha.
 *
 * These help some readers with visual stress and do nothing for others, which is why they
 * are a choice and not a default. Alpha stays low enough that body text keeps its contrast
 * ratio — a tint that makes the page prettier and the text unreadable helps nobody.
 */
export const OVERLAY_TINTS: Record<OverlayKey, string | null> = {
  none: null,
  cream: 'rgba(255, 246, 214, 0.10)',
  peach: 'rgba(255, 214, 186, 0.10)',
  rose: 'rgba(255, 200, 214, 0.10)',
  mint: 'rgba(196, 245, 220, 0.10)',
  sky: 'rgba(196, 226, 255, 0.10)',
  lilac: 'rgba(222, 208, 255, 0.10)',
};

export const OVERLAY_LABELS: Record<OverlayKey, { de: string; en: string }> = {
  none: { de: 'Keine', en: 'None' },
  cream: { de: 'Creme', en: 'Cream' },
  peach: { de: 'Pfirsich', en: 'Peach' },
  rose: { de: 'Rosé', en: 'Rose' },
  mint: { de: 'Mint', en: 'Mint' },
  sky: { de: 'Himmel', en: 'Sky' },
  lilac: { de: 'Flieder', en: 'Lilac' },
};
