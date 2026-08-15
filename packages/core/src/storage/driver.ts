/**
 * The only thing a platform has to implement to give LexiPulse offline storage.
 *
 * Web supplies an IndexedDB driver, native an expo-sqlite one, tests the in-memory one.
 * Everything above this line — documents, progress, bookmarks, stats, migrations — is
 * shared code with shared tests.
 */
export interface StorageDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** All keys starting with `prefix`, in unspecified order. */
  keys(prefix: string): Promise<string[]>;
  /** Optional bulk read; the store falls back to N gets when absent. */
  getMany?(keys: string[]): Promise<(string | null)[]>;
  clear?(): Promise<void>;
}

/** Volatile driver for tests and for the landing-page demo. */
export class MemoryDriver implements StorageDriver {
  private readonly map = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.map.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }

  keys(prefix: string): Promise<string[]> {
    const out: string[] = [];
    for (const key of this.map.keys()) if (key.startsWith(prefix)) out.push(key);
    return Promise.resolve(out);
  }

  getMany(keys: string[]): Promise<(string | null)[]> {
    return Promise.resolve(keys.map((k) => this.map.get(k) ?? null));
  }

  clear(): Promise<void> {
    this.map.clear();
    return Promise.resolve();
  }
}
