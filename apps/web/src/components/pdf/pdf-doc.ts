'use client';

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import * as React from 'react';
import { isPasswordError, loadPdfForRender } from '@/lib/pdf-loader';
import { getStore } from '@/lib/store';

/**
 * Opening, holding and searching the original PDF.
 *
 * Everything here works on the bytes the app already has on disk. Nothing is fetched, and
 * the file never leaves the tab — the same promise the import path makes, kept on the
 * surface that shows the page rather than the text.
 */

export type PdfLoadState =
  | { status: 'loading' }
  | { status: 'password'; wrong: boolean }
  | { status: 'error'; message: string }
  | { status: 'ready'; doc: PDFDocumentProxy; pageCount: number; sizes: PageSize[] };

export interface PageSize {
  /** Points at scale 1, already accounting for the page's own /Rotate. */
  width: number;
  height: number;
}

/**
 * Load a document's original and open it.
 *
 * Page geometry is read from the first page and assumed to hold for the rest, then
 * corrected as each page actually renders. Asking pdf.js for all 900 pages up front is
 * two seconds of nothing on screen for a document whose pages are almost always the same
 * size; guessing and correcting shows the first page immediately and settles silently.
 */
export function usePdfOriginal(documentId: string | null): {
  state: PdfLoadState;
  submitPassword: (password: string) => void;
  setPageSize: (pageNumber: number, size: PageSize) => void;
  /** Re-open the file from storage — after the editor has written a new version of it. */
  reload: () => void;
} {
  const [password, setPassword] = React.useState<string | undefined>(undefined);
  const [attempt, setAttempt] = React.useState(0);

  /*
   * The state is stored together with the attempt it belongs to, and "loading" is derived
   * rather than assigned. Setting it from the effect would be a second render pass in
   * which the screen still shows the previous document's pages — visible as a flash of
   * the wrong file every time the reader retypes a password.
   */
  const key = `${documentId ?? ''}|${password ?? ''}|${attempt}`;
  const [result, setResult] = React.useState<{ key: string; state: PdfLoadState } | null>(null);
  const state: PdfLoadState = result?.key === key ? result.state : { status: 'loading' };

  React.useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    const settle = (value: PdfLoadState) => {
      if (!cancelled) setResult({ key, state: value });
    };

    void (async () => {
      if (!documentId) {
        settle({ status: 'error', message: 'Kein Dokument ausgewählt.' });
        return;
      }
      try {
        const store = await getStore();
        const bytes = await store.getOriginal(documentId);
        if (cancelled) return;
        if (!bytes) {
          settle({
            status: 'error',
            message:
              'Von diesem Dokument liegt keine Originaldatei vor. Importieren Sie die PDF erneut, um die Seiten zu sehen.',
          });
          return;
        }

        const doc = await loadPdfForRender(bytes, password);
        if (cancelled) {
          void doc.destroy();
          return;
        }
        opened = doc;

        const first = await doc.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        const size: PageSize = { width: viewport.width, height: viewport.height };
        if (cancelled) return;

        settle({
          status: 'ready',
          doc,
          pageCount: doc.numPages,
          sizes: Array.from({ length: doc.numPages }, () => size),
        });
      } catch (error) {
        if (cancelled) return;
        if (isPasswordError(error)) {
          settle({ status: 'password', wrong: password !== undefined });
          return;
        }
        settle({
          status: 'error',
          message: 'Die Datei konnte nicht geöffnet werden. Möglicherweise ist sie beschädigt.',
        });
      }
    })();

    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [documentId, password, attempt, key]);

  const submitPassword = React.useCallback((value: string) => {
    setPassword(value);
    setAttempt((n) => n + 1);
  }, []);

  const reload = React.useCallback(() => setAttempt((n) => n + 1), []);

  const setPageSize = React.useCallback((pageNumber: number, size: PageSize) => {
    setResult((current) => {
      if (!current || current.state.status !== 'ready') return current;
      const existing = current.state.sizes[pageNumber - 1];
      if (existing && existing.width === size.width && existing.height === size.height) {
        return current;
      }
      const sizes = current.state.sizes.slice();
      sizes[pageNumber - 1] = size;
      return { key: current.key, state: { ...current.state, sizes } };
    });
  }, []);

  return { state, submitPassword, setPageSize, reload };
}

