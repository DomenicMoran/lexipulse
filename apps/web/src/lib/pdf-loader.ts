import type { PdfDocumentProxy } from '@lexipulse/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * pdf.js, loaded from our own origin as a real ES module.
 *
 * Not bundled, and deliberately so. pdf.js ships as one two-megabyte `.mjs` file inside a
 * package that declares no `"type": "module"`; webpack's interop for that combination is
 * broken in development — the module factory is handed no exports object and the import
 * dies on `__webpack_require__.r` at line one. Loading it by URL removes the bundler from
 * the picture: identical behaviour in development and production, two megabytes out of
 * every build, and the library still comes from `lexipulse.de` and nowhere else.
 *
 * `scripts/copy-pdfjs-assets.mjs` puts the files under `public/pdfjs/` on every build, so
 * the copy can never drift from the version in `package.json`. Types still come from the
 * installed package — `import type` is erased, so it costs nothing at runtime.
 */

const BASE = '/pdfjs';
const MODULE_URL = `${BASE}/pdf.mjs`;
const WORKER_URL = `${BASE}/pdf.worker.mjs`;
/** Static copies of the pdf.js data directories, for CJK encodings and standard fonts. */
const CMAP_URL = `${BASE}/cmaps/`;
const STANDARD_FONTS_URL = `${BASE}/standard_fonts/`;

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Load pdf.js once and point it at its worker. */
export function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    // Through a variable so no bundler can statically resolve it and pull the library into
    // the graph after all. The comment covers the bundlers that look for it anyway.
    const url = MODULE_URL;
    pdfjsPromise = import(/* webpackIgnore: true */ /* @vite-ignore */ url).then(
      (module: unknown) => {
        const pdfjs = module as PdfjsModule;
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
        return pdfjs;
      },
    );
  }
  return pdfjsPromise;
}

/**
 * The import path: text only.
 *
 * `disableFontFace` stops pdf.js from injecting embedded fonts into the document — the
 * parser only ever reads text content, so the fonts are pure cost and a needless attack
 * surface. `isEvalSupported: false` removes the last code path that would build functions
 * from PDF-supplied data.
 */
export async function loadPdf(data: Uint8Array, password?: string): Promise<PdfDocumentProxy> {
  const pdfjs = await getPdfjs();

  const task = pdfjs.getDocument({
    data,
    password,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
  });

  const doc = await task.promise;
  return doc as unknown as PdfDocumentProxy;
}

/**
 * The viewer path: everything needed to draw the page as its author saw it.
 *
 * `cMapUrl` and `standardFontDataUrl` are what make a CJK document and a PDF that relies
 * on the fourteen standard fonts render at all instead of coming up blank. Both are
 * served from our own origin, so nothing is fetched from a third party.
 *
 * `isEvalSupported` stays false here too. pdf.js uses `eval` to speed up font programs;
 * turning that off costs a little scroll performance on font-heavy documents and removes
 * the only place where bytes out of an untrusted file become code.
 */
export async function loadPdfForRender(
  data: Uint8Array,
  password?: string,
): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();

  const task = pdfjs.getDocument({
    data,
    password,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
    isEvalSupported: false,
    verbosity: 0,
  });

  return task.promise;
}

/**
 * True when pdf.js refused a document for want of the right password.
 *
 * Matched on the name rather than with `instanceof`: `PasswordException` is not on the
 * public entry point pdf.js publishes types for, and the class the worker throws is not
 * necessarily the class this module would import anyway.
 */
export function isPasswordError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'PasswordException';
}
