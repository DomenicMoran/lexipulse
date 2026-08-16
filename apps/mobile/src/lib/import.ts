import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { isProbablyUrl, normalizeUrl } from './url';
import {
  fetchArticle,
  importDocument,
  parseText,
  type LexiDocument,
  type PdfLoader,
} from '@lexipulse/core';

/**
 * Every route a document can enter the app by.
 *
 * All three end at `importDocument`/`parse*` in `@lexipulse/core`, which is where the
 * actual parsing and the smart filter live. This module only deals with the platform
 * edges: picking a file, turning it into bytes, and fetching a URL.
 */

/** Extensions the picker offers. iOS wants UTIs, Android MIME types; both accept these. */
const ACCEPTED_MIME = [
  'application/epub+zip',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/xhtml+xml',
  // Some Android providers report an unknown type for .epub/.md — without this the file
  // is greyed out in the picker and the user cannot select it at all.
  'application/octet-stream',
];

export interface ImportProgress {
  /** 1-based page currently being extracted, PDF only. */
  page: number;
  total: number;
}

export interface FileImportOptions {
  pdfLoader: PdfLoader;
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Open the system picker and import whatever comes back.
 * Returns `null` when the user cancels — that is not an error path.
 */
export async function importFromPicker(
  options: FileImportOptions,
): Promise<LexiDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_MIME,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  const bytes = await readFileBytes(asset.uri);
  return importDocument(bytes, {
    fileName: asset.name || 'document',
    pdf: {
      loader: options.pdfLoader,
      onProgress: (page, total) => options.onProgress?.({ page, total }),
    },
  });
}

/**
 * Read a file into memory as bytes.
 *
 * `File` implements `Blob`, so `arrayBuffer()` returns the raw bytes. Reading as a string
 * would be wrong for EPUB and PDF alike — both are binary, and any byte sequence that is
 * not valid UTF-8 would come back replaced.
 */
export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const file = new FileSystem.File(uri);
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Import a web article.
 *
 * Native has no same-origin policy, so unlike the web app this needs no proxy — the page
 * is fetched directly and never touches a server of ours.
 */
export async function importFromUrl(url: string): Promise<LexiDocument> {
  const normalized = normalizeUrl(url);
  return fetchArticle(normalized, fetch);
}

/** Import text the user copied somewhere else. */
export function importFromText(text: string): LexiDocument {
  return parseText(text, { source: 'clipboard', origin: null });
}

export { isProbablyUrl, normalizeUrl };
