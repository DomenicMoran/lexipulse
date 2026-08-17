import { beforeEach, describe, expect, it } from 'vitest';
import { LexiStore, computeStreak, dayKey } from './store.js';
import { MemoryDriver } from './driver.js';
import {
  annotationKey,
  bookmarkKey,
  documentFingerprint,
  inspectBackup,
  mergeDaily,
  mergeStats,
  newerProgress,
} from './merge.js';
import type { Annotation, Bookmark, LexiDocument, ReadingProgress, ReadingStats } from '../types.js';

function doc(id: string, title: string, text: string, wordCount = text.split(/\s+/).length): LexiDocument {
  return {
    id,
    title,
    author: null,
    source: 'text',
    origin: null,
    language: null,
    chapters: [{ id: `${id}-1`, title, text, startToken: 0, tokenCount: 0 }],
    coverDataUrl: null,
    importReport: {
      source: 'text',
      rawSections: 1,
      removed: { headers: 0, footers: 0, pageNumbers: 0, tableRows: 0, artifacts: 0 },
      dehyphenated: 0,
      notes: [],
      durationMs: 0,
    },
    totalTokens: wordCount,
    wordCount,
    createdAt: 0,
    updatedAt: 0,
    startToken: 0,
    tokenCount: 0,
  } as unknown as LexiDocument;
}

describe('documentFingerprint', () => {
  it('is the same for the same text under different ids', () => {
    const a = doc('text_x_aaa', 'Buch', 'Ein Satz mit Inhalt.');
    const b = doc('text_x_bbb', 'Buch', 'Ein Satz mit Inhalt.');
    expect(documentFingerprint(a)).toBe(documentFingerprint(b));
  });

  it('differs for different text', () => {
    const a = doc('a', 'Buch', 'Ein Satz mit Inhalt.');
    const b = doc('b', 'Buch', 'Ein anderer Satz hier.');
    expect(documentFingerprint(a)).not.toBe(documentFingerprint(b));
  });

  it('does not depend on the title, only on what is read', () => {
    const a = doc('a', 'Titel A', 'Derselbe Text.');
    const b = doc('b', 'Ganz anderer Titel', 'Derselbe Text.');
    expect(documentFingerprint(a)).toBe(documentFingerprint(b));
  });
});

