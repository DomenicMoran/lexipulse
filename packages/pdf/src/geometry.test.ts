import { describe, expect, it } from 'vitest';
import {
  boxSize,
  boxToPdf,
  clampToPage,
  normalizeTurn,
  pdfToBox,
  rectToStyle,
} from './geometry.js';

/** A4 in points. Portrait, so a turn is visible in the numbers. */
const A4 = { width: 595, height: 842 };

describe('normalizeTurn', () => {
  it('folds anything into the four quarters', () => {
    expect(normalizeTurn(0)).toBe(0);
    expect(normalizeTurn(450)).toBe(90);
    expect(normalizeTurn(-90)).toBe(270);
    expect(normalizeTurn(360)).toBe(0);
  });
});

describe('boxSize', () => {
  it('swaps the sides on a quarter turn', () => {
    expect(boxSize(A4, 1, 0)).toEqual({ width: 595, height: 842 });
    expect(boxSize(A4, 1, 90)).toEqual({ width: 842, height: 595 });
    expect(boxSize(A4, 2, 180)).toEqual({ width: 1190, height: 1684 });
  });
});

describe('pdfToBox and boxToPdf', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 595, y: 842 },
    { x: 100, y: 700 },
    { x: 300, y: 42 },
  ];

  for (const rotation of [0, 90, 180, 270]) {
    for (const scale of [1, 1.75]) {
      it(`round-trips every corner at ${rotation}° and ${scale}×`, () => {
        for (const point of points) {
          const box = pdfToBox(point.x, point.y, A4, scale, rotation);
          const back = boxToPdf(box.left, box.top, A4, scale, rotation);
          expect(back.x).toBeCloseTo(point.x, 6);
          expect(back.y).toBeCloseTo(point.y, 6);
        }
      });
    }
  }

  it('puts the origin where the reader sees it, unturned', () => {
    // PDF (0,0) is the bottom-left corner: bottom of the box, left edge.
    expect(pdfToBox(0, 0, A4, 1, 0)).toEqual({ left: 0, top: 842 });
    expect(pdfToBox(0, 842, A4, 1, 0)).toEqual({ left: 0, top: 0 });
  });

  it('turns the top-left corner to the top-right at 90°', () => {
    // Turned a quarter clockwise, the top-left of the page ends up top-right of the box.
    const box = pdfToBox(0, 842, A4, 1, 90);
    expect(box).toEqual({ left: 0, top: 0 });
    expect(pdfToBox(0, 0, A4, 1, 90)).toEqual({ left: 842, top: 0 });
  });

  it('scales linearly', () => {
    expect(pdfToBox(100, 742, A4, 2, 0)).toEqual({ left: 200, top: 200 });
  });
});

describe('rectToStyle', () => {
  it('covers the rectangle, unturned', () => {
    expect(rectToStyle([100, 700, 300, 742], A4, 1, 0)).toEqual({
      left: 100,
      top: 100,
      width: 200,
      height: 42,
    });
  });

  it('never produces a negative size, whichever way the page is turned', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const style = rectToStyle([300, 742, 100, 700], A4, 1.4, rotation);
      expect(style.width).toBeGreaterThan(0);
      expect(style.height).toBeGreaterThan(0);
    }
  });

  it('swaps width and height on a quarter turn', () => {
    const upright = rectToStyle([100, 700, 300, 742], A4, 1, 0);
    const turned = rectToStyle([100, 700, 300, 742], A4, 1, 90);
    expect(turned.width).toBeCloseTo(upright.height, 6);
    expect(turned.height).toBeCloseTo(upright.width, 6);
  });
});

describe('clampToPage', () => {
  it('keeps a drag that left the page on the page', () => {
    expect(clampToPage({ x: -40, y: 2000 }, A4)).toEqual({ x: 0, y: 842 });
    expect(clampToPage({ x: 300, y: 300 }, A4)).toEqual({ x: 300, y: 300 });
  });
});
