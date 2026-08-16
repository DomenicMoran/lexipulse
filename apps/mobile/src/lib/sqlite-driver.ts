import * as SQLite from 'expo-sqlite';

import type { StorageDriver } from '@lexipulse/core/storage';

/**
 * `StorageDriver` on top of expo-sqlite.
 *
 * A single `kv` table, not a schema per entity: `LexiStore` already owns the shape of
 * every record and is tested against `MemoryDriver`, so the only thing this layer must
 * get right is that a key round-trips exactly. SQLite rather than AsyncStorage because a
 * novel-sized document serialises to megabytes, which is well past what AsyncStorage
 * handles comfortably on Android.
 */
const DATABASE = 'lexipulse.db';

export class SqliteDriver implements StorageDriver {
  private db: SQLite.SQLiteDatabase | null = null;
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;

  private async handle(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;
    // Concurrent callers must share one open() — two of them would race on the CREATE.
    this.opening ??= (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE);
      await db.execAsync(
        // WAL keeps a long import from blocking the reads the library screen is doing.
        'PRAGMA journal_mode = WAL;' +
          'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
      );
      this.db = db;
      return db;
    })();
    return this.opening;
  }

  async get(key: string): Promise<string | null> {
    const db = await this.handle();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.handle();
    await db.runAsync(
      'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }

  async delete(key: string): Promise<void> {
    const db = await this.handle();
    await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  }

  async keys(prefix: string): Promise<string[]> {
    const db = await this.handle();
    // `LIKE prefix || '%'` with the prefix bound as a parameter: the keys are built from
    // document ids, and an id containing `%` or `_` would otherwise match half the table.
    const rows = await db.getAllAsync<{ key: string }>(
      "SELECT key FROM kv WHERE key LIKE ? || '%' ESCAPE '\\'",
      escapeLike(prefix),
    );
    return rows.map((row) => row.key);
  }

  async getMany(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    const db = await this.handle();
    const placeholders = keys.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM kv WHERE key IN (${placeholders})`,
      ...keys,
    );
    const found = new Map(rows.map((row) => [row.key, row.value]));
    return keys.map((key) => found.get(key) ?? null);
  }

  async clear(): Promise<void> {
    const db = await this.handle();
    await db.execAsync('DELETE FROM kv;');
  }
}

/** Neutralise LIKE wildcards so a prefix is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
