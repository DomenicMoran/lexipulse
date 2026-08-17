import type { LexiDocument, LibraryEntry } from '@lexipulse/core';
import { describe, expect, it } from 'vitest';
import { activeTagOf, allTagsOf, matchingEntries } from './library-filter';

function entry(id: string, title: string, author: string | null = null): LibraryEntry {
  const document = { id, title, author } as LexiDocument;
  return { document, progress: null };
}

const LIBRARY = [
  entry('a', 'Der Prozess', 'Franz Kafka'),
  entry('b', 'Grundgesetz'),
  entry('c', 'Über Bäume'),
];

const TAGS = { a: ['Roman'], b: ['recht', 'Nachschlagewerk'], c: ['Recht'] };

describe('allTagsOf', () => {
  it('folds spellings into one shelf and keeps the first one seen', () => {
    expect(allTagsOf(TAGS)).toEqual(['Nachschlagewerk', 'recht', 'Roman']);
  });

  it('is empty for a library without tags', () => {
    expect(allTagsOf({})).toEqual([]);
  });
});

describe('activeTagOf', () => {
  it('keeps a selection that still exists', () => {
    expect(activeTagOf(['Roman', 'recht'], 'recht')).toBe('recht');
  });

  it('drops a selection whose tag is gone, so no invisible filter is left behind', () => {
    expect(activeTagOf(['Roman'], 'recht')).toBeNull();
  });
});

describe('matchingEntries', () => {
  it('filters by the folded tag, not by its spelling', () => {
    const visible = matchingEntries(LIBRARY, TAGS, 'recht', '');
    expect(visible.map((item) => item.document.id)).toEqual(['b', 'c']);
  });

  it('searches titles, authors and tags at once', () => {
    expect(matchingEntries(LIBRARY, TAGS, null, 'kafka').map((i) => i.document.id)).toEqual(['a']);
    expect(matchingEntries(LIBRARY, TAGS, null, 'nachschlage').map((i) => i.document.id)).toEqual([
      'b',
    ]);
  });

  it('folds diacritics, so "uber" finds "Über"', () => {
    expect(matchingEntries(LIBRARY, TAGS, null, 'uber').map((i) => i.document.id)).toEqual(['c']);
  });

  it('applies tag and query together', () => {
    expect(matchingEntries(LIBRARY, TAGS, 'recht', 'grund').map((i) => i.document.id)).toEqual([
      'b',
    ]);
  });

  it('returns everything when nothing is asked for', () => {
    expect(matchingEntries(LIBRARY, TAGS, null, '   ')).toHaveLength(3);
  });
});
