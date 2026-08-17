import { describe, expect, it } from 'vitest';

import { tokenize } from '@lexipulse/core';

import { normalizeLookupWord, occurrencesOf } from './word-lookup';

const TEXT = [
  'Schnelllesen ist eine Technik. Lesen bleibt Lesen, auch beim Schnelllesen.',
  'Die anderen Verfahren versprechen mehr, als sie halten.',
  'Für die Übung braucht es nur einen Text und Geduld.',
].join('\n\n');

const tokens = tokenize(TEXT, { wpm: 350 }).tokens;

describe('normalizeLookupWord', () => {
  it('drops the punctuation a token carries with it', () => {
    expect(normalizeLookupWord('Schnelllesen.')).toBe('Schnelllesen');
    expect(normalizeLookupWord('„Wort",')).toBe('Wort');
  });

  it('keeps punctuation inside a word', () => {
    expect(normalizeLookupWord('US-Dollar')).toBe('US-Dollar');
  });

  it('collapses the whitespace of a multi-word selection', () => {
    expect(normalizeLookupWord('  eine   Technik ')).toBe('eine Technik');
  });

  it('is empty when nothing is left', () => {
    expect(normalizeLookupWord(' ... ')).toBe('');
  });
});

describe('occurrencesOf', () => {
  it('counts a word wherever it stands, punctuation and case included', () => {
    const found = occurrencesOf(tokens, 'Lesen,');
    expect(found.word).toBe('Lesen');
    expect(found.hits).toHaveLength(2);
    expect(found.capped).toBe(false);
  });

  it('does not count a word that only hides inside another one', () => {
    // "der" sits inside "anderen", and "Lesen" inside "Schnelllesen".
    expect(occurrencesOf(tokens, 'der').hits).toHaveLength(0);
    expect(occurrencesOf(tokens, 'Schnelllesen').hits).toHaveLength(2);
  });

  it('folds diacritics like the search does', () => {
    expect(occurrencesOf(tokens, 'Fur').hits).toHaveLength(1);
  });

  it('reports the chapter and a preview for every hit', () => {
    const [hit] = occurrencesOf(tokens, 'Technik').hits;
    expect(hit?.chapterIndex).toBe(0);
    expect(hit?.preview).toContain('Technik');
    expect(hit?.matchLength).toBe('technik'.length);
  });

  it('returns nothing for a selection without letters', () => {
    expect(occurrencesOf(tokens, '—').hits).toHaveLength(0);
  });
});
