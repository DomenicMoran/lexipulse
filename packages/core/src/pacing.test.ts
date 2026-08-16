import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PACING,
  baseDurationMs,
  clampWpm,
  coreLength,
  effectiveWpm,
  effectiveWpmFor,
  endsWithClausePunct,
  endsWithSentencePunct,
  estimateDurationMs,
  repaceTokens,
  terminalChar,
  tokenDurationMs,
} from './pacing.js';
import { tokenize } from './tokenizer.js';

const plain = (text: string) => ({
  text,
  endsSentence: false,
  endsParagraph: false,
  isNumeric: false,
});

describe('clampWpm', () => {
  it('holds the 100–1200 contract', () => {
    expect(clampWpm(50)).toBe(100);
    expect(clampWpm(1500)).toBe(1200);
    expect(clampWpm(350)).toBe(350);
    expect(clampWpm(Number.NaN)).toBe(300);
  });
});

describe('baseDurationMs', () => {
  it('is the exact inverse of WPM', () => {
    expect(baseDurationMs(600)).toBe(100);
    expect(baseDurationMs(300)).toBe(200);
    expect(baseDurationMs(120)).toBe(500);
  });
});

describe('terminal punctuation detection', () => {
  it('peels trailing quotes and brackets before deciding', () => {
    expect(terminalChar('Ende."')).toBe('.');
    expect(endsWithSentencePunct('Ende."')).toBe(true);
    expect(endsWithSentencePunct('Ende")')).toBe(false);
    expect(endsWithClausePunct('dann,"')).toBe(true);
    expect(endsWithClausePunct('(Klammer)')).toBe(false);
  });
});

describe('coreLength', () => {
  it('counts only letters and digits', () => {
    expect(coreLength('Wort.')).toBe(4);
    expect(coreLength('„Wort"')).toBe(4);
    expect(coreLength('—')).toBe(0);
    expect(coreLength('Straße')).toBe(6);
  });
});

describe('tokenDurationMs', () => {
  const wpm = 300; // base = 200 ms

  it('gives a plain mid-length word the base duration', () => {
    expect(tokenDurationMs(plain('Wagen'), wpm)).toBeCloseTo(200, 5);
  });

  it('adds 25 % for words longer than 8 characters', () => {
    expect(coreLength('Entwicklung')).toBe(11);
    expect(tokenDurationMs(plain('Entwicklung'), wpm)).toBeCloseTo(200 * 1.25, 5);
  });

  it('does not treat an 8-character word as long — the rule is > 8', () => {
    expect(coreLength('Grundlag')).toBe(8);
    expect(tokenDurationMs(plain('Grundlag'), wpm)).toBeCloseTo(200, 5);
  });

  it('adds 75 % on sentence-ending punctuation', () => {
    expect(tokenDurationMs({ ...plain('Ende.'), endsSentence: true }, wpm)).toBeCloseTo(
      200 * 1.75,
      5,
    );
  });

  it('adds 75 % on clause punctuation too', () => {
    expect(tokenDurationMs(plain('dann,'), wpm)).toBeCloseTo(200 * 1.75, 5);
  });

  it('composes long-word and sentence-end multipliers', () => {
    expect(tokenDurationMs({ ...plain('Entwicklung.'), endsSentence: true }, wpm)).toBeCloseTo(
      200 * 1.25 * 1.75,
      5,
    );
  });

  it('speeds up short function words', () => {
    expect(tokenDurationMs(plain('der'), wpm)).toBeCloseTo(200 * 0.9, 5);
  });

  it('slows down tokens containing digits', () => {
    expect(tokenDurationMs({ ...plain('2026'), isNumeric: true }, wpm)).toBeCloseTo(200 * 1.4, 5);
  });

  it('applies the short-word bonus and the numeric penalty together', () => {
    expect(tokenDurationMs({ ...plain('42'), isNumeric: true }, wpm)).toBeCloseTo(
      200 * 0.9 * 1.4,
      5,
    );
  });

  it('doubles the dwell on a paragraph end', () => {
    expect(tokenDurationMs({ ...plain('Schluss'), endsParagraph: true }, wpm)).toBeCloseTo(
      200 * 2,
      5,
    );
  });

  it('never goes below the floor even at 1200 WPM', () => {
    const fast = tokenDurationMs(plain('es'), 1200, { ...DEFAULT_PACING, minDurationMs: 45 });
    expect(fast).toBe(45);
  });

  it('never exceeds the ceiling even at 100 WPM with every multiplier', () => {
    const slow = tokenDurationMs(
      { text: 'Verantwortungsbereich.', endsSentence: true, endsParagraph: true, isNumeric: true },
      100,
    );
    expect(slow).toBe(DEFAULT_PACING.maxDurationMs);
  });
});

describe('repaceTokens / estimateDurationMs / effectiveWpm', () => {
  const text = 'Der schnelle Fuchs springt. Ein langer Satz mit Entwicklung und Verantwortung.';

  it('halving the WPM roughly doubles the total time', () => {
    const slow = tokenize(text, { wpm: 200 }).tokens;
    const fast = tokenize(text, { wpm: 400 }).tokens;
    expect(estimateDurationMs(slow) / estimateDurationMs(fast)).toBeCloseTo(2, 5);
  });

  it('repaces an existing stream in place', () => {
    const tokens = tokenize(text, { wpm: 200 }).tokens;
    const before = estimateDurationMs(tokens);
    repaceTokens(tokens, 400);
    expect(estimateDurationMs(tokens)).toBeCloseTo(before / 2, 5);
  });

  it('reports an effective WPM below the nominal one, because pauses cost time', () => {
    const tokens = tokenize(text, { wpm: 400 }).tokens;
    const effective = effectiveWpm(tokens);
    expect(effective).toBeLessThan(400);
    expect(effective).toBeGreaterThan(200);
  });

  it('returns 0 for an empty range instead of NaN', () => {
    expect(effectiveWpm([])).toBe(0);
    expect(estimateDurationMs([])).toBe(0);
  });
});

describe('effectiveWpmFor', () => {
  const text = 'Der schnelle Fuchs springt. Ein langer Satz mit Entwicklung und Verantwortung.';

  it('agrees with effectiveWpm once the stream has been repaced', () => {
    const tokens = tokenize(text, { wpm: 500 }).tokens;
    expect(effectiveWpmFor(tokens, 500)).toBeCloseTo(effectiveWpm(tokens), 8);
  });

  it('answers for a speed the tokens were never paced to, without mutating them', () => {
    const tokens = tokenize(text, { wpm: 300 }).tokens;
    const before = tokens.map((t) => t.durationMs);

    const at900 = effectiveWpmFor(tokens, 900);
    const at200 = effectiveWpmFor(tokens, 200);

    expect(at900).toBeGreaterThan(at200);
    expect(tokens.map((t) => t.durationMs)).toEqual(before);
  });

  it('stays below the nominal WPM, because the pauses cost time', () => {
    const tokens = tokenize(text, { wpm: 300 }).tokens;
    expect(effectiveWpmFor(tokens, 600)).toBeLessThan(600);
  });

  it('returns 0 for an empty range', () => {
    expect(effectiveWpmFor([], 400)).toBe(0);
  });
});
