import { fold } from '../reader.js';
import { normalizeSettings } from '../settings.js';
import type {
  Annotation,
  Bookmark,
  DocumentTags,
  LexiDocument,
  LibraryEntry,
  ReadingProgress,
  ReadingStats,
  RsvpSettings,
} from '../types.js';
import type { StorageDriver } from './driver.js';

export const SCHEMA_VERSION = 1;

const KEY = {
  schema: 'lexi:schema',
  settings: 'lexi:settings',
  stats: 'lexi:stats',
  doc: (id: string) => `lexi:doc:${id}`,
  docPrefix: 'lexi:doc:',
  progress: (id: string) => `lexi:progress:${id}`,
  progressPrefix: 'lexi:progress:',
  bookmark: (docId: string, id: string) => `lexi:bm:${docId}:${id}`,
  bookmarkPrefix: (docId: string) => `lexi:bm:${docId}:`,
  allBookmarks: 'lexi:bm:',
  annotation: (docId: string, id: string) => `lexi:hl:${docId}:${id}`,
  annotationPrefix: (docId: string) => `lexi:hl:${docId}:`,
  allAnnotations: 'lexi:hl:',
  tags: (docId: string) => `lexi:tags:${docId}`,
  tagsPrefix: 'lexi:tags:',
} as const;

/** Longer than this is a note, not a label, and it would break every filter chip. */
const MAX_TAG_LENGTH = 32;

