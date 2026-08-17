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
  // Pictures become one PDF: a contract on the table, three photographs, something that
  // has to be signed and sent back.
  'image/png',
  'image/jpeg',
  'image/webp',
  // Some Android providers report an unknown type for .epub/.md — without this the file
  // is greyed out in the picker and the user cannot select it at all.
  'application/octet-stream',
];

/** Which of the picked files are pictures rather than documents. */
const IMAGE_MIME = /^image\/(png|jpeg|webp)$/;

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
    multiple: true,
  });
  if (result.canceled) return null;

  const assets = result.assets ?? [];
  const first = assets[0];
  if (!first) return null;

  const pictures = assets.filter((asset) => IMAGE_MIME.test(asset.mimeType ?? ''));
  if (pictures.length > 0 && pictures.length === assets.length) {
    return importPictures(pictures, options);
  }

  const bytes = await readFileBytes(first.uri);
  return withOriginal(
    await importDocument(bytes, {
      fileName: first.name || 'document',
      pdf: {
        loader: options.pdfLoader,
        // A scan carries no text at all. Refusing it was right while the app could only
        // read words out of a PDF; it can show and mark up the page now.
        allowEmptyText: true,
        onProgress: (page, total) => options.onProgress?.({ page, total }),
      },
    }),
    first.uri,
    first.name || 'document',
  );
}

/**
 * Several pictures, in the order they were picked, as one PDF.
 *
 * Built first and then imported as a PDF, so the viewer, the signature and the export are
 * the one path that already works rather than a second kind of document.
 */
async function importPictures(
  assets: readonly { uri: string; name: string; mimeType?: string | null }[],
  options: FileImportOptions,
): Promise<LexiDocument> {
  const pictures: { bytes: Uint8Array; mime: string }[] = [];
  for (const asset of assets) {
    pictures.push({
      bytes: await readFileBytes(asset.uri),
      mime: asset.mimeType ?? 'image/jpeg',
    });
  }

  const { imagesToPdf } = await import('@lexipulse/pdf/export');
  const bytes = await imagesToPdf(pictures);
  const name =
    assets.length === 1
      ? (assets[0] as { name: string }).name.replace(/\.[a-zA-Z0-9]+$/, '')
      : `${assets.length} Bilder`;

  const document = await importDocument(bytes, {
    fileName: `${name}.pdf`,
    pdf: { loader: options.pdfLoader, allowEmptyText: true },
  });
  return storeOriginal(document, bytes, `${name}.pdf`);
}

/** Keep the untouched file beside the parsed text, for the original surface. */
async function withOriginal(
  document: LexiDocument,
  uri: string,
  fileName: string,
): Promise<LexiDocument> {
  if (document.source !== 'pdf') return document;
  // Read again rather than reuse the bytes handed to the parser: pdf.js transfers that
  // buffer to its worker and leaves it detached on this side.
  return storeOriginal(document, await readFileBytes(uri), fileName);
}

async function storeOriginal(
  document: LexiDocument,
  bytes: Uint8Array,
  fileName: string,
): Promise<LexiDocument> {
  try {
    const { store } = await import('./store');
    const original = await store.putOriginal(document.id, bytes, {
      mime: 'application/pdf',
      fileName,
      pageCount: document.importReport.rawSections,
    });
    return original ? { ...document, original } : document;
  } catch {
    // No space, or a directory the platform refused. The text is parsed and worth
    // keeping — the reader loses the original page, not the document.
    return document;
  }
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
