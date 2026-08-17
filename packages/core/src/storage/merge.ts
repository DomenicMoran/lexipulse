/**
 * Merging one backup into another, without a server anywhere.
 *
 * Two devices, one library. The rules here decide what happens when both sides
 * know about the same book, and every one of them follows the same line: never claim
 * more than is proven. A reading position may not move backwards, a statistic may not
 * grow beyond what was actually read, and a highlight may not point at a document that
 * does not exist on this device.
 *
 * Pure functions with the store passed in, so every rule can be tested without a
 * database and without a phone.
 */
import type {
  Annotation,
  Bookmark,
  LexiDocument,
  ReadingProgress,
  ReadingStats,
} from '../types.js';

/**
 * A content fingerprint for a document.
 *
 * `createDocumentId` mixes a timestamp and a random suffix into the id, so the same book
 * imported on two devices carries two different ids. Merging on the id would therefore
 * duplicate every book a reader owns on both devices. The text itself is the only thing
 * both sides agree on.
 *
 * FNV-1a over the joined chapter text, paired with the word count. A 32-bit hash alone
 * would be enough for a personal library (a hundred documents give a collision chance in
 * the millionths), and the word count makes an accidental match vanishingly unlikely.
 * A collision would merge two different books, so it is worth the extra field.
 */
export function documentFingerprint(document: Pick<LexiDocument, 'chapters' | 'wordCount'>): string {
  let hash = 0x811c9dc5;
  for (const chapter of document.chapters) {
    const text = chapter.text;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      // The classic FNV prime, written as shifts because Math.imul on a 32-bit prime is
      // the only other way to stay inside 32 bits in JavaScript.
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return `${document.wordCount}:${hash.toString(16)}`;
}

/**
 * Merge daily reading tallies.
 *
 * The maximum per day, never the sum. Summing is right in exactly one case, two devices
 * that both read today, and wrong in the more common one: reading the same backup twice
 * would double what a reader has done. A statistic that overstates is a lie about
 * somebody's own progress, so the rule errs downwards.
 */
export function mergeDaily(
  local: Record<string, number>,
  incoming: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...local };
  for (const [day, tokens] of Object.entries(incoming)) {
    const value = Number.isFinite(tokens) ? Math.max(0, tokens) : 0;
    out[day] = Math.max(out[day] ?? 0, value);
  }
  return out;
}

/**
 * Merge two statistics records.
 *
 * Totals take the maximum for the same reason the daily tallies do. The streak and the
 * average are *recomputed* rather than carried over, because both are derived: a streak
 * copied from one side would contradict the merged calendar beside it.
 */
export function mergeStats(
  local: ReadingStats,
  incoming: Partial<ReadingStats> | null | undefined,
  computeStreak: (daily: Record<string, number>, now?: number) => number,
  now = Date.now(),
): ReadingStats {
  if (!incoming) return local;
  const daily = mergeDaily(local.daily ?? {}, incoming.daily ?? {});
  const totalMsRead = Math.max(local.totalMsRead ?? 0, incoming.totalMsRead ?? 0);
  const totalTokensRead = Math.max(local.totalTokensRead ?? 0, incoming.totalTokensRead ?? 0);
  return {
    totalMsRead,
    totalTokensRead,
    documentsStarted: Math.max(local.documentsStarted ?? 0, incoming.documentsStarted ?? 0),
    documentsFinished: Math.max(local.documentsFinished ?? 0, incoming.documentsFinished ?? 0),
    averageWpm: totalMsRead > 0 ? (totalTokensRead / totalMsRead) * 60_000 : 0,
    daily,
    streakDays: computeStreak(daily, now),
  };
}

/** The newer of two positions, so reading never jumps backwards. */
export function newerProgress(
  local: ReadingProgress | null | undefined,
  incoming: ReadingProgress,
): ReadingProgress {
  if (!local) return incoming;
  return incoming.updatedAt > local.updatedAt ? incoming : local;
}

