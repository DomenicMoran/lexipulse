import * as FileSystem from 'expo-file-system';

import type { FileStore, StoredFileMeta } from '@lexipulse/core/storage';

/**
 * Original documents, as files in the app's own directory.
 *
 * Not rows in the SQLite table beside everything else: a 40 MB PDF would have to be
 * base64-encoded to fit in a TEXT column, which inflates it by a third and makes every
 * read and write copy the whole thing through JavaScript strings. A file is a file.
 *
 * The directory is inside the app container, so it is private to LexiPulse, backed up
 * with the app on iOS, and removed with it on both platforms.
 */
const DIRECTORY = 'originals';

/**
 * The name a file is stored under: the id, base64url-encoded.
 *
 * Reversible on purpose. `sweepOrphanedFiles` compares what `list()` reports against the
 * ids documents claim, so a one-way mapping — replacing every unsafe character with an
 * underscore — would make every stored file look unclaimed and delete the lot on the
 * first sweep. Encoding also keeps a colon out of a path, which iOS tolerates and other
 * tools do not.
 */
function fileNameFor(id: string): string {
  // Ids are ASCII by construction: `createDocumentId` slugs the title down to
  // `[a-z0-9-]`, and a stamp id is built the same way. No UTF-8 dance needed.
  const base64 = btoa(id);
  return `${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.bin`;
}

function idFromFileName(name: string): string | null {
  const stem = name.endsWith('.bin') ? name.slice(0, -4) : null;
  if (stem === null) return null;
  const base64 = stem.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  } catch {
    return null;
  }
}

export class NativeFileStore implements FileStore {
  private readonly root = new FileSystem.Directory(FileSystem.Paths.document, DIRECTORY);

  private ensure(): FileSystem.Directory {
    if (!this.root.exists) this.root.create({ intermediates: true });
    return this.root;
  }

  put(id: string, bytes: Uint8Array, mime: string): Promise<StoredFileMeta> {
    const file = new FileSystem.File(this.ensure(), fileNameFor(id));
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return Promise.resolve({
      id,
      mime,
      bytes: file.size ?? bytes.byteLength,
      updatedAt: Date.now(),
    });
  }

  get(id: string): Promise<Uint8Array | null> {
    const file = new FileSystem.File(this.ensure(), fileNameFor(id));
    if (!file.exists) return Promise.resolve(null);
    return Promise.resolve(file.bytes());
  }

  stat(id: string): Promise<StoredFileMeta | null> {
    const file = new FileSystem.File(this.ensure(), fileNameFor(id));
    if (!file.exists) return Promise.resolve(null);
    return Promise.resolve({
      id,
      // The type is not stored beside the file; every original this app keeps is a PDF,
      // and a stamp is a PNG. Guessing from the name is honest enough for both.
      mime: id.startsWith('stamp:') ? 'image/png' : 'application/pdf',
      bytes: file.size ?? 0,
      updatedAt: file.modificationTime ?? Date.now(),
    });
  }

  remove(id: string): Promise<void> {
    const file = new FileSystem.File(this.ensure(), fileNameFor(id));
    if (file.exists) file.delete();
    return Promise.resolve();
  }

  /** Every id currently held, decoded back from the stored names. */
  list(): Promise<string[]> {
    const directory = this.ensure();
    const ids: string[] = [];
    for (const entry of directory.list()) {
      if (!(entry instanceof FileSystem.File)) continue;
      const id = idFromFileName(entry.name);
      if (id !== null) ids.push(id);
    }
    return Promise.resolve(ids);
  }

  totalBytes(): Promise<number> {
    const directory = this.ensure();
    let total = 0;
    for (const entry of directory.list()) {
      if (entry instanceof FileSystem.File) total += entry.size ?? 0;
    }
    return Promise.resolve(total);
  }

  /** The path a file sits at, for handing it to the share sheet. */
  uriFor(id: string): string {
    return new FileSystem.File(this.ensure(), fileNameFor(id)).uri;
  }
}
