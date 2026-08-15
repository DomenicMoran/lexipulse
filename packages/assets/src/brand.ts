/**
 * LexiPulse brand geometry — the single source of truth for every raster asset.
 *
 * The mark is the product: a monospace `L` with the ORP block sitting in its crook and
 * the two focus rails bracketing it above and below. That is literally what the player
 * shows — one word, one pivot character, one fixed column — so the icon needs no
 * metaphor beyond the thing itself.
 *
 * Everything here is drawn as SVG paths in a 100 x 100 design space. No glyph from a
 * font ever enters an icon, which is what makes the icons render identically on a build
 * machine that has never heard of JetBrains Mono. Only the wordmark and the marketing
 * images use real type, and those ship rasterised.
 *
 * All functions are pure: they take numbers and return an SVG string.
 */

import { ACCENTS, FONT_STACKS, THEMES } from '@lexipulse/ui/tokens';
import { computeOrp } from '@lexipulse/core';

export const BRAND = {
  name: 'LexiPulse',
  tagline: 'Ultimate RSVP & Document Reader',
  /**
   * Describes what the app does, not what the reader will achieve. "Lies schneller"
   * would be a promise about the user's result, and how much faster somebody reads
   * depends on the text and the person — the store description says exactly that. An
   * advert that contradicts the product description is needless § 5 UWG exposure.
   */
  taglineDe: 'Ein Wort nach dem anderen. Immer an derselben Stelle.',
  domain: 'lexipulse.de',
} as const;

/** Flat colour list pulled from the shared tokens — never hard-code a hex here. */
export const PALETTE = {
  black: THEMES.oled.bg,
  surface: THEMES.oled.surface,
  surfaceHover: THEMES.oled.surfaceHover,
  border: THEMES.oled.border,
  borderStrong: THEMES.oled.borderStrong,
  rail: THEMES.oled.rail,
  text: THEMES.oled.text,
  textMuted: THEMES.oled.textMuted,
  textFaint: THEMES.oled.textFaint,
  paper: THEMES.minimal.bg,
  ink: THEMES.minimal.text,
  inkMuted: THEMES.minimal.textMuted,
  coral: ACCENTS.coral.base,
  amber: ACCENTS.amber.base,
  cyber: ACCENTS.cyber.base,
} as const;

export const FONTS = FONT_STACKS;

/**
 * Metrics of JetBrains Mono, in em. Used to place per-character cells and to align the
 * focus rails to the pivot column without asking a text engine where the glyph landed.
 */
export const MONO_METRICS = {
  advance: 0.6,
  capHeight: 0.73,
  descender: 0.24,
} as const;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

type Point = readonly [number, number];

/** Full mark: `L` + ORP block + focus rails, in the 100 x 100 design space. */
export const MARK = {
  stemX: 24,
  stemW: 14,
  top: 26,
  bottom: 74,
  footTop: 60,
  footRight: 66,
  corner: 2.5,
  dot: 16,
  dotCorner: 3.5,
  railW: 4.5,
  railTopY: 8,
  railBottomY: 80,
  railH: 12,
} as const;

/**
 * Reduced mark for 16 px targets: no rails, fatter strokes, bigger block. Shrinking the
 * full mark to a favicon turns the 4.5-unit rails into a sub-pixel smudge, so the
 * detail is dropped rather than scaled.
 */
export const MARK_SIMPLE = {
  stemX: 18,
  stemW: 16,
  top: 20,
  bottom: 80,
  footTop: 64,
  footRight: 82,
  corner: 2.5,
  dot: 22,
  dotCorner: 4.5,
} as const;

export interface ContentBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** Distance from the centre to the farthest corner — the maskable-safe radius test. */
  halfDiagonal: number;
}

function box(x0: number, y0: number, x1: number, y1: number): ContentBox {
  const width = x1 - x0;
  const height = y1 - y0;
  return {
    x0,
    y0,
    x1,
    y1,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    width,
    height,
    halfDiagonal: Math.hypot(width / 2, height / 2),
  };
}

