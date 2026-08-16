import type { PdfDocumentProxy } from '@lexipulse/core';

/**
 * pdf.js loader for the web app.
 *
 * Imported dynamically on purpose: pdf.js is well over a megabyte and only a fraction of
 * visitors ever open a PDF. Keeping it behind `await import()` leaves it out of the
 * initial bundle entirely.
 *
 * `disableFontFace` stops pdf.js from injecting embedded fonts into the document — we
 * only ever read text content, never render a page, so the fonts are pure cost and a
 * needless attack surface. `isEvalSupported: false` removes the last code path that
 * would build functions from PDF-supplied data.
 */
export async function loadPdf(data: Uint8Array): Promise<PdfDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });

  const doc = await task.promise;
  return doc as unknown as PdfDocumentProxy;
}
