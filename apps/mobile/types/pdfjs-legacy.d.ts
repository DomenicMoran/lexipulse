/**
 * The legacy pdf.js builds, as imported by the WebView bundles.
 *
 * `pdfjs-dist` ships types only for its main entry, and the two files bundled into the
 * WebView assets are the legacy ones — those are what run in an older Android WebView.
 * The surface entry casts the namespace to the typed API immediately, so this only has to
 * say the modules exist.
 */
declare module 'pdfjs-dist/legacy/build/pdf.min.mjs';
declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
