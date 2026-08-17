import { describe, expect, it } from 'vitest';
import { MemoryFileStore, originalFileId, sweepOrphanedFiles } from './files.js';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('MemoryFileStore', () => {
  it('stores, reports and returns a file', async () => {
    const store = new MemoryFileStore();
    const meta = await store.put('a', bytes(1, 2, 3), 'application/pdf');

    expect(meta.bytes).toBe(3);
    expect(meta.mime).toBe('application/pdf');
    expect(await store.get('a')).toEqual(bytes(1, 2, 3));
    expect(await store.stat('a')).toEqual(meta);
    expect(await store.totalBytes()).toBe(3);
  });

  it('copies on the way in, so a reused buffer cannot rewrite a stored file', async () => {
    const store = new MemoryFileStore();
    const buffer = bytes(1, 2, 3);
    await store.put('a', buffer, 'application/pdf');
    buffer[0] = 9;

    expect(await store.get('a')).toEqual(bytes(1, 2, 3));
  });

  it('copies on the way out too', async () => {
    const store = new MemoryFileStore();
    await store.put('a', bytes(1, 2, 3), 'application/pdf');
    const read = (await store.get('a')) as Uint8Array;
    read[0] = 9;

    expect(await store.get('a')).toEqual(bytes(1, 2, 3));
  });

  it('answers null for what it does not hold', async () => {
    const store = new MemoryFileStore();
    expect(await store.get('missing')).toBeNull();
    expect(await store.stat('missing')).toBeNull();
    await expect(store.remove('missing')).resolves.toBeUndefined();
  });
});

describe('originalFileId', () => {
  it('is derived from the document id', () => {
    expect(originalFileId('pdf_report_abc')).toBe('original:pdf_report_abc');
  });
});

describe('sweepOrphanedFiles', () => {
  it('removes exactly what no document claims', async () => {
    const store = new MemoryFileStore();
    await store.put('original:a', bytes(1), 'application/pdf');
    await store.put('original:b', bytes(1), 'application/pdf');
    await store.put('original:c', bytes(1), 'application/pdf');

    const removed = await sweepOrphanedFiles(store, ['original:a', 'original:c']);

    expect(removed).toBe(1);
    expect((await store.list()).sort()).toEqual(['original:a', 'original:c']);
  });

  it('does nothing when everything is claimed', async () => {
    const store = new MemoryFileStore();
    await store.put('original:a', bytes(1), 'application/pdf');
    expect(await sweepOrphanedFiles(store, ['original:a'])).toBe(0);
  });
});
