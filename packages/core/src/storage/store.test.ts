import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings.js';
import type { Annotation, Bookmark, LexiDocument, ReadingProgress } from '../types.js';
import { MemoryDriver } from './driver.js';
import { LexiStore, SCHEMA_VERSION, computeStreak, dayKey } from './store.js';

function makeDoc(id: string, title = 'Buch'): LexiDocument {
  return {
    id,
    title,
    author: 'Autor',
    source: 'epub',
    origin: null,
    language: 'de',
    chapters: [{ id: 'c1', title: 'Kapitel', text: 'Ein Satz.', startToken: 0, tokenCount: 2 }],
    totalTokens: 2,
    wordCount: 2,
    coverDataUrl: null,
    createdAt: 1,
    updatedAt: 1,
    importReport: {
      source: 'epub',
      rawSections: 1,
      removed: { headers: 0, footers: 0, pageNumbers: 0, tableRows: 0, artifacts: 0 },
      dehyphenated: 0,
      notes: [],
      durationMs: 1,
    },
  };
}

describe('dayKey / computeStreak', () => {
  const day = 86_400_000;
  const now = new Date(2026, 7, 16, 12, 0, 0).getTime();

  it('formats a local date as YYYY-MM-DD', () => {
    expect(dayKey(now)).toBe('2026-08-16');
  });

  it('counts consecutive days ending today', () => {
    const daily = {
      [dayKey(now)]: 5,
      [dayKey(now - day)]: 3,
      [dayKey(now - 2 * day)]: 1,
    };
    expect(computeStreak(daily, now)).toBe(3);
  });

  it('keeps the streak alive when today has not been read yet', () => {
    const daily = { [dayKey(now - day)]: 3, [dayKey(now - 2 * day)]: 1 };
    expect(computeStreak(daily, now)).toBe(2);
  });

  it('breaks the streak after a missed day', () => {
    const daily = { [dayKey(now - 3 * day)]: 3 };
    expect(computeStreak(daily, now)).toBe(0);
  });

  it('is zero for an empty history', () => {
    expect(computeStreak({}, now)).toBe(0);
  });
});