/** Bounding box of the full mark, rails included. */
export const MARK_BOX = box(MARK.stemX, MARK.railTopY, MARK.footRight, MARK.railBottomY + MARK.railH);

/** Bounding box of the reduced mark. */
export const MARK_SIMPLE_BOX = box(
  MARK_SIMPLE.stemX,
  MARK_SIMPLE.top,
  MARK_SIMPLE.footRight,
  MARK_SIMPLE.bottom,
);

const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Polygon with rounded corners as a single path. The corner is approximated with a
 * quadratic through the original vertex, which for 90-degree joins is visually
 * indistinguishable from an arc at any raster size we ship.
 */
function roundedPolygon(points: readonly Point[], radius: number): string {
  const n = points.length;
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i - 1 + n) % n] as Point;
    const cur = points[i] as Point;
    const next = points[(i + 1) % n] as Point;

    const dPrev = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]);
    const dNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
    const r = Math.min(radius, dPrev / 2, dNext / 2);

    const a: Point = [
      cur[0] + ((prev[0] - cur[0]) / dPrev) * r,
      cur[1] + ((prev[1] - cur[1]) / dPrev) * r,
    ];
    const b: Point = [
      cur[0] + ((next[0] - cur[0]) / dNext) * r,
      cur[1] + ((next[1] - cur[1]) / dNext) * r,
    ];

    out.push(`${i === 0 ? 'M' : 'L'} ${round(a[0])} ${round(a[1])}`);
    out.push(`Q ${round(cur[0])} ${round(cur[1])} ${round(b[0])} ${round(b[1])}`);
  }
  out.push('Z');
  return out.join(' ');
}

/** The `L` of the full mark, as a closed path. */
export function letterPath(): string {
  const { stemX, stemW, top, bottom, footTop, footRight, corner } = MARK;
  return roundedPolygon(
    [
      [stemX, top],
      [stemX + stemW, top],
      [stemX + stemW, footTop],
      [footRight, footTop],
      [footRight, bottom],
      [stemX, bottom],
    ],
    corner,
  );
}

/** The `L` of the reduced mark. */
export function letterPathSimple(): string {
  const { stemX, stemW, top, bottom, footTop, footRight, corner } = MARK_SIMPLE;
  return roundedPolygon(
    [
      [stemX, top],
      [stemX + stemW, top],
      [stemX + stemW, footTop],
      [footRight, footTop],
      [footRight, bottom],
      [stemX, bottom],
    ],
    corner,
  );
}

/** Centre of the letter's crook — where the ORP block and the rails live. */
export const CROOK = {
  x: (MARK.stemX + MARK.stemW + MARK.footRight) / 2,
  y: (MARK.top + MARK.footTop) / 2,
} as const;

export const CROOK_SIMPLE = {
  x: (MARK_SIMPLE.stemX + MARK_SIMPLE.stemW + MARK_SIMPLE.footRight) / 2,
  y: (MARK_SIMPLE.top + MARK_SIMPLE.footTop) / 2,
} as const;

export interface MarkOptions {
  /** Colour of the letter. */
  letter?: string;
  /** Colour of the ORP block and the rails. */
  accent?: string;
  /** Draw the two focus rails. Dropped below ~48 px, where they stop resolving. */
  rails?: boolean;
  /** Use the reduced construction (no rails, fatter strokes). */
  simple?: boolean;
  /** Paint letter, block and rails in one colour — Android's monochrome layer. */
  monochrome?: string;
}

/**
 * The mark as a `<g>`, mapped from design space onto the output canvas.
 *
 * `scale` is output units per design unit; `cx`/`cy` is where the mark's content box
 * centre lands. Passing the content box (not the 100 x 100 frame) means the mark is
 * optically centred rather than centred on a frame that has slack on one side.
 */
