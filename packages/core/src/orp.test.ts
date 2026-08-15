import { describe, expect, it } from 'vitest';
import { computeOrp, maxOrpIndex, orpForLength, orpOffsetChars, splitAtOrp } from './orp.js';

describe('orpForLength', () => {
  it('follows the Spritz distribution and never drifts past index 4', () => {
    expect(orpForLength(0)).toBe(0);
    expect(orpForLength(1)).toBe(0);
    expect(orpForLength(2)).toBe(1);
    expect(orpForLength(5)).toBe(1);
    expect(orpForLength(6)).toBe(2);
    expect(orpForLength(9)).toBe(2);
    expect(orpForLength(10)).toBe(3);
    expect(orpForLength(13)).toBe(3);
    expect(orpForLength(14)).toBe(4);
    expect(orpForLength(40)).toBe(4);
  });
});

describe('computeOrp', () => {
  it('pivots on the same letter with and without leading punctuation', () => {
    expect(computeOrp('Hallo')).toBe(1);
    expect(computeOrp('"Hallo')).toBe(2);
    expect(computeOrp('(Hallo')).toBe(2);
    expect(computeOrp('„Hallo')).toBe(2);
  });

  it('ignores trailing punctuation when sizing the core', () => {
    // "Wort" (4) and "Wort." (still core 4) must share a pivot.
    expect(computeOrp('Wort')).toBe(computeOrp('Wort.'));
    expect(computeOrp('Entscheidung')).toBe(computeOrp('Entscheidung,'));
  });

  it('handles single characters and empty input', () => {
    expect(computeOrp('a')).toBe(0);
    expect(computeOrp('')).toBe(0);
  });

  it('pivots on the middle for pure punctuation', () => {
    expect(computeOrp('—')).toBe(0);
    expect(computeOrp('...')).toBe(1);
  });

  it('counts umlauts and accents as single characters', () => {
    expect(computeOrp('Übermut')).toBe(2);
    expect(computeOrp('café')).toBe(1);
  });

  it('never returns an index outside the string', () => {
    for (const word of ['a', 'ab', '"a"', '((', 'Donaudampfschifffahrt']) {
      const orp = computeOrp(word);
      expect(orp).toBeGreaterThanOrEqual(0);
      expect(orp).toBeLessThan(Math.max(Array.from(word).length, 1));
    }
  });
});

describe('splitAtOrp', () => {
  it('round-trips to the original word', () => {
    for (const word of ['Hallo', 'Weltuntergang!', '„Zitat"', 'x', 'Straße']) {
      const { before, pivot, after } = splitAtOrp(word);
      expect(before + pivot + after).toBe(word);
    }
  });

  it('keeps surrogate pairs intact', () => {
    const { before, pivot, after } = splitAtOrp('a🚀b');
    expect(before + pivot + after).toBe('a🚀b');
    expect(Array.from(pivot).length).toBe(1);
  });

  it('clamps an out-of-range index instead of throwing', () => {
    expect(splitAtOrp('ab', 99).pivot).toBe('b');
    expect(splitAtOrp('ab', -5).pivot).toBe('a');
  });

  it('returns empty segments for an empty word', () => {
    expect(splitAtOrp('')).toEqual({ before: '', pivot: '', after: '', index: 0 });
  });
});

describe('orpOffsetChars', () => {
  it('shifts every word so its pivot lands on the focus column', () => {
    const focus = 10;
    for (const word of ['a', 'Hallo', 'Verantwortungsbewusstsein']) {
      expect(computeOrp(word) + orpOffsetChars(word, focus)).toBe(focus);
    }
  });
});

describe('maxOrpIndex', () => {
  it('reports the widest pivot in a stream', () => {
    expect(maxOrpIndex(['a', 'Hallo', 'Verantwortung'])).toBe(3);
    expect(maxOrpIndex([])).toBe(0);
  });
});
