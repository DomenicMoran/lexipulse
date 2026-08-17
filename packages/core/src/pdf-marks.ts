/**
 * What the reader adds to an original page: marks, notes, drawings, stamps, signatures.
 *
 * These are LexiPulse's own records, not PDF annotation objects. Two reasons, and both
 * decide how the whole editor behaves:
 *
 * **They stay editable.** A highlight written into a PDF is a drawing operation; once the
 * file is saved there is no way back to "move this three millimetres left". Kept beside
 * the document, every mark can be moved, recoloured and deleted for as long as the reader
 * owns the file, and the original bytes are never touched until an export is asked for.
 *
 * **They survive the round trip.** A backup carries them, a second device gets them, and
 * the reader's own text highlights in the word stream (`Annotation`) sit in the same
 * store. What an export does is flatten them into a new file — an operation, not a state.
 *
 * Coordinates are PDF user space: points, origin bottom-left, before any rotation the
 * viewer applies. That is the one space that means the same thing to pdf.js, to pdf-lib
 * and to the file itself; anything measured in screen pixels would be wrong the moment
 * the reader zoomed.
 *
 * Platform-free, like the rest of core.
 */

export type PdfMarkKind =
  | 'highlight'
  | 'underline'
  | 'strike'
  | 'ink'
  | 'text'
  | 'note'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'redact'
  | 'image'
  | 'signature';

/** A rectangle in PDF points: `[x1, y1, x2, y2]`, origin bottom-left. */
export type PdfRect = [number, number, number, number];

/** A freehand stroke: a flat list of `x, y` pairs in PDF points. */
export type PdfPath = number[];

export interface PdfMark {
  id: string;
  documentId: string;
  /** 1-based, as the reader counts pages. */
  page: number;
  kind: PdfMarkKind;
  /** Bounding box. For ink and lines this is derived from the paths. */
  rect: PdfRect;
  /** Present for `ink`; one entry per stroke. */
  paths?: PdfPath[];
  /** `#rrggbb`. The one place a colour is stored, so export and screen cannot disagree. */
  color: string;
  /** 0–1. Highlights need multiply-like translucency, ink does not. */
  opacity: number;
  /** Stroke width in points, for ink, lines, arrows and outlines. */
  strokeWidth: number;
  /** Content of `text` and `note`. */
  text?: string;
  /** Point size for `text`. */
  fontSize?: number;
  /** `FileStore` key of the stamped picture, for `image` and `signature`. */
  imageId?: string;
  /** Rotation of the stamp in degrees, counter-clockwise. */
  rotation?: number;
  createdAt: number;
  updatedAt: number;
}

/** Everything a caller has to decide; the rest gets a sensible default. */
export interface PdfMarkInput {
  documentId: string;
  page: number;
  kind: PdfMarkKind;
  rect: PdfRect;
  paths?: PdfPath[];
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  imageId?: string;
  rotation?: number;
  id?: string;
  createdAt?: number;
}

/**
 * Defaults per kind.
 *
 * A highlight has to let the text through, so it is translucent and yellow. Ink is a pen:
 * opaque, thin, and in a colour that reads as a correction rather than as part of the
 * document. Redaction is black and fully opaque, because anything less is not redaction.
 */
const DEFAULTS: Record<
  PdfMarkKind,
  { color: string; opacity: number; strokeWidth: number; fontSize?: number }
> = {
  highlight: { color: '#ffd400', opacity: 0.4, strokeWidth: 0 },
  underline: { color: '#e5484d', opacity: 1, strokeWidth: 1.2 },
  strike: { color: '#e5484d', opacity: 1, strokeWidth: 1.2 },
  ink: { color: '#e5484d', opacity: 1, strokeWidth: 2 },
  text: { color: '#111111', opacity: 1, strokeWidth: 0, fontSize: 12 },
  note: { color: '#ffb224', opacity: 1, strokeWidth: 0, fontSize: 12 },
  rect: { color: '#e5484d', opacity: 1, strokeWidth: 1.5 },
  ellipse: { color: '#e5484d', opacity: 1, strokeWidth: 1.5 },
  line: { color: '#e5484d', opacity: 1, strokeWidth: 1.5 },
  arrow: { color: '#e5484d', opacity: 1, strokeWidth: 1.5 },
  redact: { color: '#000000', opacity: 1, strokeWidth: 0 },
  image: { color: '#000000', opacity: 1, strokeWidth: 0 },
  signature: { color: '#111111', opacity: 1, strokeWidth: 0 },
};

/**
 * The starting appearance of a kind, for a palette that has not been touched yet.
 *
 * Exported because the interface has to open with the same colour the export would use:
 * a highlighter that starts red because red was the last pen is a highlighter that gets
 * used once and then never again.
 */
export function defaultStyleFor(kind: PdfMarkKind): {
  color: string;
  opacity: number;
  strokeWidth: number;
  fontSize: number;
} {
  const defaults = DEFAULTS[kind];
  return {
    color: defaults.color,
    opacity: defaults.opacity,
    strokeWidth: defaults.strokeWidth || 2,
    fontSize: defaults.fontSize ?? 12,
  };
}

