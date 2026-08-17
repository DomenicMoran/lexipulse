import { describe, expect, it } from 'vitest';
import {
  boundsOfPaths,
  createMark,
  markedPages,
  marksOnPage,
  moveMark,
  normalizeFormValues,
  normalizeRect,
  resizeMark,
  type PdfMark,
} from './pdf-marks.js';

describe('normalizeRect', () => {
  it('orders the corners whichever way the drag went', () => {
    expect(normalizeRect([100, 200, 40, 80])).toEqual([40, 80, 100, 200]);
    expect(normalizeRect([40, 80, 100, 200])).toEqual([40, 80, 100, 200]);
  });

  it('tolerates a short array', () => {
    expect(normalizeRect([])).toEqual([0, 0, 0, 0]);
  });
});

describe('boundsOfPaths', () => {
  it('contains every point and half the pen width', () => {
    expect(boundsOfPaths([[10, 10, 30, 50]], 4)).toEqual([8, 8, 32, 52]);
  });

  it('spans several strokes', () => {
    expect(boundsOfPaths([[10, 10], [100, 5, 20, 60]], 0)).toEqual([10, 5, 100, 60]);
  });

  it('is empty for no strokes', () => {
    expect(boundsOfPaths([], 2)).toEqual([0, 0, 0, 0]);
  });
});

describe('createMark', () => {
  it('applies the defaults for its kind', () => {
    const mark = createMark({ documentId: 'd', page: 3, kind: 'highlight', rect: [0, 0, 10, 10] });
    expect(mark.color).toBe('#ffd400');
    expect(mark.opacity).toBe(0.4);
    expect(mark.page).toBe(3);
  });

  it('lets the caller override every default', () => {
    const mark = createMark({
      documentId: 'd',
      page: 1,
      kind: 'ink',
      rect: [0, 0, 0, 0],
      color: '#00ff00',
      opacity: 0.5,
      strokeWidth: 6,
    });
    expect(mark).toMatchObject({ color: '#00ff00', opacity: 0.5, strokeWidth: 6 });
  });

  it('derives the box from the strokes when there are strokes', () => {
    const mark = createMark({
      documentId: 'd',
      page: 1,
      kind: 'ink',
      rect: [0, 0, 0, 0],
      paths: [[20, 20, 60, 90]],
      strokeWidth: 2,
    });
    expect(mark.rect).toEqual([19, 19, 61, 91]);
  });

  it('never lets a page number fall below one', () => {
    expect(createMark({ documentId: 'd', page: 0, kind: 'rect', rect: [0, 0, 1, 1] }).page).toBe(1);
  });

  it('gives every mark its own id', () => {
    const a = createMark({ documentId: 'd', page: 1, kind: 'rect', rect: [0, 0, 1, 1] });
    const b = createMark({ documentId: 'd', page: 1, kind: 'rect', rect: [0, 0, 1, 1] });
    expect(a.id).not.toBe(b.id);
  });
});

describe('moveMark', () => {
  it('moves the box and the strokes by the same amount', () => {
    const mark = createMark({
      documentId: 'd',
      page: 1,
      kind: 'ink',
      rect: [0, 0, 0, 0],
      paths: [[10, 10, 20, 30]],
      strokeWidth: 0,
    });
    const moved = moveMark(mark, 5, -3);
    expect(moved.rect).toEqual([15, 7, 25, 27]);
    expect(moved.paths?.[0]).toEqual([15, 7, 25, 27]);
  });
});

describe('resizeMark', () => {
  it('scales the strokes with the box', () => {
    const mark = createMark({
      documentId: 'd',
      page: 1,
      kind: 'ink',
      rect: [0, 0, 0, 0],
      paths: [[0, 0, 10, 10]],
      strokeWidth: 0,
    });
    const resized = resizeMark(mark, [0, 0, 20, 20]);
    expect(resized.rect).toEqual([0, 0, 20, 20]);
    expect(resized.paths?.[0]).toEqual([0, 0, 20, 20]);
  });

  it('normalises a box dragged inside out', () => {
    const mark = createMark({ documentId: 'd', page: 1, kind: 'rect', rect: [0, 0, 10, 10] });
    expect(resizeMark(mark, [30, 40, 10, 20]).rect).toEqual([10, 20, 30, 40]);
  });

  it('only moves a mark with no extent, instead of dividing by zero', () => {
    const mark = createMark({ documentId: 'd', page: 1, kind: 'note', rect: [5, 5, 5, 5] });
    const resized = resizeMark(mark, [9, 9, 9, 9]);
    expect(resized.rect).toEqual([9, 9, 9, 9]);
    expect(Number.isNaN(resized.rect[0])).toBe(false);
  });
});

describe('marksOnPage', () => {
  const marks: PdfMark[] = [
    { ...createMark({ documentId: 'd', page: 2, kind: 'rect', rect: [0, 0, 1, 1] }), createdAt: 30 },
    { ...createMark({ documentId: 'd', page: 1, kind: 'rect', rect: [0, 0, 1, 1] }), createdAt: 20 },
    { ...createMark({ documentId: 'd', page: 2, kind: 'rect', rect: [0, 0, 1, 1] }), createdAt: 10 },
  ];

  it('keeps only that page, oldest first so later marks draw on top', () => {
    expect(marksOnPage(marks, 2).map((m) => m.createdAt)).toEqual([10, 30]);
  });

  it('lists the pages that carry a mark', () => {
    expect(markedPages(marks)).toEqual([1, 2]);
  });
});

describe('normalizeFormValues', () => {
  it('keeps text, ticks and multiple choices', () => {
    expect(
      normalizeFormValues({ name: 'Domenic', ok: true, wahl: ['a', 'b'] }),
    ).toEqual({ name: 'Domenic', ok: true, wahl: ['a', 'b'] });
  });

  it('drops anything a field cannot hold', () => {
    expect(normalizeFormValues({ a: 5, b: null, c: { d: 1 }, e: [1, 2] })).toEqual({});
  });

  it('tolerates rubbish instead of throwing', () => {
    expect(normalizeFormValues(null)).toEqual({});
    expect(normalizeFormValues('nope')).toEqual({});
  });
});
