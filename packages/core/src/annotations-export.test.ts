import { describe, expect, it } from 'vitest';
import { highlightsFileName, highlightsToMarkdown } from './annotations-export.js';
import type { Annotation, LexiDocument } from './types.js';

const doc: Pick<LexiDocument, 'title' | 'author' | 'chapters'> = {
  title: 'Die Verwandlung',
  author: 'Franz Kafka',
  chapters: [
    { id: 'a', title: 'Erstes Kapitel', text: '', startToken: 0, tokenCount: 0 },
    { id: 'b', title: 'Zweites Kapitel', text: '', startToken: 0, tokenCount: 0 },
  ],
};

const mark = (over: Partial<Annotation>): Annotation => ({
  id: 'x',
  documentId: 'd',
  startToken: 0,
  endToken: 1,
  chapterIndex: 0,
  color: 'yellow',
  text: 'Ein markierter Satz.',
  note: null,
  createdAt: 0,
  ...over,
});

describe('highlightsToMarkdown', () => {
  it('names the document and its author', () => {
    const md = highlightsToMarkdown(doc, [mark({})]);
    expect(md).toContain('# Die Verwandlung');
    expect(md).toContain('*Franz Kafka*');
  });

  it('groups by chapter and keeps reading order, not the order they were made', () => {
    const md = highlightsToMarkdown(doc, [
      mark({ id: '2', chapterIndex: 1, startToken: 5, text: 'Spaeter markiert.' }),
      mark({ id: '1', chapterIndex: 0, startToken: 9, text: 'Zuerst im Buch.' }),
    ]);
    expect(md.indexOf('Zuerst im Buch.')).toBeLessThan(md.indexOf('Spaeter markiert.'));
    expect(md.indexOf('## Erstes Kapitel')).toBeLessThan(md.indexOf('## Zweites Kapitel'));
  });

  it('quotes every line, so a passage across a break stays one quote', () => {
    const md = highlightsToMarkdown(doc, [mark({ text: 'Erste Zeile.\n\nZweite Zeile.' })]);
    expect(md).toContain('> Erste Zeile.');
    expect(md).toContain('> Zweite Zeile.');
  });

  it('carries the note when there is one', () => {
    const md = highlightsToMarkdown(doc, [mark({ note: 'Nachschlagen' })]);
    expect(md).toContain('**Notiz:** Nachschlagen');
  });

  it('names the colour in the chosen language', () => {
    expect(highlightsToMarkdown(doc, [mark({ color: 'green' })])).toContain('Farbe: Grün');
    expect(highlightsToMarkdown(doc, [mark({ color: 'green' })], { language: 'en' })).toContain(
      'Colour: Green',
    );
  });

  it('says so instead of producing an empty file', () => {
    expect(highlightsToMarkdown(doc, [])).toContain('Keine Markierungen.');
    expect(highlightsToMarkdown(doc, [], { language: 'en' })).toContain('No highlights.');
  });

  it('counts in the singular when there is one', () => {
    expect(highlightsToMarkdown(doc, [mark({})])).toContain('1 Markierung\n');
    expect(highlightsToMarkdown(doc, [mark({}), mark({ id: 'y' })])).toContain('2 Markierungen');
  });

  it('falls back to a chapter number when the chapter has no title', () => {
    const untitled = { ...doc, chapters: [{ id: 'a', title: '', text: '', startToken: 0, tokenCount: 0 }] };
    expect(highlightsToMarkdown(untitled, [mark({})])).toContain('## 1');
  });

  it('uses no em dash, which the project bars from anything a reader sees', () => {
    const md = highlightsToMarkdown(doc, [mark({ note: 'Eine Notiz' })], { exportedAt: 0 });
    expect(md).not.toContain('\u2014');
  });
});

describe('highlightsFileName', () => {
  it('folds a title into something every file system accepts', () => {
    expect(highlightsFileName('Die Verwandlung')).toBe('die-verwandlung-markierungen.md');
    expect(highlightsFileName('Über dem Tisch')).toBe('uber-dem-tisch-markierungen.md');
  });

  it('still returns a name when the title folds away to nothing', () => {
    expect(highlightsFileName('!!!')).toBe('markierungen-markierungen.md');
  });
});