export function markGroup(cx: number, cy: number, scale: number, options: MarkOptions = {}): string {
  const {
    simple = false,
    letter = PALETTE.text,
    accent = PALETTE.coral,
    rails = !simple,
    monochrome,
  } = options;

  const letterFill = monochrome ?? letter;
  const accentFill = monochrome ?? accent;
  const content = simple ? MARK_SIMPLE_BOX : MARK_BOX;
  const crook = simple ? CROOK_SIMPLE : CROOK;
  const dot = simple ? MARK_SIMPLE.dot : MARK.dot;
  const dotCorner = simple ? MARK_SIMPLE.dotCorner : MARK.dotCorner;

  const parts: string[] = [
    `<path d="${simple ? letterPathSimple() : letterPath()}" fill="${letterFill}"/>`,
    `<rect x="${round(crook.x - dot / 2)}" y="${round(crook.y - dot / 2)}" width="${dot}" height="${dot}" rx="${dotCorner}" fill="${accentFill}"/>`,
  ];

  if (rails && !simple) {
    const rx = round(CROOK.x - MARK.railW / 2);
    const r = MARK.railW / 2;
    parts.push(
      `<rect x="${rx}" y="${MARK.railTopY}" width="${MARK.railW}" height="${MARK.railH}" rx="${r}" fill="${accentFill}"/>`,
      `<rect x="${rx}" y="${MARK.railBottomY}" width="${MARK.railW}" height="${MARK.railH}" rx="${r}" fill="${accentFill}"/>`,
    );
  }

  const tx = round(cx);
  const ty = round(cy);
  const s = round(scale);
  return `<g transform="translate(${tx} ${ty}) scale(${s}) translate(${-content.cx} ${-content.cy})">${parts.join('')}</g>`;
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] as string);
}

export interface MonoRow {
  svg: string;
  width: number;
  /** Centre x of every character cell, in output units. */
  cellCentres: number[];
  cell: number;
}

/**
 * A monospace string laid out as one `<text>` per character, each centred in its own
 * cell. Doing the layout ourselves rather than trusting the text engine keeps the cell
 * grid exact, which is the only way to put a focus rail on the pivot column.
 */
export function monoRow(options: {
  text: string;
  cx: number;
  baseline: number;
  fontSize: number;
  fill: string;
  accentIndex?: number;
  accent?: string;
  weight?: number;
  family?: string;
}): MonoRow {
  const {
    text,
    cx,
    baseline,
    fontSize,
    fill,
    accentIndex = -1,
    accent = PALETTE.coral,
    weight = 500,
    family = 'JetBrains Mono',
  } = options;

  const chars = Array.from(text);
  const cell = fontSize * MONO_METRICS.advance;
  const width = cell * chars.length;
  const x0 = cx - width / 2;
  const cellCentres = chars.map((_, i) => round(x0 + (i + 0.5) * cell));

  const svg = chars
    .map((ch, i) => {
      if (ch === ' ') return '';
      const colour = i === accentIndex ? accent : fill;
      return `<text x="${cellCentres[i]}" y="${round(baseline)}" font-family="${family}" font-size="${round(fontSize)}" font-weight="${weight}" fill="${colour}" text-anchor="middle" xml:space="preserve">${escapeXml(ch)}</text>`;
    })
    .join('');

  return { svg, width, cellCentres, cell };
}

/** Proportional line of Inter — headlines and subtitles, never the player. */
export function sansText(options: {
  text: string;
  x: number;
  baseline: number;
  fontSize: number;
  fill: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
}): string {
  const {
    text,
    x,
    baseline,
    fontSize,
    fill,
    weight = 400,
    anchor = 'middle',
    letterSpacing = 0,
  } = options;
  const spacing = letterSpacing ? ` letter-spacing="${round(letterSpacing)}"` : '';
  return `<text x="${round(x)}" y="${round(baseline)}" font-family="Inter" font-size="${round(fontSize)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing}>${escapeXml(text)}</text>`;
}

