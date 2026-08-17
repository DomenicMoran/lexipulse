/**
 * The binary side-store: original documents, kept byte for byte.
 *
 * Separate from `StorageDriver` on purpose. That one is a string key-value store, and
 * every value in it is JSON that gets read, parsed and rewritten whenever anything about
 * a document changes. A 40 MB PDF in there would be copied on every progress update, and
 * base64 would inflate it by a third on the way in. Originals are written once, read on
 * demand, and deleted with their document.
 *
 * Web backs this with an IndexedDB object store holding `Blob`s, native with a file in
 * the app's own directory. Neither is reachable from another site or another app.
 */

export interface StoredFileMeta {
  id: string;
  mime: string;
  bytes: number;
  updatedAt: number;
}

export interface FileStore {
  put(id: string, bytes: Uint8Array, mime: string): Promise<StoredFileMeta>;
  get(id: string): Promise<Uint8Array | null>;
  stat(id: string): Promise<StoredFileMeta | null>;
  remove(id: string): Promise<void>;
  /** Every id currently held, for the orphan sweep. */
  list(): Promise<string[]>;
  /** Sum of all stored sizes, for the storage readout. */
  totalBytes(): Promise<number>;
}

/** Volatile store for tests and for platforms that decline to keep originals. */
export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, { bytes: Uint8Array; meta: StoredFileMeta }>();

  put(id: string, bytes: Uint8Array, mime: string): Promise<StoredFileMeta> {
    // Copied, not referenced: the caller usually owns a view into a larger buffer that
    // it is free to reuse the moment this resolves.
    const copy = new Uint8Array(bytes);
    const meta: StoredFileMeta = { id, mime, bytes: copy.byteLength, updatedAt: Date.now() };
    this.files.set(id, { bytes: copy, meta });
    return Promise.resolve(meta);
  }

  get(id: string): Promise<Uint8Array | null> {
    const entry = this.files.get(id);
    return Promise.resolve(entry ? new Uint8Array(entry.bytes) : null);
  }

  stat(id: string): Promise<StoredFileMeta | null> {
    return Promise.resolve(this.files.get(id)?.meta ?? null);
  }

  remove(id: string): Promise<void> {
    this.files.delete(id);
    return Promise.resolve();
  }

  list(): Promise<string[]> {
    return Promise.resolve([...this.files.keys()]);
  }

  totalBytes(): Promise<number> {
    let total = 0;
    for (const entry of this.files.values()) total += entry.meta.bytes;
    return Promise.resolve(total);
  }
}

/** The id an original is filed under. Derived, so no second field has to be kept in sync. */
export function originalFileId(documentId: string): string {
  return `original:${documentId}`;
}

/**
 * Delete every stored file that no document claims any more.
 *
 * Needed because a document can be removed while its original is being read, and because
 * a restore that replaces the whole library leaves the previous originals behind. Called
 * on a schedule the platform decides, never in the import path.
 */
export async function sweepOrphanedFiles(
  files: FileStore,
  claimedIds: readonly string[],
): Promise<number> {
  const claimed = new Set(claimedIds);
  const present = await files.list();
  let removed = 0;
  for (const id of present) {
    if (claimed.has(id)) continue;
    await files.remove(id);
    removed += 1;
  }
  return removed;
}