/**
 * Clean a user-typed or imported tag list.
 *
 * Duplicates are folded case- and accent-insensitively, so "Sachbuch" and "sachbuch" stay
 * one shelf instead of two that look identical in the filter row. The first spelling the
 * reader typed is the one that survives.
 */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH).trim();
    if (tag.length === 0) continue;
    const key = fold(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  out.sort((a, b) => fold(a).localeCompare(fold(b)));
  return out;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function emptyStats(): ReadingStats {
  return {
    totalMsRead: 0,
    totalTokensRead: 0,
    documentsStarted: 0,
    documentsFinished: 0,
    averageWpm: 0,
    daily: {},
    streakDays: 0,
  };
}

/** YYYY-MM-DD in local time — the unit the activity heatmap counts in. */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Consecutive days ending today (or yesterday, so an unfinished today does not reset it). */
export function computeStreak(daily: Record<string, number>, now = Date.now()): number {
  const day = 86_400_000;
  let cursor = now;
  if (!daily[dayKey(cursor)]) cursor -= day; // grace period for "not yet today"
  let streak = 0;
  while (daily[dayKey(cursor)]) {
    streak += 1;
    cursor -= day;
  }
  return streak;
}

/**
 * The offline-first data layer.
 *
 * Every read tolerates corrupt or missing values, because a reader that loses your
 * library on a schema change is worse than one that never had it.
 */
export class LexiStore {
  constructor(private readonly driver: StorageDriver) {}

  async init(): Promise<void> {
    const current = await this.driver.get(KEY.schema);
    const version = current === null ? 0 : Number.parseInt(current, 10) || 0;
    if (version < SCHEMA_VERSION) {
      await this.migrate(version);
      await this.driver.set(KEY.schema, String(SCHEMA_VERSION));
    }
  }

  /** Reserved for future schema changes; version 0 → 1 is a no-op besides stamping. */
  private async migrate(_from: number): Promise<void> {
    void _from;
    return Promise.resolve();
  }

  // ------------------------------------------------------------------ settings

  async getSettings(): Promise<RsvpSettings> {
    const raw = await this.driver.get(KEY.settings);
    return normalizeSettings(safeParse<unknown>(raw, null));
  }

  async saveSettings(settings: RsvpSettings): Promise<void> {
    await this.driver.set(KEY.settings, JSON.stringify(normalizeSettings(settings)));
  }

  // ----------------------------------------------------------------- documents

  async saveDocument(document: LexiDocument): Promise<void> {
    await this.driver.set(
      KEY.doc(document.id),
      JSON.stringify({ ...document, updatedAt: Date.now() }),
    );
  }

  async getDocument(id: string): Promise<LexiDocument | null> {
    const raw = await this.driver.get(KEY.doc(id));
    return safeParse<LexiDocument | null>(raw, null);
  }

  async deleteDocument(id: string): Promise<void> {
    await this.driver.delete(KEY.doc(id));
    await this.driver.delete(KEY.progress(id));
    const bookmarkKeys = await this.driver.keys(KEY.bookmarkPrefix(id));
    for (const key of bookmarkKeys) await this.driver.delete(key);
    // Highlights are keyed by document too, and orphans would survive a re-import of a
    // document with the same id and reattach themselves to the wrong text.
    const annotationKeys = await this.driver.keys(KEY.annotationPrefix(id));
    for (const key of annotationKeys) await this.driver.delete(key);
    // Same orphan problem: a leftover tag record would keep feeding the library's filter
    // row a shelf that no longer holds anything.
    await this.driver.delete(KEY.tags(id));
  }

  async listDocuments(): Promise<LexiDocument[]> {
    const keys = await this.driver.keys(KEY.docPrefix);
    const values = await this.readMany(keys);
    const docs: LexiDocument[] = [];
    for (const value of values) {
      const doc = safeParse<LexiDocument | null>(value, null);
      if (doc && typeof doc.id === 'string' && Array.isArray(doc.chapters)) docs.push(doc);
    }
    docs.sort((a, b) => b.updatedAt - a.updatedAt);
    return docs;
  }

  /** Documents plus their progress — one call for the library screen. */
  async listLibrary(): Promise<LibraryEntry[]> {
    const documents = await this.listDocuments();
    const entries: LibraryEntry[] = [];
    for (const document of documents) {
      entries.push({ document, progress: await this.getProgress(document.id) });
    }
    return entries;
  }

  private async readMany(keys: string[]): Promise<(string | null)[]> {
    if (this.driver.getMany) return this.driver.getMany(keys);
    const out: (string | null)[] = [];
    for (const key of keys) out.push(await this.driver.get(key));
    return out;
  }

  // ------------------------------------------------------------------ progress

  async getProgress(documentId: string): Promise<ReadingProgress | null> {
    const raw = await this.driver.get(KEY.progress(documentId));
    return safeParse<ReadingProgress | null>(raw, null);
  }

  async saveProgress(progress: ReadingProgress): Promise<void> {
    await this.driver.set(
      KEY.progress(progress.documentId),
      JSON.stringify({ ...progress, updatedAt: Date.now() }),
    );
  }

  // ----------------------------------------------------------------- bookmarks

  async addBookmark(bookmark: Bookmark): Promise<void> {
    await this.driver.set(
      KEY.bookmark(bookmark.documentId, bookmark.id),
      JSON.stringify(bookmark),
    );
  }

  async deleteBookmark(documentId: string, id: string): Promise<void> {
    await this.driver.delete(KEY.bookmark(documentId, id));
  }

  async listBookmarks(documentId: string): Promise<Bookmark[]> {
    const keys = await this.driver.keys(KEY.bookmarkPrefix(documentId));
    const values = await this.readMany(keys);
    const marks: Bookmark[] = [];
    for (const value of values) {
      const mark = safeParse<Bookmark | null>(value, null);
      if (mark && typeof mark.id === 'string') marks.push(mark);
    }
    marks.sort((a, b) => a.tokenIndex - b.tokenIndex);
    return marks;
  }

  async listAllBookmarks(): Promise<Bookmark[]> {
    const keys = await this.driver.keys(KEY.allBookmarks);
    const values = await this.readMany(keys);
    const marks: Bookmark[] = [];
    for (const value of values) {
      const mark = safeParse<Bookmark | null>(value, null);
      if (mark && typeof mark.id === 'string') marks.push(mark);
    }
    marks.sort((a, b) => b.createdAt - a.createdAt);
    return marks;
  }

  // --------------------------------------------------------------- annotations

  async saveAnnotation(annotation: Annotation): Promise<void> {
    await this.driver.set(
      KEY.annotation(annotation.documentId, annotation.id),
      JSON.stringify(annotation),
    );
  }

  async deleteAnnotation(documentId: string, id: string): Promise<void> {
    await this.driver.delete(KEY.annotation(documentId, id));
  }

  /** Ordered by position in the text, which is the order a reader looks for them in. */
  async listAnnotations(documentId: string): Promise<Annotation[]> {
    const keys = await this.driver.keys(KEY.annotationPrefix(documentId));
    const values = await this.readMany(keys);
    const out: Annotation[] = [];
    for (const value of values) {
      const item = safeParse<Annotation | null>(value, null);
      if (item && typeof item.id === 'string') out.push(item);
    }
    out.sort((a, b) => a.startToken - b.startToken);
    return out;
  }

  async listAllAnnotations(): Promise<Annotation[]> {
    const keys = await this.driver.keys(KEY.allAnnotations);
    const values = await this.readMany(keys);
    const out: Annotation[] = [];
    for (const value of values) {
      const item = safeParse<Annotation | null>(value, null);
      if (item && typeof item.id === 'string') out.push(item);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  }

  // ---------------------------------------------------------------------- tags

  async getTags(documentId: string): Promise<string[]> {
    const raw = await this.driver.get(KEY.tags(documentId));
    return normalizeTags(safeParse<DocumentTags | null>(raw, null)?.tags);
  }

  /** Replaces the document's tags and returns what was actually stored. */
  async setTags(documentId: string, tags: string[]): Promise<string[]> {
    const normalized = normalizeTags(tags);
    // An empty list is the absence of tags, not a record holding nothing — otherwise the
    // key survives every "remove the last tag" and the export carries empty shelves.
    if (normalized.length === 0) {
      await this.driver.delete(KEY.tags(documentId));
      return normalized;
    }
    const record: DocumentTags = { documentId, tags: normalized, updatedAt: Date.now() };
    await this.driver.set(KEY.tags(documentId), JSON.stringify(record));
    return normalized;
  }

  async listAllTags(): Promise<DocumentTags[]> {
    const keys = await this.driver.keys(KEY.tagsPrefix);
    const values = await this.readMany(keys);
    const out: DocumentTags[] = [];
    for (const value of values) {
      const record = safeParse<DocumentTags | null>(value, null);
      if (!record || typeof record.documentId !== 'string') continue;
      const tags = normalizeTags(record.tags);
      if (tags.length > 0) out.push({ ...record, tags });
    }
    return out;
  }

  /** Document id → tags. One read for the whole library screen. */
  async tagIndex(): Promise<Record<string, string[]>> {
    const index: Record<string, string[]> = {};
    for (const record of await this.listAllTags()) index[record.documentId] = record.tags;
    return index;
  }

  // --------------------------------------------------------------------- stats

  async getStats(): Promise<ReadingStats> {
    const raw = await this.driver.get(KEY.stats);
    const stats = safeParse<ReadingStats>(raw, emptyStats());
    return {
      ...emptyStats(),
      ...stats,
      daily: typeof stats.daily === 'object' && stats.daily !== null ? stats.daily : {},
    };
  }

  /**
   * Fold one finished reading session into the aggregate stats.
   * `msRead` is wall-clock time the player was actually playing, not time on screen.
   */
  async recordSession(input: {
    tokensRead: number;
    msRead: number;
    finished?: boolean;
    started?: boolean;
    now?: number;
  }): Promise<ReadingStats> {
    const now = input.now ?? Date.now();
    const stats = await this.getStats();
    const daily = { ...stats.daily };
    const key = dayKey(now);
    daily[key] = (daily[key] ?? 0) + Math.max(0, input.tokensRead);

    const totalTokensRead = stats.totalTokensRead + Math.max(0, input.tokensRead);
    const totalMsRead = stats.totalMsRead + Math.max(0, input.msRead);

    const next: ReadingStats = {
      totalMsRead,
      totalTokensRead,
      documentsStarted: stats.documentsStarted + (input.started ? 1 : 0),
      documentsFinished: stats.documentsFinished + (input.finished ? 1 : 0),
      averageWpm: totalMsRead > 0 ? (totalTokensRead / totalMsRead) * 60_000 : 0,
      daily,
      streakDays: computeStreak(daily, now),
    };
    await this.driver.set(KEY.stats, JSON.stringify(next));
    return next;
  }

  // ------------------------------------------------------------------- export

  /** Full backup as JSON — the user's data belongs to the user (Art. 20 DSGVO). */
  async exportAll(): Promise<string> {
    return JSON.stringify(
      {
        schema: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        settings: await this.getSettings(),
        stats: await this.getStats(),
        documents: await this.listDocuments(),
        progress: await this.listAllProgress(),
        bookmarks: await this.listAllBookmarks(),
        annotations: await this.listAllAnnotations(),
        tags: await this.listAllTags(),
      },
      null,
      2,
    );
  }

  async listAllProgress(): Promise<ReadingProgress[]> {
    const keys = await this.driver.keys(KEY.progressPrefix);
    const values = await this.readMany(keys);
    const out: ReadingProgress[] = [];
    for (const value of values) {
      const p = safeParse<ReadingProgress | null>(value, null);
      if (p && typeof p.documentId === 'string') out.push(p);
    }
    return out;
  }

  /** Restore a backup. Existing entries with the same id are overwritten. */
  async importAll(
    json: string,
  ): Promise<{ documents: number; bookmarks: number; annotations: number; tags: number }> {
    const data = safeParse<Record<string, unknown>>(json, {});
    let documents = 0;
    let bookmarks = 0;
    let annotations = 0;
    let tags = 0;

    if (data.settings) await this.saveSettings(normalizeSettings(data.settings));
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents as LexiDocument[]) {
        if (doc && typeof doc.id === 'string') {
          await this.saveDocument(doc);
          documents += 1;
        }
      }
    }
    if (Array.isArray(data.progress)) {
      for (const p of data.progress as ReadingProgress[]) {
        if (p && typeof p.documentId === 'string') await this.saveProgress(p);
      }
    }
    if (Array.isArray(data.bookmarks)) {
      for (const b of data.bookmarks as Bookmark[]) {
        if (b && typeof b.id === 'string' && typeof b.documentId === 'string') {
          await this.addBookmark(b);
          bookmarks += 1;
        }
      }
    }
    if (Array.isArray(data.annotations)) {
      for (const a of data.annotations as Annotation[]) {
        if (a && typeof a.id === 'string' && typeof a.documentId === 'string') {
          await this.saveAnnotation(a);
          annotations += 1;
        }
      }
    }
    if (Array.isArray(data.tags)) {
      for (const record of data.tags as DocumentTags[]) {
        if (record && typeof record.documentId === 'string') {
          const stored = await this.setTags(record.documentId, normalizeTags(record.tags));
          if (stored.length > 0) tags += 1;
        }
      }
    }
    if (data.stats && typeof data.stats === 'object') {
      await this.driver.set(KEY.stats, JSON.stringify(data.stats));
    }
    return { documents, bookmarks, annotations, tags };
  }

  /** Wipe everything. Backs the "delete all my data" button. */
  async clearAll(): Promise<void> {
    if (this.driver.clear) {
      await this.driver.clear();
      return;
    }
    for (const prefix of ['lexi:']) {
      const keys = await this.driver.keys(prefix);
      for (const key of keys) await this.driver.delete(key);
    }
  }
}