/**
 * Where a bookmark sits, for spotting the same mark twice.
 *
 * Ids are stable, so a second import of the same backup is caught by the id alone. This
 * catches the other case: the same passage marked on both devices, which arrives with
 * two ids and would otherwise leave two entries on one line.
 */
export function bookmarkKey(bookmark: Pick<Bookmark, 'documentId' | 'tokenIndex'>): string {
  return `${bookmark.documentId}#${bookmark.tokenIndex}`;
}

/** The same idea for highlights, which cover a range rather than a point. */
export function annotationKey(
  annotation: Pick<Annotation, 'documentId' | 'startToken' | 'endToken'>,
): string {
  return `${annotation.documentId}#${annotation.startToken}-${annotation.endToken}`;
}

/** What a backup holds, read without changing anything. */
export interface BackupSummary {
  schema: number;
  exportedAt: string | null;
  documents: number;
  bookmarks: number;
  annotations: number;
  tags: number;
  hasSettings: boolean;
  hasStats: boolean;
  /** Titles of the first few documents, so the reader recognises their own library. */
  sampleTitles: string[];
}

export type ImportMode = 'merge' | 'replace';

/** What an import actually did, so the app can say so instead of guessing. */
export interface ImportResult {
  mode: ImportMode;
  documentsAdded: number;
  /** Recognised as already present, by fingerprint. */
  documentsMatched: number;
  bookmarksAdded: number;
  annotationsAdded: number;
  tagsUpdated: number;
  progressUpdated: number;
  /** Positions where the local one was newer and therefore kept. */
  progressKept: number;
  /** Marks drawn on original pages. */
  marksAdded: number;
  /** Documents whose filled-in form fields were taken over. */
  formsUpdated: number;
}

export function emptyImportResult(mode: ImportMode): ImportResult {
  return {
    mode,
    documentsAdded: 0,
    documentsMatched: 0,
    bookmarksAdded: 0,
    annotationsAdded: 0,
    tagsUpdated: 0,
    progressUpdated: 0,
    progressKept: 0,
    marksAdded: 0,
    formsUpdated: 0,
  };
}

/**
 * Identity of a mark as a reader would judge it: same page, same kind, same place.
 *
 * Coordinates are rounded to the point, because a mark drawn on one device and restored
 * on another can differ in the third decimal without being a second mark.
 */
export function markKey(mark: {
  documentId: string;
  page: number;
  kind: string;
  rect: readonly number[];
}): string {
  const rect = mark.rect.map((value) => Math.round(value)).join(',');
  return `${mark.documentId}|${mark.page}|${mark.kind}|${rect}`;
}

/**
 * Read a backup without touching the store.
 *
 * Returns `null` for anything that is not a LexiPulse backup, so the app can say "this
 * is not a backup file" rather than failing halfway through writing one.
 */
export function inspectBackup(json: string, currentSchema: number): BackupSummary | 'unreadable' | 'too-new' {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return 'unreadable';
  }
  if (!data || typeof data !== 'object') return 'unreadable';

  const schema = typeof data.schema === 'number' ? data.schema : 0;
  const documents = Array.isArray(data.documents) ? (data.documents as LexiDocument[]) : null;
  // A backup without a document list is not one. Everything else may legitimately be
  // absent: a fresh library has no highlights.
  if (documents === null) return 'unreadable';
  // Refusing a newer file is kinder than importing half of it: a later version may
  // store things this one would silently drop.
  if (schema > currentSchema) return 'too-new';

  const count = (key: string) => (Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0);

  return {
    schema,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
    documents: documents.length,
    bookmarks: count('bookmarks'),
    annotations: count('annotations'),
    tags: count('tags'),
    hasSettings: Boolean(data.settings),
    hasStats: Boolean(data.stats),
    sampleTitles: documents
      .slice(0, 3)
      .map((doc) => (typeof doc?.title === 'string' ? doc.title : ''))
      .filter((title) => title.length > 0),
  };
}
