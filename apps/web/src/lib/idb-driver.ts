import type { StorageDriver } from '@lexipulse/core';
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'lexipulse';
const DB_VERSION = 1;
const STORE = 'kv';

interface LexiDb {
  kv: { key: string; value: string };
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
    if (!this.db) {
      this.db = openDB<LexiDb>(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
        },
      });
    }
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
