/**
 * Geometry of the RSVP stage.
 *
 * The whole illusion depends on one invariant: the ORP character sits on the same
 * physical column for every word, forever. With a monospace face that is pure
 * arithmetic — this module is that arithmetic, shared by web (CSS `ch`) and native
 * (measured advance width).
 */

export interface StageGeometry {
  /** Column the pivot is pinned to, counted from the left edge of the stage. */
  focusColumn: number;
  /** Total stage width in characters. */
  columns: number;
  /** Characters available left of the pivot. */
  leftColumns: number;
  /** Characters available right of the pivot. */
  rightColumns: number;
}

export interface GeometryOptions {
  /**
   * Longest token the stage must hold without reflowing. The tokenizer caps word
   * length at 22 by default, so 22 is the honest worst case.
   */
  maxWordLength?: number;
  /** Widest pivot index across the stream. 4 is the tokenizer's hard ceiling. */
  maxOrp?: number;
  /** Extra breathing room on both sides. */
  padding?: number;
}

export const MAX_ORP_INDEX = 4;

/**
 * Size the stage so no word can ever overflow it.
 *
 * Left of the pivot we need `maxOrp` columns; right of it we need
 * `maxWordLength - 1 - maxOrp`. Sizing to the worst case once means the stage never
 * resizes mid-stream, which is what would actually be perceived as flicker.
 */
export function computeStageGeometry(options: GeometryOptions = {}): StageGeometry {
  const { maxWordLength = 22, maxOrp = MAX_ORP_INDEX, padding = 2 } = options;
  const leftColumns = maxOrp + padding;
  const rightColumns = Math.max(maxWordLength - 1 - maxOrp, 1) + padding;
  return {
    focusColumn: leftColumns,
    columns: leftColumns + 1 + rightColumns,
    leftColumns,
    rightColumns,
  };
}

/**
 * Horizontal shift, in character widths, that moves a word's pivot onto the focus
 * column. Positive shifts right.
 */
export function pivotOffsetColumns(orp: number, focusColumn: number): number {
  return focusColumn - orp;
}

/** CSS `transform` for the web player. `ch` is exact on a monospace face. */
export function pivotTransformCss(orp: number, focusColumn: number): string {
  return `translateX(${pivotOffsetColumns(orp, focusColumn)}ch)`;
}

/** Pixel shift for the native player, given a measured character advance width. */
export function pivotOffsetPx(orp: number, focusColumn: number, charWidthPx: number): number {
  return pivotOffsetColumns(orp, focusColumn) * charWidthPx;
}

/**
 * Advance width of the player's monospace face as a fraction of the font size.
 * JetBrains Mono is 600/1000 em; the fallbacks are close enough that the pivot stays
 * inside a hairline of the rail.
 */
export const MONO_ADVANCE_RATIO = 0.6;

export function charWidthPx(fontSizePx: number, advanceRatio = MONO_ADVANCE_RATIO): number {
  return fontSizePx * advanceRatio;
}

/**
 * Largest player font size that still fits the stage into `containerWidthPx`.
 * Clamped so the type never becomes unreadable on a narrow phone.
 */
export function fitFontSize(
  containerWidthPx: number,
  geometry: StageGeometry,
  bounds: { min?: number; max?: number } = {},
): number {
  const { min = 20, max = 120 } = bounds;
  const raw = containerWidthPx / (geometry.columns * MONO_ADVANCE_RATIO);
  return Math.min(Math.max(Math.floor(raw), min), max);
}