/**
 * The RSVP stage: one word, its pivot character in the accent colour, and a focus rail
 * above and below that column. Rails are placed off the em size rather than off the
 * rendered glyph box so the composition is identical whatever font actually resolves.
 */
export function rsvpStage(options: {
  word: string;
  cx: number;
  cy: number;
  fontSize: number;
  fill?: string;
  accent?: string;
  rail?: string;
}): string {
  const {
    word,
    cx,
    cy,
    fontSize,
    fill = PALETTE.text,
    accent = PALETTE.coral,
    rail = accent,
  } = options;

  const orp = computeOrp(word);
  const baseline = cy + (MONO_METRICS.capHeight * fontSize) / 2;
  const row = monoRow({ text: word, cx, baseline, fontSize, fill, accentIndex: orp, accent });

  const railX = row.cellCentres[orp] ?? cx;
  const railW = Math.max(fontSize * 0.045, 1);
  const railH = fontSize * 0.45;
  const inner = fontSize * 0.82;

  const rails =
    `<rect x="${round(railX - railW / 2)}" y="${round(cy - inner - railH)}" width="${round(railW)}" height="${round(railH)}" rx="${round(railW / 2)}" fill="${rail}"/>` +
    `<rect x="${round(railX - railW / 2)}" y="${round(cy + inner)}" width="${round(railW)}" height="${round(railH)}" rx="${round(railW / 2)}" fill="${rail}"/>`;

  return rails + row.svg;
}

// ---------------------------------------------------------------------------
// Public SVG generators
// ---------------------------------------------------------------------------

