import type { LexiDocument } from '../types.js';
import { parseEpub, type EpubParseOptions } from './epub.js';
import { parsePdf, type PdfParseOptions } from './pdf.js';
import { parseText, type TextParseOptions } from './text.js';
import { parseArticleHtml, type ArticleParseOptions } from './web.js';

export * from './clean.js';
export * from './epub.js';
export * from './html-text.js';
export * from './pdf.js';
export * from './shared.js';
export * from './text.js';
export * from './web.js';

export type ImportKind = 'epub' | 'pdf' | 'html' | 'markdown' | 'text';

/** Magic bytes / extension sniffing — never trust the MIME type a picker reports. */
export function detectKind(fileName: string, bytes?: Uint8Array): ImportKind {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();

  if (bytes && bytes.length >= 5) {
    // %PDF-
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'pdf';
    }
    // PK zip header — EPUB is a zip; .zip that is not an EPUB fails later with a clear error.
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'epub';
  }

  if (ext === 'epub') return 'epub';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'markdown';
  if (ext === 'html' || ext === 'htm' || ext === 'xhtml') return 'html';
  return 'text';
}

export interface ImportOptions {
  fileName?: string;
  epub?: EpubParseOptions;
  pdf?: PdfParseOptions;
  html?: ArticleParseOptions;
  text?: TextParseOptions;
}

const DECODER_FALLBACK = 'utf-8';

function decode(bytes: Uint8Array): string {
  // BOM sniffing keeps Windows-exported .txt files from starting with a stray glyph.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder(DECODER_FALLBACK).decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  return new TextDecoder(DECODER_FALLBACK).decode(bytes);
}

/**
 * One entry point for every supported source.
 * The reader UI calls exactly this; format detection is not the user's problem.
 */
export async function importDocument(
  data: ArrayBuffer | Uint8Array,
  options: ImportOptions = {},
): Promise<LexiDocument> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const fileName = options.fileName ?? 'document';
  const kind = detectKind(fileName, bytes);

  switch (kind) {
    case 'epub':
      return parseEpub(bytes, { origin: fileName, ...options.epub });
    case 'pdf': {
      if (!options.pdf?.loader) {
        throw new Error(
          'PDF import needs a pdf.js loader. Pass options.pdf.loader — web supplies it from ' +
            'its own bundle, native from the WebView bridge.',
        );
      }
      return parsePdf(bytes, {
        origin: fileName,
        fallbackTitle: stripExtension(fileName),
        ...options.pdf,
      });
    }
    case 'html':
      return parseArticleHtml(decode(bytes), {
        fallbackTitle: stripExtension(fileName),
        ...options.html,
      });
    case 'markdown':
      return parseText(decode(bytes), {
        source: 'markdown',
        title: stripExtension(fileName),
        origin: fileName,
        ...options.text,
      });
    default:
      return parseText(decode(bytes), {
        source: 'text',
        title: stripExtension(fileName),
        origin: fileName,
        ...options.text,
      });
  }
}

export function stripExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const idx = base.lastIndexOf('.');
  const name = idx > 0 ? base.slice(0, idx) : base;
  return name.replace(/[_-]+/g, ' ').trim() || 'Document';
}
