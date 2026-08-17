import { normalizeFormValues, type PdfFieldValue, type PdfFormState, type PdfMark } from '../pdf-marks.js';
import { fold } from '../reader.js';
import { normalizeSettings } from '../settings.js';
import type {
  Annotation,
  Bookmark,
  DocumentOriginal,
  DocumentTags,
  LexiDocument,
  LibraryEntry,
  ReadingProgress,
  ReadingStats,
  RsvpSettings,
} from '../types.js';
import type { StorageDriver } from './driver.js';
import { originalFileId, sweepOrphanedFiles, type FileStore } from './files.js';
import {
  annotationKey,
  bookmarkKey,
  documentFingerprint,
  emptyImportResult,
  markKey,
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
  lastBackup: 'lexi:lastBackup',
  tagsPrefix: 'lexi:tags:',
  mark: (docId: string, id: string) => `lexi:mark:${docId}:${id}`,
  markPrefix: (docId: string) => `lexi:mark:${docId}:`,
  allMarks: 'lexi:mark:',
  form: (docId: string) => `lexi:form:${docId}`,
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
  /**
   * `files` is optional because a platform may decline to keep originals — the reader
   * still works, it just cannot show the untouched page. When it is supplied, deleting a
   * document deletes its original in the same call, so the two can never drift apart.
   */
  constructor(
    private readonly driver: StorageDriver,
    private readonly files?: FileStore,
  ) {}

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
    const markKeys = await this.driver.keys(KEY.markPrefix(id));
    for (const key of markKeys) await this.driver.delete(key);
    await this.driver.delete(KEY.form(id));
    // The original is the largest thing the app ever stores. Leaving it behind would fill
    // the device with files no screen can reach any more.
    await this.files?.remove(originalFileId(id));
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

  // ------------------------------------------------------------ marks on a page

  async saveMark(mark: PdfMark): Promise<void> {
    await this.driver.set(KEY.mark(mark.documentId, mark.id), JSON.stringify(mark));
  }

  async deleteMark(documentId: string, id: string): Promise<void> {
    await this.driver.delete(KEY.mark(documentId, id));
  }

  /** Oldest first: the order they were drawn is the order they have to be drawn again. */
  async listMarks(documentId: string): Promise<PdfMark[]> {
    const keys = await this.driver.keys(KEY.markPrefix(documentId));
    const values = await this.readMany(keys);
    const out: PdfMark[] = [];
    for (const value of values) {
      const item = safeParse<PdfMark | null>(value, null);
      if (item && typeof item.id === 'string' && typeof item.page === 'number') out.push(item);
    }
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }

  async listAllMarks(): Promise<PdfMark[]> {
    const keys = await this.driver.keys(KEY.allMarks);
    const values = await this.readMany(keys);
    const out: PdfMark[] = [];
    for (const value of values) {
      const item = safeParse<PdfMark | null>(value, null);
      if (item && typeof item.id === 'string' && typeof item.page === 'number') out.push(item);
    }
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }

  // ------------------------------------------------------------------ form values

  async getFormValues(documentId: string): Promise<Record<string, PdfFieldValue>> {
    const raw = await this.driver.get(KEY.form(documentId));
    return normalizeFormValues(safeParse<PdfFormState | null>(raw, null)?.values);
  }

  async setFormValues(
    documentId: string,
    values: Record<string, PdfFieldValue>,
  ): Promise<void> {
    const state: PdfFormState = {
      documentId,
      values: normalizeFormValues(values),
      updatedAt: Date.now(),
    };
    await this.driver.set(KEY.form(documentId), JSON.stringify(state));
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

  /**
   * When a backup was last created, or null if never.
   *
   * Without a server the reader carries the responsibility for their own data, and an
   * app that never mentions it leaves them alone with that until the phone is gone.
   * This is what the settings screen reports; it is an answer, not a nag.
   */
  async getLastBackupAt(): Promise<number | null> {
    const raw = await this.driver.get(KEY.lastBackup);
    if (raw === null) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /**
   * Record that a backup was produced.
   *
   * Called by the interface once the file exists, rather than from `exportAll`, because
   * only the caller knows whether writing it actually succeeded. It cannot know whether
   * the reader then kept the file, so this marks "a backup was made", not "a backup is
   * safe somewhere". Anything stronger would be a claim the app cannot support.
   */
  async markBackupCreated(at: number = Date.now()): Promise<void> {
    await this.driver.set(KEY.lastBackup, String(at));
  }

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
        /*
         * Marks and filled-in form fields, but never the original files themselves.
         *
         * A backup is a JSON file the reader mails to themselves or drops in a folder;
         * base64 originals would turn a 40 MB library into a 55 MB text file that no
         * editor can open. What is exported is everything the reader made — reopen the
         * same PDF on the other device and the marks land back where they were.
         */
        marks: await this.listAllMarks(),
        forms: await this.listAllFormStates(),
      },
      null,
      2,
    );
  }

  async listAllFormStates(): Promise<PdfFormState[]> {
    const documents = await this.listDocuments();
    const out: PdfFormState[] = [];
    for (const document of documents) {
      const raw = await this.driver.get(KEY.form(document.id));
      const state = safeParse<PdfFormState | null>(raw, null);
      if (state && Object.keys(normalizeFormValues(state.values)).length > 0) {
        out.push({
          documentId: document.id,
          values: normalizeFormValues(state.values),
          updatedAt: typeof state.updatedAt === 'number' ? state.updatedAt : Date.now(),
        });
      }
    }
    return out;
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

    if (Array.isArray(data.marks)) {
      const existing = mode === 'merge' ? await this.listAllMarks() : [];
      const seen = new Set(existing.map(markKey));
      const seenIds = new Set(existing.map((m) => m.id));
      for (const raw of data.marks as PdfMark[]) {
        if (!raw || typeof raw.id !== 'string' || typeof raw.documentId !== 'string') continue;
        if (!Array.isArray(raw.rect) || raw.rect.length !== 4) continue;
        const mark = { ...raw, documentId: mapId(raw.documentId) };
        // Same two ways as a bookmark: the same backup read twice, and the same passage
        // marked on both devices — the id catches the first, the position the second.
        if (mode === 'merge' && (seenIds.has(mark.id) || seen.has(markKey(mark)))) continue;
        await this.saveMark(mark);
        seen.add(markKey(mark));
        seenIds.add(mark.id);
        result.marksAdded += 1;
      }
    }

    if (Array.isArray(data.forms)) {
      for (const raw of data.forms as PdfFormState[]) {
        if (!raw || typeof raw.documentId !== 'string') continue;
        const documentId = mapId(raw.documentId);
        const incoming = normalizeFormValues(raw.values);
        if (Object.keys(incoming).length === 0) continue;
        /*
         * Field by field, incoming wins.
         *
         * A half-filled form on each device is the case worth handling: taking the whole
         * record from one side would throw away what was typed on the other, and there is
         * no way to ask which of two answers to the same question is the right one.
         */
        const current = mode === 'merge' ? await this.getFormValues(documentId) : {};
        await this.setFormValues(documentId, { ...current, ...incoming });
        result.formsUpdated += 1;
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
    if (this.files) await sweepOrphanedFiles(this.files, []);
    await this.driver.set(KEY.schema, String(SCHEMA_VERSION));
  }

  // ------------------------------------------------------------------ originals

  /** True when this platform keeps original files at all. */
  get keepsOriginals(): boolean {
    return this.files !== undefined;
  }

  /**
   * Keep the untouched source file next to the document and record where it went.
   *
   * Returns null when the platform has no file store, which callers must handle rather
   * than assume: the reader works without an original, it just cannot show the page as
   * its author laid it out.
   */
  async putOriginal(
    documentId: string,
    bytes: Uint8Array,
    input: { mime: string; fileName: string | null; pageCount?: number | null; encrypted?: boolean },
  ): Promise<DocumentOriginal | null> {
    if (!this.files) return null;
    const fileId = originalFileId(documentId);
    const meta = await this.files.put(fileId, bytes, input.mime);
    return {
      fileId,
      mime: input.mime,
      bytes: meta.bytes,
      fileName: input.fileName,
      pageCount: input.pageCount ?? null,
      ...(input.encrypted ? { encrypted: true } : {}),
    };
  }

  async getOriginal(documentId: string): Promise<Uint8Array | null> {
    if (!this.files) return null;
    return this.files.get(originalFileId(documentId));
  }

  /**
   * Replace an original in place, keeping the size recorded on the document honest.
   *
   * This is the save path of the editor: the reader edited the PDF, and the file the app
   * holds must become the file they see. The document record is rewritten too, because a
   * stale byte count in the library is a small lie that grows with every edit.
   */
  async replaceOriginal(documentId: string, bytes: Uint8Array): Promise<DocumentOriginal | null> {
    if (!this.files) return null;
    const document = await this.getDocument(documentId);
    const previous = document?.original;
    if (!document || !previous) return null;

    const meta = await this.files.put(previous.fileId, bytes, previous.mime);
    const original: DocumentOriginal = { ...previous, bytes: meta.bytes };
    await this.saveDocument({ ...document, original, updatedAt: Date.now() });
    return original;
  }

  /** Drop every stored file no document claims. Safe to call at any time. */
  async sweepOriginals(): Promise<number> {
    if (!this.files) return 0;
    const documents = await this.listDocuments();
    const claimed = documents
      .map((doc) => doc.original?.fileId)
      .filter((id): id is string => typeof id === 'string');
    return sweepOrphanedFiles(this.files, claimed);
  }
}