describe('mergeDaily', () => {
  it('takes the maximum, so reading the same backup twice does not double a day', () => {
    expect(mergeDaily({ '2026-08-17': 500 }, { '2026-08-17': 500 })).toEqual({ '2026-08-17': 500 });
  });

  it('keeps days only one side knows about', () => {
    expect(mergeDaily({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('lets the larger tally win on a shared day', () => {
    expect(mergeDaily({ d: 100 }, { d: 400 })).toEqual({ d: 400 });
    expect(mergeDaily({ d: 400 }, { d: 100 })).toEqual({ d: 400 });
  });

  it('ignores a corrupt value instead of poisoning the tally', () => {
    expect(mergeDaily({ d: 10 }, { d: Number.NaN })).toEqual({ d: 10 });
    expect(mergeDaily({ d: 10 }, { d: -50 })).toEqual({ d: 10 });
  });
});

describe('mergeStats', () => {
  const base: ReadingStats = {
    totalMsRead: 60_000,
    totalTokensRead: 300,
    documentsStarted: 1,
    documentsFinished: 0,
    averageWpm: 300,
    daily: { '2026-08-16': 300 },
    streakDays: 1,
  };

  it('recomputes the streak from the merged calendar instead of copying one', () => {
    const now = new Date(2026, 7, 17, 12).getTime();
    const merged = mergeStats(
      { ...base, daily: { [dayKey(now - 86_400_000)]: 100 } },
      { daily: { [dayKey(now)]: 200 }, streakDays: 99 },
      computeStreak,
      now,
    );
    expect(merged.streakDays).toBe(2);
  });

  it('recomputes the average from the merged totals', () => {
    const merged = mergeStats(base, { totalMsRead: 120_000, totalTokensRead: 900 }, computeStreak);
    expect(merged.totalTokensRead).toBe(900);
    expect(merged.averageWpm).toBeCloseTo(450, 5);
  });

  it('never lets a total shrink', () => {
    const merged = mergeStats(base, { totalTokensRead: 10, totalMsRead: 10 }, computeStreak);
    expect(merged.totalTokensRead).toBe(300);
    expect(merged.totalMsRead).toBe(60_000);
  });

  it('returns the local record untouched when there is nothing to merge', () => {
    expect(mergeStats(base, null, computeStreak)).toBe(base);
  });
});

describe('newerProgress', () => {
  const at = (updatedAt: number, tokenIndex: number): ReadingProgress => ({
    documentId: 'd',
    tokenIndex,
    chapterIndex: 0,
    percent: 0,
    updatedAt,
    msRead: 0,
  });

  it('keeps the newer position', () => {
    expect(newerProgress(at(100, 10), at(200, 50)).tokenIndex).toBe(50);
  });

  it('does not let the position jump backwards', () => {
    expect(newerProgress(at(200, 50), at(100, 10)).tokenIndex).toBe(50);
  });

  it('takes the incoming one when there is nothing local', () => {
    expect(newerProgress(null, at(1, 7)).tokenIndex).toBe(7);
  });
});

describe('inspectBackup', () => {
  it('reads what is inside without touching anything', () => {
    const json = JSON.stringify({
      schema: 1,
      exportedAt: '2026-08-17T00:00:00.000Z',
      documents: [doc('a', 'Effi Briest', 'Text'), doc('b', 'Der Prozess', 'Text zwei')],
      bookmarks: [{}, {}],
      annotations: [{}],
      tags: [{}],
      settings: {},
      stats: {},
    });
    const summary = inspectBackup(json, 1);
    expect(summary).not.toBe('unreadable');
    if (summary === 'unreadable' || summary === 'too-new') throw new Error('unerwartet');
    expect(summary.documents).toBe(2);
    expect(summary.bookmarks).toBe(2);
    expect(summary.sampleTitles).toEqual(['Effi Briest', 'Der Prozess']);
    expect(summary.hasSettings).toBe(true);
  });

  it('refuses something that is not a backup', () => {
    expect(inspectBackup('kein json', 1)).toBe('unreadable');
    expect(inspectBackup('{"nur":"objekt"}', 1)).toBe('unreadable');
  });

  it('refuses a file from a newer version rather than importing half of it', () => {
    expect(inspectBackup(JSON.stringify({ schema: 99, documents: [] }), 1)).toBe('too-new');
  });
});

describe('keys for spotting the same mark twice', () => {
  it('places a bookmark by document and position', () => {
    expect(bookmarkKey({ documentId: 'd', tokenIndex: 7 } as Bookmark)).toBe('d#7');
  });

  it('places a highlight by its range', () => {
    expect(annotationKey({ documentId: 'd', startToken: 3, endToken: 9 } as Annotation)).toBe('d#3-9');
  });
});

describe('store.importAll', () => {
  let store: LexiStore;

  beforeEach(async () => {
    store = new LexiStore(new MemoryDriver());
    await store.init();
  });

  const backupOf = (over: Record<string, unknown>) =>
    JSON.stringify({ schema: 1, exportedAt: '2026-08-17T00:00:00.000Z', ...over });

  it('adds a document that is not here yet', async () => {
    const result = await store.importAll(backupOf({ documents: [doc('a', 'Buch', 'Ein Text hier.')] }));
    expect(result.documentsAdded).toBe(1);
    expect((await store.listDocuments()).length).toBe(1);
  });

  it('recognises the same book under a different id instead of duplicating it', async () => {
    await store.saveDocument(doc('local_1', 'Buch', 'Genau derselbe Text.'));
    const result = await store.importAll(
      backupOf({ documents: [doc('fremd_2', 'Buch', 'Genau derselbe Text.')] }),
    );
    expect(result.documentsMatched).toBe(1);
    expect(result.documentsAdded).toBe(0);
    expect((await store.listDocuments()).length).toBe(1);
  });

  it('rewrites highlights onto the local id, so they do not point into nothing', async () => {
    await store.saveDocument(doc('local_1', 'Buch', 'Genau derselbe Text.'));
    await store.importAll(
      backupOf({
        documents: [doc('fremd_2', 'Buch', 'Genau derselbe Text.')],
        annotations: [
          {
            id: 'anno-1',
            documentId: 'fremd_2',
            startToken: 1,
            endToken: 2,
            chapterIndex: 0,
            color: 'yellow',
            text: 'derselbe',
            note: null,
            createdAt: 1,
          },
        ],
      }),
    );
    const stored = await store.listAnnotations('local_1');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.documentId).toBe('local_1');
  });

  it('keeps the newer reading position and reports the one it kept', async () => {
    await store.saveDocument(doc('local_1', 'Buch', 'Text.'));
    await store.saveProgress({
      documentId: 'local_1',
      tokenIndex: 500,
      chapterIndex: 0,
      percent: 0.5,
      updatedAt: 2000,
      msRead: 0,
    });
    const result = await store.importAll(
      backupOf({
        documents: [doc('fremd_2', 'Buch', 'Text.')],
        progress: [
          { documentId: 'fremd_2', tokenIndex: 10, chapterIndex: 0, percent: 0.01, updatedAt: 1000, msRead: 0 },
        ],
      }),
    );
    expect(result.progressKept).toBe(1);
    expect((await store.getProgress('local_1'))?.tokenIndex).toBe(500);
  });

  it('moves the position forward when the backup is the newer side', async () => {
    await store.saveDocument(doc('local_1', 'Buch', 'Text.'));
    await store.saveProgress({
      documentId: 'local_1',
      tokenIndex: 10,
      chapterIndex: 0,
      percent: 0.01,
      updatedAt: 1000,
      msRead: 0,
    });
    await store.importAll(
      backupOf({
        documents: [doc('fremd_2', 'Buch', 'Text.')],
        progress: [
          { documentId: 'fremd_2', tokenIndex: 900, chapterIndex: 0, percent: 0.9, updatedAt: 5000, msRead: 0 },
        ],
      }),
    );
    expect((await store.getProgress('local_1'))?.tokenIndex).toBe(900);
  });

  it('does not leave two marks on one line when the same backup is read twice', async () => {
    const backup = backupOf({
      documents: [doc('a', 'Buch', 'Text.')],
      bookmarks: [
        { id: 'bm-1', documentId: 'a', tokenIndex: 4, chapterIndex: 0, preview: 'x', note: null, createdAt: 1 },
      ],
    });
    await store.importAll(backup);
    await store.importAll(backup);
    expect(await store.listBookmarks('a')).toHaveLength(1);
  });

  it('unites tags instead of replacing the local shelf', async () => {
    await store.saveDocument(doc('local_1', 'Buch', 'Text.'));
    await store.setTags('local_1', ['Kafka']);
    await store.importAll(
      backupOf({ documents: [doc('fremd_2', 'Buch', 'Text.')], tags: [{ documentId: 'fremd_2', tags: ['Klassiker'], updatedAt: 0 }] }),
    );
    expect(await store.getTags('local_1')).toEqual(['Kafka', 'Klassiker']);
  });

  it('leaves the local settings alone when merging', async () => {
    await store.saveSettings({ ...(await store.getSettings()), readerFontSize: 30 });
    await store.importAll(
      backupOf({ documents: [], settings: { readerFontSize: 14 } }),
    );
    expect((await store.getSettings()).readerFontSize).toBe(30);
  });

  it('takes the settings over when replacing, because that is the point', async () => {
    await store.saveSettings({ ...(await store.getSettings()), readerFontSize: 30 });
    await store.importAll(backupOf({ documents: [], settings: { readerFontSize: 14 } }), {
      mode: 'replace',
    });
    expect((await store.getSettings()).readerFontSize).toBe(14);
  });

  it('throws away what is here when replacing', async () => {
    await store.saveDocument(doc('alt', 'Altes Buch', 'Alter Text.'));
    await store.importAll(backupOf({ documents: [doc('neu', 'Neues Buch', 'Neuer Text.')] }), {
      mode: 'replace',
    });
    const titles = (await store.listDocuments()).map((d) => d.title);
    expect(titles).toEqual(['Neues Buch']);
  });

  it('keeps both libraries when merging', async () => {
    await store.saveDocument(doc('alt', 'Altes Buch', 'Alter Text.'));
    await store.importAll(backupOf({ documents: [doc('neu', 'Neues Buch', 'Neuer Text.')] }));
    expect((await store.listDocuments()).length).toBe(2);
  });

  it('does not shrink the statistics when merging an older backup', async () => {
    await store.recordSession({ tokensRead: 1000, msRead: 60_000 });
    await store.importAll(
      backupOf({ documents: [], stats: { totalTokensRead: 5, totalMsRead: 5, daily: {}, documentsStarted: 0, documentsFinished: 0, averageWpm: 0, streakDays: 0 } }),
    );
    expect((await store.getStats()).totalTokensRead).toBeGreaterThanOrEqual(1000);
  });

  it('leaves the store marked as current after replacing, so no migration re-runs', async () => {
    // `clearAll` wipes the schema key along with everything else. Without writing it
    // back, the next `init` sees version 0 and runs every migration against data that is
    // already current. Harmless today, corrupting the moment a migration transforms
    // anything.
    const driver = new MemoryDriver();
    const fresh = new LexiStore(driver);
    await fresh.init();
    await fresh.importAll(JSON.stringify({ schema: 1, documents: [] }), { mode: 'replace' });
    expect(await driver.get('lexi:schema')).toBe('1');
  });

  it('survives a file that is not a backup at all', async () => {
    const result = await store.importAll('das ist kein json');
    expect(result.documentsAdded).toBe(0);
    expect((await store.listDocuments())).toHaveLength(0);
  });
});
