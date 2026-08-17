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
import {
  annotationKey,
  bookmarkKey,
  documentFingerprint,
  emptyImportResult,
  mergeStats,
  newerProgress,
  type ImportMode,
  type ImportResult,
} from './merge.js';

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

  /**
   * Store a reading position, with the timestamp the caller gives it.
   *
   * This used to stamp `Date.now()` over whatever came in, which made restoring a
   * position impossible: a record read out of a backup arrived carrying the moment it
   * was written rather than the moment it was made, and "the newer side wins" then
   * compares two lies. Every caller already sets `updatedAt`, so the override bought
   * nothing and cost the merge its only ordering.
   */
  async saveProgress(progress: ReadingProgress): Promise<void> {
    await this.driver.set(KEY.progress(progress.documentId), JSON.stringify(progress));
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

  /**
   * Bring a backup into this device.
   *
   * `merge` is the default and the safe one: nothing is lost, and where both sides know
   * something, the newer wins. `replace` is for a fresh device or a factory reset, and
   * throws away what is here.
   *
   * The distinction matters because the two are opposites. A merge that overwrote
   * statistics would erase reading somebody actually did; a replace that merged would
   * leave the remains of the old library behind after a reset.
   */
  async importAll(json: string, options: { mode?: ImportMode } = {}): Promise<ImportResult> {
    const mode = options.mode ?? 'merge';
    const data = safeParse<Record<string, unknown>>(json, {});
    const result = emptyImportResult(mode);

    if (mode === 'replace') await this.clearAll();

    /*
     * Settings belong to the device, not to the library: font size, margins and theme
     * are chosen for the screen in front of you, and a tablet inheriting a phone's
     * values is a worse result than keeping its own. On a replace they come along,
     * because there the whole point is to restore this device.
     */
    if (data.settings && mode === 'replace') {
      await this.saveSettings(normalizeSettings(data.settings));
    }

    /*
     * Documents are matched by content, not by id: `createDocumentId` mixes in a
     * timestamp and a random suffix, so the same book imported on two devices carries
     * two ids and merging on the id would duplicate it. Where an incoming document is
     * recognised, the local record stays and everything hanging off the incoming one is
     * rewritten to the local id, or the highlights would point at a document that is
     * not here.
     */
    const remap = new Map<string, string>();
    if (Array.isArray(data.documents)) {
      const local = await this.listDocuments();
      const byFingerprint = new Map(local.map((doc) => [documentFingerprint(doc), doc.id]));
      for (const doc of data.documents as LexiDocument[]) {
        if (!doc || typeof doc.id !== 'string') continue;
        const existing = mode === 'merge' ? byFingerprint.get(documentFingerprint(doc)) : undefined;
        if (existing !== undefined) {
          remap.set(doc.id, existing);
          result.documentsMatched += 1;
          continue;
        }
        await this.saveDocument(doc);
        byFingerprint.set(documentFingerprint(doc), doc.id);
        remap.set(doc.id, doc.id);
        result.documentsAdded += 1;
      }
    }
    const mapId = (id: string) => remap.get(id) ?? id;

    if (Array.isArray(data.progress)) {
      for (const raw of data.progress as ReadingProgress[]) {
        if (!raw || typeof raw.documentId !== 'string') continue;
        const incoming = { ...raw, documentId: mapId(raw.documentId) };
        if (mode === 'replace') {
          await this.saveProgress(incoming);
          result.progressUpdated += 1;
          continue;
        }
        const local = await this.getProgress(incoming.documentId);
        const winner = newerProgress(local, incoming);
        if (winner === incoming) {
          await this.saveProgress(incoming);
          result.progressUpdated += 1;
        } else {
          result.progressKept += 1;
        }
      }
    }

    if (Array.isArray(data.bookmarks)) {
      const seen = new Set(
        mode === 'merge' ? (await this.listAllBookmarks()).map(bookmarkKey) : [],
      );
      const seenIds = new Set(mode === 'merge' ? (await this.listAllBookmarks()).map((b) => b.id) : []);
      for (const raw of data.bookmarks as Bookmark[]) {
        if (!raw || typeof raw.id !== 'string' || typeof raw.documentId !== 'string') continue;
        const bookmark = { ...raw, documentId: mapId(raw.documentId) };
        // Two ways the same mark can arrive twice: the same backup read again, which the
        // id catches, and the same passage marked on both devices, which it does not.
        if (mode === 'merge' && (seenIds.has(bookmark.id) || seen.has(bookmarkKey(bookmark)))) continue;
        await this.addBookmark(bookmark);
        seen.add(bookmarkKey(bookmark));
        seenIds.add(bookmark.id);
        result.bookmarksAdded += 1;
      }
    }

    if (Array.isArray(data.annotations)) {
      const existing = mode === 'merge' ? await this.listAllAnnotations() : [];
      const seen = new Set(existing.map(annotationKey));
      const seenIds = new Set(existing.map((a) => a.id));
      for (const raw of data.annotations as Annotation[]) {
        if (!raw || typeof raw.id !== 'string' || typeof raw.documentId !== 'string') continue;
        const annotation = { ...raw, documentId: mapId(raw.documentId) };
        if (mode === 'merge' && (seenIds.has(annotation.id) || seen.has(annotationKey(annotation)))) {
          continue;
        }
        await this.saveAnnotation(annotation);
        seen.add(annotationKey(annotation));
        seenIds.add(annotation.id);
        result.annotationsAdded += 1;
      }
    }

    if (Array.isArray(data.tags)) {
      for (const raw of data.tags as DocumentTags[]) {
        if (!raw || typeof raw.documentId !== 'string') continue;
        const documentId = mapId(raw.documentId);
        // Union, not replacement: a shelf the other device does not know about is still
        // a shelf this reader made.
        const current = mode === 'merge' ? await this.getTags(documentId) : [];
        const stored = await this.setTags(documentId, normalizeTags([...current, ...(raw.tags ?? [])]));
        if (stored.length > 0) result.tagsUpdated += 1;
      }
    }

    if (data.stats && typeof data.stats === 'object') {
      if (mode === 'replace') {
        await this.driver.set(KEY.stats, JSON.stringify(data.stats));
      } else {
        const merged = mergeStats(
          await this.getStats(),
          data.stats as Partial<ReadingStats>,
          computeStreak,
        );
        await this.driver.set(KEY.stats, JSON.stringify(merged));
      }
    }

    return result;
  }

  /**
   * Wipe everything, then mark the store as current again.
   *
   * Without writing the schema key back, the next `init` would see version 0 and run
   * every migration against data that is already current. Today those migrations do
   * nothing, so the omission was harmless; the first migration that transforms anything
   * would silently corrupt a freshly restored library.
   */
  async clearAll(): Promise<void> {
    if (this.driver.clear) {
      await this.driver.clear();
    } else {
      for (const prefix of ['lexi:']) {
        const keys = await this.driver.keys(prefix);
        for (const key of keys) await this.driver.delete(key);
      }
    }
    await this.driver.set(KEY.schema, String(SCHEMA_VERSION));
  }
}