/* ------------------------------------------------------------------ outline */

export interface OutlineEntry {
  title: string;
  /** 1-based, or null when the destination could not be resolved. */
  page: number | null;
  depth: number;
}

interface RawOutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items?: RawOutlineItem[];
}

/**
 * The PDF's own table of contents, flattened with a depth marker.
 *
 * Flat rather than nested because the sidebar renders it as a list with indentation, and
 * a nested structure would need a second traversal to answer "which entry is the reader
 * on" on every scroll.
 */
export async function readOutline(doc: PDFDocumentProxy): Promise<OutlineEntry[]> {
  const raw = (await doc.getOutline().catch(() => null)) as RawOutlineItem[] | null;
  if (!raw || raw.length === 0) return [];

  const out: OutlineEntry[] = [];

  const resolve = async (dest: RawOutlineItem['dest']): Promise<number | null> => {
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      const ref = Array.isArray(explicit) ? explicit[0] : null;
      if (!ref || typeof ref !== 'object') return null;
      return (await doc.getPageIndex(ref as never)) + 1;
    } catch {
      return null;
    }
  };

  const walk = async (items: RawOutlineItem[], depth: number): Promise<void> => {
    for (const item of items) {
      const title = (item.title ?? '').replace(/\s+/g, ' ').trim();
      if (title.length > 0) out.push({ title, page: await resolve(item.dest), depth });
      if (item.items && item.items.length > 0) await walk(item.items, depth + 1);
    }
  };

  await walk(raw, 0);
  return out;
}

/* ------------------------------------------------------------------ links */

export interface PageLink {
  /** Rectangle in PDF points, [x1, y1, x2, y2] with the origin bottom-left. */
  rect: number[];
  /** Set for a jump inside the document. */
  page?: number;
  /** Set for an external address. */
  url?: string;
}

/**
 * The link annotations on one page.
 *
 * Built by hand instead of through pdf.js's own annotation layer, which wants a link
 * service, a download manager and a whole viewer application around it. A link is a
 * rectangle and a target; that is all this needs to be.
 */
export async function readLinks(doc: PDFDocumentProxy, page: PDFPageProxy): Promise<PageLink[]> {
  const annotations = await page.getAnnotations({ intent: 'display' }).catch(() => []);
  const links: PageLink[] = [];

  for (const annotation of annotations as Record<string, unknown>[]) {
    if (annotation.subtype !== 'Link') continue;
    const rect = annotation.rect as number[] | undefined;
    if (!Array.isArray(rect) || rect.length < 4) continue;

    const url = typeof annotation.url === 'string' ? annotation.url : undefined;
    if (url) {
      // Only ever web addresses. A `javascript:` or `file:` target out of an untrusted
      // document has no business being clickable.
      if (/^https?:\/\//i.test(url)) links.push({ rect, url });
      continue;
    }

    const dest = annotation.dest;
    if (!dest) continue;
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      const ref = Array.isArray(explicit) ? explicit[0] : null;
      if (!ref || typeof ref !== 'object') continue;
      links.push({ rect, page: (await doc.getPageIndex(ref as never)) + 1 });
    } catch {
      // A broken destination is not worth a broken page.
    }
  }

  return links;
}

/* ------------------------------------------------------------------ search */

export interface SearchHit {
  page: number;
  /** Rectangles in PDF points, one per text run the match spans. */
  rects: number[][];
  /** The matched text with a little context either side, for the hit list. */
  preview: string;
  /** Where the match starts in the page's own text, for stable ordering. */
  offset: number;
}

interface PageText {
  /** Normalised text of the whole page, one space between runs. */
  text: string;
  runs: TextRun[];
}

interface TextRun {
  /** Offset of this run's first character in `text`. */
  start: number;
  length: number;
  /** [x, y] of the run's baseline start, in PDF points. */
  x: number;
  y: number;
  width: number;
  height: number;
}

const pageTextCache = new WeakMap<PDFDocumentProxy, Map<number, PageText>>();

