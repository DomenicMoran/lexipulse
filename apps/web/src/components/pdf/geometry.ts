import type { PageSize } from './pdf-doc';

/**
 * The one conversion between the two coordinate systems on this screen.
 *
 * A PDF measures in points from the bottom-left corner and may declare that the page is
 * to be shown turned. The browser measures in CSS pixels from the top-left corner of an
 * already-turned box. Every mark, every search hit and every link rectangle crosses that
 * boundary, so it is written once, here, and tested — a sign error in this file puts a
 * highlight a page-width away from the word it belongs to, and only on rotated pages.
 */

/** Normalised turn: 0, 90, 180 or 270. */
export function normalizeTurn(rotation: number): 0 | 90 | 180 | 270 {
  const turn = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return turn as 0 | 90 | 180 | 270;
}

/** Size of the rendered box in CSS pixels, after turning and zooming. */
export function boxSize(
  size: PageSize,
  scale: number,
  rotation: number,
): { width: number; height: number } {
  const turn = normalizeTurn(rotation);
  const swapped = turn === 90 || turn === 270;
  return {
    width: (swapped ? size.height : size.width) * scale,
    height: (swapped ? size.width : size.height) * scale,
  };
}

/** A point in PDF space → its offset inside the rendered box, in CSS pixels. */
export function pdfToBox(
  x: number,
  y: number,
  size: PageSize,
  scale: number,
  rotation: number,
): { left: number; top: number } {
  switch (normalizeTurn(rotation)) {
    case 90:
      return { left: (size.height - y) * scale, top: x * scale };
    case 180:
      return { left: (size.width - x) * scale, top: y * scale };
    case 270:
      return { left: y * scale, top: (size.width - x) * scale };
    default:
      return { left: x * scale, top: (size.height - y) * scale };
  }
}

/** An offset inside the rendered box → the point in PDF space it sits on. */
export function boxToPdf(
  left: number,
  top: number,
  size: PageSize,
  scale: number,
  rotation: number,
): { x: number; y: number } {
  switch (normalizeTurn(rotation)) {
    case 90:
      return { x: top / scale, y: size.height - left / scale };
    case 180:
      return { x: size.width - left / scale, y: top / scale };
    case 270:
      return { x: size.width - top / scale, y: left / scale };
    default:
      return { x: left / scale, y: size.height - top / scale };
  }
}

/**
 * A rectangle in PDF points → the CSS box that covers it.
 *
 * Both corners are converted and the result is normalised, because a turn of 90° swaps
 * which corner is which and a negative width draws nothing at all.
 */
export function rectToStyle(
  rect: readonly number[],
  size: PageSize,
  scale: number,
  rotation: number,
): { left: number; top: number; width: number; height: number } {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = rect;
  const a = pdfToBox(x1, y1, size, scale, rotation);
  const b = pdfToBox(x2, y2, size, scale, rotation);
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    width: Math.abs(b.left - a.left),
    height: Math.abs(b.top - a.top),
  };
}

/** The pointer's position inside a page element, in PDF points. */
export function pointerToPdf(
  event: { clientX: number; clientY: number },
  element: HTMLElement,
  size: PageSize,
  scale: number,
  rotation: number,
): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return boxToPdf(event.clientX - box.left, event.clientY - box.top, size, scale, rotation);
}

/** Keep a point inside the page, so a drag off the edge does not place a mark outside it. */
export function clampToPage(
  point: { x: number; y: number },
  size: PageSize,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(point.x, 0), size.width),
    y: Math.min(Math.max(point.y, 0), size.height),
  };
}