function svgDoc(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

export interface AppIconOptions {
  accent?: string;
  /** Background fill, or `null` for transparent outside the plate. */
  background?: string | null;
  /**
   * Fraction of the canvas the mark's content box is scaled to. 1 fills the canvas
   * edge to edge; the Android maskable safe circle needs roughly 0.72 or less.
   */
  safeArea?: number;
  /** Plate corner radius as a fraction of the edge. 0 = full square. */
  radius?: number;
  /** Hairline plate border, so a black icon still has an edge on a black wallpaper. */
  border?: boolean;
  letter?: string;
  rails?: boolean;
  monochrome?: string;
  /** Reduced construction — for notification and monochrome layers. */
  simple?: boolean;
}

/** Square app icon. Everything is a path — no font is consulted. */
export function appIconSvg(size: number, options: AppIconOptions = {}): string {
  const {
    accent = PALETTE.coral,
    background = PALETTE.black,
    safeArea = 0.86,
    radius = 0,
    border = false,
    letter = PALETTE.text,
    simple = false,
    rails = !simple,
    monochrome,
  } = options;

  const rx = round(size * radius);
  const parts: string[] = [];

  if (background !== null) {
    parts.push(`<rect width="${size}" height="${size}" rx="${rx}" fill="${background}"/>`);
  }
  if (border) {
    const w = Math.max(size * 0.004, 1);
    parts.push(
      `<rect x="${round(w / 2)}" y="${round(w / 2)}" width="${round(size - w)}" height="${round(size - w)}" rx="${round(Math.max(rx - w / 2, 0))}" fill="none" stroke="${PALETTE.border}" stroke-width="${round(w)}"/>`,
    );
  }

  const scale = (size * safeArea) / 100;
  const markOptions: MarkOptions = { letter, accent, rails, simple };
  if (monochrome !== undefined) markOptions.monochrome = monochrome;
  parts.push(markGroup(size / 2, size / 2, scale, markOptions));

  return svgDoc(size, size, parts.join(''));
}

/**
 * Distance from the mark's centre to its farthest *painted* point, in design units.
 *
 * Deliberately not the bounding box's half-diagonal: the mark is a tall, narrow figure
 * whose box corners are empty, so the circumscribed circle of the box would shrink every
 * masked icon by about 10 % for nothing. This walks the real vertices instead.
 */
export function markRadius(simple = false): number {
  const geo = simple ? MARK_SIMPLE : MARK;
  const box_ = simple ? MARK_SIMPLE_BOX : MARK_BOX;
  const crook = simple ? CROOK_SIMPLE : CROOK;
  const dot = simple ? MARK_SIMPLE.dot : MARK.dot;

  const corners: Point[] = [
    [geo.stemX, geo.top],
    [geo.stemX + geo.stemW, geo.top],
    [geo.footRight, geo.footTop],
    [geo.footRight, geo.bottom],
    [geo.stemX, geo.bottom],
    [crook.x - dot / 2, crook.y - dot / 2],
    [crook.x + dot / 2, crook.y + dot / 2],
  ];

  if (!simple) {
    const half = MARK.railW / 2;
    corners.push(
      [CROOK.x + half, MARK.railTopY],
      [CROOK.x - half, MARK.railTopY],
      [CROOK.x + half, MARK.railBottomY + MARK.railH],
      [CROOK.x - half, MARK.railBottomY + MARK.railH],
    );
  }

  return corners.reduce(
    (max, [x, y]) => Math.max(max, Math.hypot(x - box_.cx, y - box_.cy)),
    0,
  );
}

/**
 * Largest `safeArea` whose content still fits inside a circle of `diameter` (as a
 * fraction of the edge). Android maskable icons crop to 80 %; adaptive icon layers are
 * safe inside 66 dp of 108 dp.
 */
export function safeAreaForCircle(diameter: number, simple = false): number {
  return diameter / 2 / (markRadius(simple) / 100);
}

export interface LogoOptions {
  /** `dark` = for dark backgrounds (light letter). `light` = for light backgrounds. */
  variant?: 'dark' | 'light';
  withWordmark?: boolean;
  accent?: string;
  /** Paint a background plate instead of leaving the logo transparent. */
  plate?: boolean;
}

/** Horizontal lockup: mark, gap, wordmark. Height is fixed at 96 units. */
export function logoSvg(options: LogoOptions = {}): string {
  const { variant = 'dark', withWordmark = true, accent = PALETTE.coral, plate = false } = options;

  const letter = variant === 'dark' ? PALETTE.text : PALETTE.ink;
  const plateFill = variant === 'dark' ? PALETTE.black : PALETTE.paper;

  const height = 96;
  const markHeight = 76;
  const scale = markHeight / MARK_BOX.height;
  const markWidth = MARK_BOX.width * scale;
  const padX = 10;

  const fontSize = 52;
  const cell = fontSize * MONO_METRICS.advance;
  const wordWidth = withWordmark ? cell * BRAND.name.length : 0;
  const gap = withWordmark ? 26 : 0;

  const width = round(padX * 2 + markWidth + gap + wordWidth);
  const parts: string[] = [];

  if (plate) parts.push(`<rect width="${width}" height="${height}" fill="${plateFill}"/>`);

  parts.push(markGroup(padX + markWidth / 2, height / 2, scale, { letter, accent }));

  if (withWordmark) {
    const wordCx = padX + markWidth + gap + wordWidth / 2;
    const baseline = height / 2 + (MONO_METRICS.capHeight * fontSize) / 2;
    parts.push(
      monoRow({
        text: BRAND.name,
        cx: wordCx,
        baseline,
        fontSize,
        fill: letter,
        weight: 500,
      }).svg,
    );
  }

  return svgDoc(width, height, parts.join(''));
}

/** Wordmark alone, with the pivot character of "LexiPulse" carrying the accent. */
export function wordmarkSvg(options: { variant?: 'dark' | 'light'; accent?: string } = {}): string {
  const { variant = 'dark', accent = PALETTE.coral } = options;
  const fill = variant === 'dark' ? PALETTE.text : PALETTE.ink;

  const fontSize = 72;
  const height = 112;
  const cell = fontSize * MONO_METRICS.advance;
  const width = round(cell * BRAND.name.length + 24);
  const baseline = height / 2 + (MONO_METRICS.capHeight * fontSize) / 2;

  const row = monoRow({
    text: BRAND.name,
    cx: width / 2,
    baseline,
    fontSize,
    fill,
    accentIndex: computeOrp(BRAND.name),
    accent,
    weight: 500,
  });

  return svgDoc(width, height, row.svg);
}

/**
 * Favicon. Reduced construction, wider strokes, no rails — at 16 px the full mark's
 * hairlines land on a third of a pixel and turn into grey mush.
 */
export function faviconSvg(size = 64): string {
  const parts = [
    `<rect width="${size}" height="${size}" rx="${round(size * 0.22)}" fill="${PALETTE.black}"/>`,
    markGroup(size / 2, size / 2, (size * 1.05) / 100, {
      simple: true,
      letter: PALETTE.text,
      accent: PALETTE.coral,
    }),
  ];
  return svgDoc(size, size, parts.join(''));
}

export interface SplashOptions {
  background?: string | null;
  accent?: string;
  /** Fraction of the shorter edge the mark's content box spans. */
  markScale?: number;
  withWordmark?: boolean;
}

/**
 * Splash artwork. Expo's splash plugin takes a square logo and scales it to
 * `imageWidth` dp on a solid background, so the shipped file is a 1024 x 1024
 * transparent square — not a full-bleed phone-sized canvas.
 */
export function splashSvg(width: number, height: number, options: SplashOptions = {}): string {
  const {
    background = null,
    accent = PALETTE.coral,
    markScale = 0.86,
    withWordmark = false,
  } = options;

  const shorter = Math.min(width, height);
  const parts: string[] = [];
  if (background !== null) {
    parts.push(`<rect width="${width}" height="${height}" fill="${background}"/>`);
  }

  const scale = (shorter * markScale) / 100;
  const markCy = withWordmark ? height / 2 - shorter * 0.06 : height / 2;
  parts.push(markGroup(width / 2, markCy, scale, { letter: PALETTE.text, accent }));

  if (withWordmark) {
    const fontSize = shorter * 0.07;
    const baseline = markCy + MARK_BOX.height * scale * 0.5 + fontSize * 1.6;
    parts.push(
      monoRow({
        text: BRAND.name,
        cx: width / 2,
        baseline,
        fontSize,
        fill: PALETTE.text,
        weight: 500,
      }).svg,
    );
  }

  return svgDoc(width, height, parts.join(''));
}

/**
 * Open Graph card, 1200 x 630. The hero is the product itself: the title word on the
 * stage with its pivot character marked and the focus rails on that column.
 */
export function ogImageSvg(
  title: string = BRAND.name,
  subtitle: string = BRAND.tagline,
  options: { accent?: string; width?: number; height?: number } = {},
): string {
  const { accent = PALETTE.coral, width = 1200, height = 630 } = options;

  // Shrink the stage type until the word plus one empty cell fits the safe width.
  const safeWidth = width * 0.78;
  const chars = Array.from(title).length + 1;
  const fontSize = Math.min(124, safeWidth / (chars * MONO_METRICS.advance));

  const stageCy = height * 0.42;
  const parts: string[] = [
    `<rect width="${width}" height="${height}" fill="${PALETTE.black}"/>`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${PALETTE.border}" stroke-width="1"/>`,
    rsvpStage({ word: title, cx: width / 2, cy: stageCy, fontSize, accent }),
    sansText({
      text: subtitle,
      x: width / 2,
      baseline: height * 0.775,
      fontSize: 32,
      fill: PALETTE.textMuted,
      weight: 400,
    }),
    sansText({
      text: BRAND.domain,
      x: width / 2,
      baseline: height * 0.905,
      fontSize: 21,
      fill: PALETTE.textFaint,
      weight: 500,
      letterSpacing: 1.4,
    }),
  ];

  return svgDoc(width, height, parts.join(''));
}
