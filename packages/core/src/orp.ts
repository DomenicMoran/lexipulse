/**
 * Optimal Recognition Point (ORP).
 *
 * The ORP is the character the eye should land on so a word is recognised without
 * a saccade. LexiPulse pins that character to a fixed column in the player, which
 * is what makes high-WPM RSVP readable at all.
 *
 * Indices returned here are **code-point** indices, not UTF-16 offsets. Always slice
 * with {@link splitAtOrp} instead of `String.prototype.slice` so surrogate pairs and
 * combining marks stay intact.
 */

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Pivot offset inside the alphanumeric core of a word, by core length.
 * Derived from the classic Spritz distribution: the pivot drifts right as words grow
 * but never past the fifth character, because further drift hurts recognition.
 */
export function orpForLength(coreLength: number): number {
  if (coreLength <= 1) return 0;
  if (coreLength <= 5) return 1;
  if (coreLength <= 9) return 2;
  if (coreLength <= 13) return 3;
  return 4;
}

/**
 * Code-point index of the ORP character inside `word`.
 * Leading punctuation (quotes, brackets, dashes) is skipped so `"Hallo` pivots on the
 * same letter as `Hallo`.
 */
export function computeOrp(word: string): number {
  const chars = Array.from(word);
  if (chars.length === 0) return 0;

  let start = 0;
  while (start < chars.length && !WORD_CHAR.test(chars[start] as string)) start += 1;

  let end = chars.length - 1;
  while (end >= start && !WORD_CHAR.test(chars[end] as string)) end -= 1;

  // Pure punctuation ("—", "***"): pivot on the middle character.
  if (start > end) return Math.floor((chars.length - 1) / 2);

  return start + orpForLength(end - start + 1);
}

export interface OrpSplit {
  /** Everything left of the pivot character. */
  before: string;
  /** The single pivot character (may be a multi-code-unit grapheme). */
  pivot: string;
  /** Everything right of the pivot character. */
  after: string;
  /** Code-point index of the pivot. */
  index: number;
}

/** Split a word into the three render segments the player needs. */
export function splitAtOrp(word: string, orp?: number): OrpSplit {
  const chars = Array.from(word);
  if (chars.length === 0) return { before: '', pivot: '', after: '', index: 0 };
  const index = Math.min(Math.max(orp ?? computeOrp(word), 0), chars.length - 1);
  return {
    before: chars.slice(0, index).join(''),
    pivot: chars[index] as string,
    after: chars.slice(index + 1).join(''),
    index,
  };
}

/**
 * Horizontal offset, in characters, needed to align a word's pivot to a fixed column.
 * With a monospace face this is exact: `translateX((focusColumn - orp) * ch)`.
 */
export function orpOffsetChars(word: string, focusColumn: number, orp?: number): number {
  return focusColumn - (orp ?? computeOrp(word));
}

/**
 * Widest pivot offset in a token stream — used to size the player so no word
 * ever shifts the layout, which is what causes perceived flicker.
 */
export function maxOrpIndex(words: readonly string[]): number {
  let max = 0;
  for (const w of words) {
    const o = computeOrp(w);
    if (o > max) max = o;
  }
  return max;
}
