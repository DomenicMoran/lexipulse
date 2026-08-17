import { LexiStore, MemoryDriver, MemoryFileStore, type FileStore } from '@lexipulse/core';
import { IdbDriver, IdbFileStore } from './idb-driver';

let instance: LexiStore | null = null;
let ready: Promise<LexiStore> | null = null;
let files: FileStore | null = null;

/**
 * The one `LexiStore` the app uses.
 *
 * Falls back to the in-memory driver when IndexedDB is unavailable (private windows in
 * some browsers, hardened settings). The reader then works for the session and simply
 * forgets afterwards, which beats a blank screen.
 */
export function getStore(): Promise<LexiStore> {
  if (ready) return ready;
  ready = (async () => {
    if (instance) return instance;
    let store: LexiStore;
    try {
      files = new IdbFileStore();
      store = new LexiStore(new IdbDriver(), files);
      await store.init();
    } catch {
      files = new MemoryFileStore();
      store = new LexiStore(new MemoryDriver(), files);
      await store.init();
    }
    instance = store;
    return store;
  })();
  return ready;
}

/**
 * The store holding original files.
 *
 * Goes through `getStore()` first so both land on the same backing — an IndexedDB file
 * store next to an in-memory key-value store would keep originals for documents the
 * library has already forgotten.
 */
export async function getFileStore(): Promise<FileStore> {
  await getStore();
  return files as FileStore;
}
