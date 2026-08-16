import { LexiStore } from '@lexipulse/core/storage';

import { SqliteDriver } from './sqlite-driver';

/**
 * One store for the whole process.
 *
 * Every screen reads through it, and two instances would mean two SQLite handles racing
 * on the same file — so it is created once and `init()` is awaited exactly once.
 */
export const driver = new SqliteDriver();
export const store = new LexiStore(driver);

let ready: Promise<void> | null = null;

export function initStore(): Promise<void> {
  ready ??= store.init();
  return ready;
}

/**
 * Whether the user has ever saved settings.
 *
 * `LexiStore.getSettings()` normalises a missing record into the defaults, so it cannot
 * distinguish "never configured" from "configured exactly like the defaults" — and the
 * first launch needs that distinction to adopt the system colour scheme.
 */
export async function hasPersistedSettings(): Promise<boolean> {
  const keys = await driver.keys('lexi:settings');
  return keys.length > 0;
}