describe('LexiStore', () => {
  let driver: MemoryDriver;
  let store: LexiStore;

  beforeEach(async () => {
    driver = new MemoryDriver();
    store = new LexiStore(driver);
    await store.init();
  });

  it('stamps the schema version on first init', async () => {
    expect(await driver.get('lexi:schema')).toBe(String(SCHEMA_VERSION));
  });

  describe('settings', () => {
    it('returns defaults when nothing is stored', async () => {
      expect(await store.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('round-trips saved settings', async () => {
      await store.saveSettings({ ...DEFAULT_SETTINGS, wpm: 700, theme: 'sepia' });
      const loaded = await store.getSettings();
      expect(loaded.wpm).toBe(700);
      expect(loaded.theme).toBe('sepia');
    });

    it('repairs corrupt JSON instead of throwing', async () => {
      await driver.set('lexi:settings', '{not json');
      expect(await store.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('coerces out-of-range values written by an older build', async () => {
      await driver.set('lexi:settings', JSON.stringify({ wpm: 99_999, theme: 'neon' }));
      const loaded = await store.getSettings();
      expect(loaded.wpm).toBe(1200);
      expect(loaded.theme).toBe('oled');
    });
  });

  describe('documents', () => {
    it('saves, reads and lists documents newest first', async () => {
      await store.saveDocument(makeDoc('a', 'Erstes'));
      await new Promise((r) => setTimeout(r, 2));
      await store.saveDocument(makeDoc('b', 'Zweites'));

      expect((await store.getDocument('a'))?.title).toBe('Erstes');
      expect((await store.listDocuments()).map((d) => d.id)).toEqual(['b', 'a']);
    });

    it('returns null for an unknown id', async () => {
      expect(await store.getDocument('nope')).toBeNull();
    });

    it('deleting a document also removes its progress and bookmarks', async () => {
      await store.saveDocument(makeDoc('a'));
      await store.saveProgress({
        documentId: 'a',
        tokenIndex: 5,
        chapterIndex: 0,
        percent: 0.1,
        updatedAt: 1,
        msRead: 100,
      });
      await store.addBookmark({
        id: 'bm1',
        documentId: 'a',
        tokenIndex: 5,
        chapterIndex: 0,
        preview: 'Ein Satz',
        note: null,
        createdAt: 1,
      });

      await store.deleteDocument('a');
      expect(await store.getDocument('a')).toBeNull();
      expect(await store.getProgress('a')).toBeNull();
      expect(await store.listBookmarks('a')).toEqual([]);
    });

    it('skips corrupt entries when listing instead of failing the whole library', async () => {
      await store.saveDocument(makeDoc('a'));
      await driver.set('lexi:doc:broken', 'not json at all');
      expect((await store.listDocuments()).map((d) => d.id)).toEqual(['a']);
    });
  });

  describe('progress', () => {
    it('round-trips and overwrites the position', async () => {
      const progress: ReadingProgress = {
        documentId: 'a',
        tokenIndex: 12,
        chapterIndex: 1,
        percent: 0.3,
        updatedAt: 1,
        msRead: 5_000,
      };
      await store.saveProgress(progress);
      expect((await store.getProgress('a'))?.tokenIndex).toBe(12);

      await store.saveProgress({ ...progress, tokenIndex: 40 });
      expect((await store.getProgress('a'))?.tokenIndex).toBe(40);
    });
  });

  describe('bookmarks', () => {
    const mark = (id: string, tokenIndex: number, documentId = 'a'): Bookmark => ({
      id,
      documentId,
      tokenIndex,
      chapterIndex: 0,
      preview: `bei ${tokenIndex}`,
      note: null,
      createdAt: tokenIndex,
    });

    it('lists a document\'s bookmarks in reading order', async () => {
      await store.addBookmark(mark('b', 30));
      await store.addBookmark(mark('a', 10));
      expect((await store.listBookmarks('a')).map((m) => m.tokenIndex)).toEqual([10, 30]);
    });

    it('keeps bookmarks of different documents apart', async () => {
      await store.addBookmark(mark('a', 10, 'doc1'));
      await store.addBookmark(mark('b', 20, 'doc2'));
      expect(await store.listBookmarks('doc1')).toHaveLength(1);
      expect(await store.listAllBookmarks()).toHaveLength(2);
    });

    it('deletes a single bookmark', async () => {
      await store.addBookmark(mark('a', 10));
      await store.deleteBookmark('a', 'a');
      expect(await store.listBookmarks('a')).toEqual([]);
    });
  });

  describe('stats', () => {
    const now = new Date(2026, 7, 16, 12, 0, 0).getTime();

    it('starts empty', async () => {
      const stats = await store.getStats();
      expect(stats.totalTokensRead).toBe(0);
      expect(stats.averageWpm).toBe(0);
      expect(stats.streakDays).toBe(0);
    });

    it('accumulates sessions and derives the average WPM', async () => {
      await store.recordSession({ tokensRead: 300, msRead: 60_000, started: true, now });
      const stats = await store.recordSession({ tokensRead: 300, msRead: 60_000, now });
      expect(stats.totalTokensRead).toBe(600);
      expect(stats.averageWpm).toBeCloseTo(300, 5);
      expect(stats.documentsStarted).toBe(1);
      expect(stats.daily['2026-08-16']).toBe(600);
      expect(stats.streakDays).toBe(1);
    });

    it('counts finished documents', async () => {
      const stats = await store.recordSession({
        tokensRead: 10,
        msRead: 1_000,
        finished: true,
        now,
      });
      expect(stats.documentsFinished).toBe(1);
    });

    it('ignores negative input rather than corrupting the totals', async () => {
      const stats = await store.recordSession({ tokensRead: -50, msRead: -1_000, now });
      expect(stats.totalTokensRead).toBe(0);
      expect(stats.totalMsRead).toBe(0);
    });
  });

  describe('export and import', () => {
    it('round-trips the whole library through JSON', async () => {
      await store.saveDocument(makeDoc('a', 'Erstes'));
      await store.saveSettings({ ...DEFAULT_SETTINGS, wpm: 555 });
      await store.saveProgress({
        documentId: 'a',
        tokenIndex: 3,
        chapterIndex: 0,
        percent: 0.5,
        updatedAt: 1,
        msRead: 10,
      });
      await store.addBookmark({
        id: 'bm',
        documentId: 'a',
        tokenIndex: 3,
        chapterIndex: 0,
        preview: 'x',
        note: 'Notiz',
        createdAt: 1,
      });

      const json = await store.exportAll();

      const fresh = new LexiStore(new MemoryDriver());
      await fresh.init();
      const result = await fresh.importAll(json);

      expect(result.documents).toBe(1);
      expect(result.bookmarks).toBe(1);
      expect((await fresh.getSettings()).wpm).toBe(555);
      expect((await fresh.getDocument('a'))?.title).toBe('Erstes');
      expect((await fresh.getProgress('a'))?.tokenIndex).toBe(3);
      expect((await fresh.listBookmarks('a'))[0]?.note).toBe('Notiz');
    });

    it('exports valid JSON even when the library is empty', async () => {
      const parsed = JSON.parse(await store.exportAll()) as Record<string, unknown>;
      expect(parsed.documents).toEqual([]);
      expect(parsed.schema).toBe(SCHEMA_VERSION);
    });

    it('ignores garbage input instead of throwing', async () => {
      expect(await store.importAll('not json')).toEqual({ documents: 0, bookmarks: 0, annotations: 0 });
    });

    it('clearAll removes everything', async () => {
      await store.saveDocument(makeDoc('a'));
      await store.clearAll();
      expect(await store.listDocuments()).toEqual([]);
    });
  });
});

describe('annotations', () => {
  const make = (id: string, start: number): Annotation => ({
    id,
    documentId: 'doc-a',
    startToken: start,
    endToken: start + 4,
    chapterIndex: 0,
    color: 'yellow',
    text: 'ein markierter Satz',
    note: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it('stores, lists in reading order, and deletes', async () => {
    const store = new LexiStore(new MemoryDriver());
    await store.init();
    await store.saveAnnotation(make('b', 90));
    await store.saveAnnotation(make('a', 10));

    const list = await store.listAnnotations('doc-a');
    expect(list.map((a) => a.id)).toEqual(['a', 'b']);

    await store.deleteAnnotation('doc-a', 'a');
    expect((await store.listAnnotations('doc-a')).map((a) => a.id)).toEqual(['b']);
  });

  it('does not leave orphans behind when the document goes', async () => {
    const store = new LexiStore(new MemoryDriver());
    await store.init();
    await store.saveDocument(makeDoc('doc-a'));
    await store.saveAnnotation(make('a', 10));

    await store.deleteDocument('doc-a');
    expect(await store.listAnnotations('doc-a')).toEqual([]);
  });

  it('survives a round trip through export and import', async () => {
    const source = new LexiStore(new MemoryDriver());
    await source.init();
    await source.saveDocument(makeDoc('doc-a'));
    await source.saveAnnotation(make('a', 10));

    const target = new LexiStore(new MemoryDriver());
    await target.init();
    const result = await target.importAll(await source.exportAll());

    expect(result.annotations).toBe(1);
    expect((await target.listAnnotations('doc-a')).map((a) => a.id)).toEqual(['a']);
  });
});
