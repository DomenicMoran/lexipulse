import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenizer.js';
import {
  annotationsAt,
  bionicPrefix,
  fold,
  paragraphIndexOfToken,
  paragraphsOf,
  searchTokens,
  textOfRange,
} from './reader.js';
import type { Annotation } from './types.js';

const TEXT = [
  'Als Gregor Samsa eines Morgens erwachte, fand er sich verwandelt.',
  'Seine vielen Beine flimmerten ihm hilflos vor den Augen.',
  'Über dem Tisch hing das Bild einer Dame mit Pelzhut.',
].join('\n\n');

const tokens = tokenize(TEXT, { wpm: 350 }).tokens;

describe('paragraphsOf', () => {
  it('groups the stream into the paragraphs it came from', () => {
    const paragraphs = paragraphsOf(tokens);
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]?.tokens[0]?.text).toBe('Als');
    expect(paragraphs[1]?.tokens[0]?.text).toBe('Seine');
  });

  it('covers every token exactly once', () => {
    const covered = paragraphsOf(tokens).flatMap((p) => p.tokens.map((t) => t.index));
    expect(covered).toEqual(tokens.map((t) => t.index));
  });

  it('finds the paragraph a position sits in', () => {
    const paragraphs = paragraphsOf(tokens);
    const target = paragraphs[1]?.firstToken ?? 0;
    expect(paragraphIndexOfToken(paragraphs, target)).toBe(1);
    expect(paragraphIndexOfToken(paragraphs, 99_999)).toBe(-1);
  });
});

describe('searchTokens', () => {
  it('finds a word and points at the right token', () => {
    const [hit] = searchTokens(tokens, 'hilflos');
    expect(hit).toBeDefined();
    expect(tokens[hit?.tokenIndex ?? -1]?.text).toBe('hilflos');
  });

  it('matches across a word boundary', () => {
    const hits = searchTokens(tokens, 'eines Morgens');
    expect(hits).toHaveLength(1);
    expect(tokens[hits[0]?.tokenIndex ?? -1]?.text).toBe('eines');
  });

  it('ignores case and umlauts, so "uber" finds "Über"', () => {
    const hits = searchTokens(tokens, 'uber dem tisch');
    expect(hits).toHaveLength(1);
  });

  it('returns readable context, not the folded haystack', () => {
    const [hit] = searchTokens(tokens, 'Pelzhut');
    expect(hit?.preview).toContain('Pelzhut');
    expect(hit?.preview).not.toContain('pelzhut');
  });

  it('finds every occurrence rather than stopping at the first', () => {
    const many = tokenize('rot blau rot grün rot', { wpm: 350 }).tokens;
    expect(searchTokens(many, 'rot')).toHaveLength(3);
  });

  it('treats an empty query as no search', () => {
    expect(searchTokens(tokens, '   ')).toEqual([]);
  });
});

describe('fold', () => {
  it('keeps the length stable, or the offset map breaks', () => {
    for (const word of ['Über', 'Fähigkeit', 'straße', 'çà', 'œuvre']) {
      expect(fold(word)).toHaveLength(word.length);
    }
  });
});

describe('bionicPrefix', () => {
  it('emboldens nothing when it is off', () => {
    expect(bionicPrefix('Morgens', 0)).toBe(0);
  });

  it('never covers the whole word', () => {
    for (const word of ['zu', 'und', 'Morgens', 'Musterkollektion']) {
      for (let strength = 1; strength <= 5; strength += 1) {
        const letters = word.replace(/[^\p{L}\p{N}]/gu, '').length;
        expect(bionicPrefix(word, strength)).toBeLessThan(letters);
      }
    }
  });

  it('grows with strength', () => {
    const weak = bionicPrefix('Musterkollektion', 1);
    const strong = bionicPrefix('Musterkollektion', 5);
    expect(strong).toBeGreaterThan(weak);
  });

  it('ignores punctuation when counting letters', () => {
    expect(bionicPrefix('verwandelt.', 3)).toBe(bionicPrefix('verwandelt', 3));
  });
});

describe('annotations', () => {
  const make = (start: number, end: number): Annotation => ({
    id: `a${start}`,
    documentId: 'doc',
    startToken: start,
    endToken: end,
    chapterIndex: 0,
    color: 'yellow',
    text: '',
    note: null,
    createdAt: 0,
    updatedAt: 0,
  });

  it('reports the ones covering a token', () => {
    const list = [make(0, 3), make(2, 8)];
    expect(annotationsAt(list, 1).map((a) => a.id)).toEqual(['a0']);
    expect(annotationsAt(list, 3).map((a) => a.id)).toEqual(['a0', 'a2']);
    expect(annotationsAt(list, 9)).toEqual([]);
  });

  it('reads back the text of a range', () => {
    expect(textOfRange(tokens, 0, 2)).toBe('Als Gregor Samsa');
  });
});