/** True when the kind draws strokes rather than a box. */
export function isStrokeKind(kind: PdfMarkKind): boolean {
  return kind === 'ink';
}

/** True when the kind needs no drag: one click places it. */
export function isPointKind(kind: PdfMarkKind): boolean {
  return kind === 'note';
}

/** Normalise a rectangle to `[left, bottom, right, top]`, whichever way it was dragged. */
export function normalizeRect(rect: readonly number[]): PdfRect {
  const [a = 0, b = 0, c = 0, d = 0] = rect;
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

/** The box that contains every stroke, grown by half the pen width on each side. */
export function boundsOfPaths(paths: readonly PdfPath[], strokeWidth = 0): PdfRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    for (let i = 0; i + 1 < path.length; i += 2) {
      const x = path[i] as number;
      const y = path[i + 1] as number;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (minX === Infinity) return [0, 0, 0, 0];
  const pad = strokeWidth / 2;
  return [minX - pad, minY - pad, maxX + pad, maxY + pad];
}

let counter = 0;

/** Ids are unique within a session without pulling in a uuid dependency. */
export function createMarkId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Fill in everything the caller left out, and keep the rectangle honest. */
export function createMark(input: PdfMarkInput): PdfMark {
  const defaults = DEFAULTS[input.kind];
  const now = input.createdAt ?? Date.now();
  const strokeWidth = input.strokeWidth ?? defaults.strokeWidth;
  const rect =
    input.paths && input.paths.length > 0
      ? boundsOfPaths(input.paths, strokeWidth)
      : normalizeRect(input.rect);

  return {
    id: input.id ?? createMarkId(),
    documentId: input.documentId,
    page: Math.max(1, Math.round(input.page)),
    kind: input.kind,
    rect,
    ...(input.paths ? { paths: input.paths } : {}),
    color: input.color ?? defaults.color,
    opacity: input.opacity ?? defaults.opacity,
    strokeWidth,
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.fontSize ?? defaults.fontSize ? { fontSize: input.fontSize ?? defaults.fontSize } : {}),
    ...(input.imageId ? { imageId: input.imageId } : {}),
    ...(input.rotation ? { rotation: input.rotation } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/** Move every point of a mark by `dx, dy` points. Paths move with the box. */
export function moveMark(mark: PdfMark, dx: number, dy: number): PdfMark {
  const [x1, y1, x2, y2] = mark.rect;
  return {
    ...mark,
    rect: [x1 + dx, y1 + dy, x2 + dx, y2 + dy],
    ...(mark.paths
      ? {
          paths: mark.paths.map((path) =>
            path.map((value, index) => (index % 2 === 0 ? value + dx : value + dy)),
          ),
        }
      : {}),
    updatedAt: Date.now(),
  };
}

/**
 * Resize a mark to a new box, carrying its strokes along proportionally.
 *
 * A degenerate source box would divide by zero, so a mark with no extent is only moved.
 */
export function resizeMark(mark: PdfMark, next: PdfRect): PdfMark {
  const [ax1, ay1, ax2, ay2] = mark.rect;
  const [bx1, by1, bx2, by2] = normalizeRect(next);
  const sourceWidth = ax2 - ax1;
  const sourceHeight = ay2 - ay1;

  if (sourceWidth === 0 || sourceHeight === 0) return moveMark(mark, bx1 - ax1, by1 - ay1);

  const scaleX = (bx2 - bx1) / sourceWidth;
  const scaleY = (by2 - by1) / sourceHeight;

  return {
    ...mark,
    rect: [bx1, by1, bx2, by2],
    ...(mark.paths
      ? {
          paths: mark.paths.map((path) =>
            path.map((value, index) =>
              index % 2 === 0 ? bx1 + (value - ax1) * scaleX : by1 + (value - ay1) * scaleY,
            ),
          ),
        }
      : {}),
    updatedAt: Date.now(),
  };
}

/** Marks on one page, oldest first, so later marks draw over earlier ones. */
export function marksOnPage(marks: readonly PdfMark[], page: number): PdfMark[] {
  return marks.filter((mark) => mark.page === page).sort((a, b) => a.createdAt - b.createdAt);
}

/** Page numbers that carry at least one mark, ascending. */
export function markedPages(marks: readonly PdfMark[]): number[] {
  const pages = new Set<number>();
  for (const mark of marks) pages.add(mark.page);
  return [...pages].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ form values */

/** What the reader typed, ticked or chose in an interactive form. */
export type PdfFieldValue = string | boolean | string[];

export interface PdfFormState {
  documentId: string;
  /** Keyed by the field's fully qualified name, exactly as the PDF spells it. */
  values: Record<string, PdfFieldValue>;
  updatedAt: number;
}

/** Drop anything that is not a value a PDF field can hold. */
export function normalizeFormValues(input: unknown): Record<string, PdfFieldValue> {
  if (typeof input !== 'object' || input === null) return {};
  const out: Record<string, PdfFieldValue> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'boolean') out[key] = value;
    else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      out[key] = value as string[];
    }
  }
  return out;
}
