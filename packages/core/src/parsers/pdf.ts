import type { DocumentChapter, LexiDocument } from '../types.js';
import { cleanPages } from './clean.js';
import { chunkIntoChapters, createDocumentId, finalizeDocument } from './shared.js';

/**
 * Structural types mirroring the slice of the pdf.js API we use.
 * Declared locally so `@lexipulse/core` stays runtime-free and can be bundled for
 * React Native, where pdf.js runs inside a WebView instead of the JS thread.
 */
export interface PdfTextItem {
  str: string;
  /** [scaleX, skewX, skewY, scaleY, translateX, translateY] */
  transform: number[];
  width: number;
  height?: number;
  hasEOL?: boolean;
}

export interface PdfPageProxy {
  getTextContent(): Promise<{ items: (PdfTextItem | { type: string })[] }>;
}

export interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  getMetadata?(): Promise<{ info?: Record<string, unknown> }>;
  destroy?(): Promise<void>;
}

export type PdfLoader = (data: Uint8Array) => Promise<PdfDocumentProxy>;

function isTextItem(item: PdfTextItem | { type: string }): item is PdfTextItem {
  return typeof (item as PdfTextItem).str === 'string';
}

/**
 * Rebuild visual lines from pdf.js text items.
 *
 * pdf.js emits positioned glyph runs, not lines. Grouping by baseline Y and inserting a
 * double space wherever the horizontal gap exceeds a character width is what lets the
 * smart filter recognise table columns further down the pipeline.
 */
export function itemsToLines(items: readonly PdfTextItem[], yTolerance = 2.2): string[] {
  const runs = items.filter((i) => i.str.length > 0);
  if (runs.length === 0) return [];

  interface Row {
    y: number;
    items: PdfTextItem[];
  }
  const rows: Row[] = [];

  for (const item of runs) {
    const y = item.transform[5] ?? 0;
    let row = rows.find((r) => Math.abs(r.y - y) <= yTolerance);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  // PDF origin is bottom-left: larger Y is higher on the page.
  rows.sort((a, b) => b.y - a.y);

  const lines: string[] = [];
  for (const row of rows) {
    row.items.sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0));
    let line = '';
    let previousEnd: number | null = null;
    let previousCharWidth = 0;

    for (const item of row.items) {
      const x = item.transform[4] ?? 0;
      const charWidth = item.str.length > 0 ? item.width / item.str.length : 0;
      if (previousEnd !== null) {
        const gap = x - previousEnd;
        const unit = Math.max(charWidth, previousCharWidth, 1);
        if (gap > unit * 2.2) line += '  '; // column gutter
        else if (gap > unit * 0.28) line += ' '; // ordinary word space
      }
      line += item.str;
      previousEnd = x + item.width;
      previousCharWidth = charWidth || previousCharWidth;
    }
    const trimmed = line.replace(/[ \t]+$/g, '');
    if (trimmed.trim().length > 0) lines.push(trimmed);
  }

  return lines;
}

/** Read every page of a pdf.js document as an array of visual lines. */
export async function extractPdfPages(
  doc: PdfDocumentProxy,
  onProgress?: (page: number, total: number) => void,
): Promise<string[][]> {
  const pages: string[][] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.filter(isTextItem);
    pages.push(itemsToLines(items));
    onProgress?.(n, doc.numPages);
  }
  return pages;
}

export interface PdfParseOptions {
  /**
   * Supplies the pdf.js document.
   *
   * Required, and deliberately so: web loads pdf.js from its own bundle so it can be
   * code-split, and native runs it inside a WebView. Hard-wiring one of the two here
   * would drag a megabyte of dead weight into the other platform's bundle.
   */
  loader: PdfLoader;
  origin?: string | null;
  /** Fallback title when the PDF has no metadata title. */
  fallbackTitle?: string;
  /** Words per pseudo-chapter (PDFs rarely carry usable structure). */
  chapterWords?: number;
  onProgress?: (page: number, total: number) => void;
  /** Disable table stripping for documents that are mostly data. */
  stripTables?: boolean;
}

function metaString(info: Record<string, unknown> | undefined, key: string): string | null {
  const value = info?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse a PDF into a reader-ready document, with the smart filter applied.
 */
export async function parsePdf(
  data: ArrayBuffer | Uint8Array,
  options: PdfParseOptions,
): Promise<LexiDocument> {
  const started = Date.now();
  const {
    loader,
    origin = null,
    fallbackTitle = 'PDF Document',
    chapterWords = 1400,
    onProgress,
    stripTables = true,
  } = options;

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await loader(bytes);

  try {
    const pages = await extractPdfPages(doc, onProgress);
    const cleaned = cleanPages(pages, { stripTables });

    if (cleaned.text.trim().length === 0) {
      throw new Error(
        'No extractable text found. This PDF is likely a scan — run OCR on it first.',
      );
    }

    const metadata = doc.getMetadata ? await doc.getMetadata().catch(() => undefined) : undefined;
    const info = metadata?.info;
    const title = metaString(info, 'Title') ?? fallbackTitle;
    const author = metaString(info, 'Author');
    const language = metaString(info, 'Language');

    const chapters: DocumentChapter[] = chunkIntoChapters(cleaned.text, chapterWords, 'Part');

    return finalizeDocument({
      id: createDocumentId('pdf', title),
      title,
      author,
      source: 'pdf',
      origin,
      language,
      chapters,
      coverDataUrl: null,
      importReport: {
        source: 'pdf',
        rawSections: pages.length,
        removed: cleaned.removed,
        dehyphenated: cleaned.dehyphenated,
        notes: buildPdfNotes(pages.length, cleaned),
        durationMs: Date.now() - started,
      },
    });
  } finally {
    await doc.destroy?.().catch(() => undefined);
  }
}

function buildPdfNotes(
  pageCount: number,
  cleaned: ReturnType<typeof cleanPages>,
): string[] {
  const notes = [`${pageCount} pages processed`];
  const { headers, footers, pageNumbers, tableRows, artifacts } = cleaned.removed;
  if (headers + footers > 0) notes.push(`${headers + footers} running head/foot lines removed`);
  if (pageNumbers > 0) notes.push(`${pageNumbers} page numbers removed`);
  if (tableRows > 0) notes.push(`${tableRows} table rows removed`);
  if (artifacts > 0) notes.push(`${artifacts} layout artifacts removed`);
  if (cleaned.dehyphenated > 0) {
    notes.push(`${cleaned.dehyphenated} hyphenated line breaks rejoined`);
  }
  return notes;
}