/** Accent- and case-insensitive, the way the rest of the app searches. */
export function foldForSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

async function getPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<PageText> {
  let cache = pageTextCache.get(doc);
  if (!cache) {
    cache = new Map();
    pageTextCache.set(doc, cache);
  }
  const cached = cache.get(pageNumber);
  if (cached) return cached;

  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();

  let text = '';
  const runs: TextRun[] = [];

  for (const item of content.items) {
    const str = (item as { str?: string }).str;
    if (typeof str !== 'string' || str.length === 0) continue;
    const transform = (item as { transform: number[] }).transform;
    const width = (item as { width: number }).width;
    const height = (item as { height?: number }).height ?? Math.abs(transform[3] ?? 10);

    runs.push({
      start: text.length,
      length: str.length,
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
      width,
      height,
    });
    text += str;
    if ((item as { hasEOL?: boolean }).hasEOL) text += ' ';
  }

  const result: PageText = { text, runs };
  cache.set(pageNumber, result);
  return result;
}

/** Rectangles covering `[start, end)` of a page's text, one per run it touches. */
function rectsForRange(runs: readonly TextRun[], start: number, end: number): number[][] {
  const rects: number[][] = [];
  for (const run of runs) {
    const runEnd = run.start + run.length;
    if (runEnd <= start || run.start >= end) continue;

    const from = Math.max(start, run.start) - run.start;
    const to = Math.min(end, runEnd) - run.start;
    // Characters are assumed even in width inside a run. A run is a single styled glyph
    // sequence, so the error is a fraction of a character and invisible behind a highlight.
    const perChar = run.length > 0 ? run.width / run.length : 0;
    const x1 = run.x + perChar * from;
    const x2 = run.x + perChar * to;
    rects.push([x1, run.y, x2, run.y + run.height]);
  }
  return rects;
}

/**
 * Search the whole document, page by page, reporting as it goes.
 *
 * Incremental on purpose: on a 600-page book the first hits are on screen while the tail
 * is still being read, and an abort signal stops the walk the moment the reader types the
 * next letter.
 */
export async function searchPdf(
  doc: PDFDocumentProxy,
  query: string,
  options: { signal?: AbortSignal; limit?: number; onBatch?: (hits: SearchHit[]) => void } = {},
): Promise<SearchHit[]> {
  const needle = foldForSearch(query.trim());
  if (needle.length === 0) return [];

  const limit = options.limit ?? 500;
  const found: SearchHit[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    if (options.signal?.aborted) break;

    const { text, runs } = await getPageText(doc, pageNumber);
    const haystack = foldForSearch(text);
    if (haystack.length !== text.length) {
      // Folding changed the length (a ligature, a decomposed character that lost its
      // mark). Offsets would no longer line up with the runs, so this page is matched
      // without highlight rectangles rather than with wrong ones.
      const hits = matchOffsets(haystack, needle).map((offset) => ({
        page: pageNumber,
        rects: [],
        preview: previewAt(text, offset, needle.length),
        offset,
      }));
      if (hits.length > 0) {
        found.push(...hits);
        options.onBatch?.(hits);
      }
      if (found.length >= limit) break;
      continue;
    }

    const hits = matchOffsets(haystack, needle).map((offset) => ({
      page: pageNumber,
      rects: rectsForRange(runs, offset, offset + needle.length),
      preview: previewAt(text, offset, needle.length),
      offset,
    }));

    if (hits.length > 0) {
      found.push(...hits);
      options.onBatch?.(hits);
    }
    if (found.length >= limit) break;
  }

  return found.slice(0, limit);
}

function matchOffsets(haystack: string, needle: string): number[] {
  const offsets: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    offsets.push(at);
    from = at + needle.length;
  }
  return offsets;
}

function previewAt(text: string, offset: number, length: number): string {
  const before = text.slice(Math.max(0, offset - 40), offset).replace(/\s+/g, ' ');
  const match = text.slice(offset, offset + length);
  const after = text.slice(offset + length, offset + length + 40).replace(/\s+/g, ' ');
  return `${offset > 40 ? '…' : ''}${before}${match}${after}${
    offset + length + 40 < text.length ? '…' : ''
  }`;
}
