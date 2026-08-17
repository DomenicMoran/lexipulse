import type { FileStore, StorageDriver, StoredFileMeta } from '@lexipulse/core';
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'lexipulse';
/** 2 added `files`, the object store holding original documents as blobs. */
const DB_VERSION = 2;
const STORE = 'kv';
const FILES = 'files';

interface StoredFile {
  id: string;
  mime: string;
  bytes: number;
  updatedAt: number;
  blob: Blob;
}

interface LexiDb {
  kv: { key: string; value: string };
  files: { key: string; value: StoredFile };
}

function openLexiDb(): Promise<IDBPDatabase<LexiDb>> {
  return openDB<LexiDb>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      if (!database.objectStoreNames.contains(FILES)) database.createObjectStore(FILES);
    },
  });
}

/**
 * IndexedDB backing for `LexiStore`.
 *
 * One object store with string keys and string values. The shape is deliberately dumb:
 * every bit of structure — documents, progress, bookmarks, stats — already lives in the
 * shared, tested store above this layer, and a richer schema here would only add a
 * second place where migrations can go wrong.
 *
 * localStorage is not an option: a single EPUB tokenises into megabytes of JSON, well
 * past the 5 MB budget browsers give it, and its synchronous API would block the player.
 */
export class IdbDriver implements StorageDriver {
  private db: Promise<IDBPDatabase<LexiDb>> | null = null;

  private open(): Promise<IDBPDatabase<LexiDb>> {
    if (!this.db) this.db = openLexiDb();
    return this.db;
  }

  async get(key: string): Promise<string | null> {
    const db = await this.open();
    return (await db.get(STORE, key)) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.open();
    await db.put(STORE, value, key);
  }

  async delete(key: string): Promise<void> {
    const db = await this.open();
    await db.delete(STORE, key);
  }

  /**
   * Prefix scan over the primary key range. `￿` is the last code unit IndexedDB
   * will compare, so `[prefix, prefix + ￿]` is exactly "everything under prefix".
   */
  async keys(prefix: string): Promise<string[]> {
    const db = await this.open();
    const range = IDBKeyRange.bound(prefix, `${prefix}￿`, false, false);
    return (await db.getAllKeys(STORE, range)) as string[];
  }

  async getMany(keys: string[]): Promise<(string | null)[]> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readonly');
    const results = await Promise.all(keys.map((key) => tx.store.get(key)));
    await tx.done;
    return results.map((value) => value ?? null);
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await db.clear(STORE);
  }
}

/**
 * Original documents, as blobs.
 *
 * A `Blob` rather than a `Uint8Array`: browsers keep blob payloads out of the main heap
 * and stream them from disk, so a 200 MB PDF costs a file handle instead of 200 MB of
 * JavaScript memory. Blobs are also what `URL.createObjectURL` and `<canvas>` want back.
 */
export class IdbFileStore implements FileStore {
  private db: Promise<IDBPDatabase<LexiDb>> | null = null;

  private open(): Promise<IDBPDatabase<LexiDb>> {
    if (!this.db) this.db = openLexiDb();
    return this.db;
  }

  async put(id: string, bytes: Uint8Array, mime: string): Promise<StoredFileMeta> {
    const db = await this.open();
    // Sliced into its own buffer: the caller's view may be a window into a larger one.
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
    const record: StoredFile = { id, mime, bytes: blob.size, updatedAt: Date.now(), blob };
    await db.put(FILES, record, id);
    return { id, mime, bytes: record.bytes, updatedAt: record.updatedAt };
  }

  async get(id: string): Promise<Uint8Array | null> {
    const db = await this.open();
    const record = await db.get(FILES, id);
    if (!record) return null;
    return new Uint8Array(await record.blob.arrayBuffer());
  }

  /** The blob itself, for the viewer — it never needs a copy on the JS heap. */
  async getBlob(id: string): Promise<Blob | null> {
    const db = await this.open();
    return (await db.get(FILES, id))?.blob ?? null;
  }

  async stat(id: string): Promise<StoredFileMeta | null> {
    const db = await this.open();
    const record = await db.get(FILES, id);
    if (!record) return null;
    return { id: record.id, mime: record.mime, bytes: record.bytes, updatedAt: record.updatedAt };
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    await db.delete(FILES, id);
  }

  async list(): Promise<string[]> {
    const db = await this.open();
    return (await db.getAllKeys(FILES)) as string[];
  }

  async totalBytes(): Promise<number> {
    const db = await this.open();
    const records = await db.getAll(FILES);
    return records.reduce((sum, record) => sum + record.bytes, 0);
  }
}
