import { LexiStore, MemoryDriver } from '@lexipulse/core';
import { IdbDriver } from './idb-driver';

let instance: LexiStore | null = null;
let ready: Promise<LexiStore> | null = null;

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
      store = new LexiStore(new IdbDriver());
      await store.init();
    } catch {
      store = new LexiStore(new MemoryDriver());
      await store.init();
    }
    instance = store;
    return store;
  })();
  return ready;
}
