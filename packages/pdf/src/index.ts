/**
 * The original surface: rendering a PDF page and working on it.
 *
 * Platform-agnostic in the same sense `@lexipulse/core` is, one level up: it needs a DOM
 * and a canvas, but it does not care whether that DOM belongs to a browser tab or to a
 * WebView inside the mobile app. Everything else — storage, file delivery, picking an
 * image — comes in through `PdfHost`.
 */

export * from './document.js';
export * from './export.js';
export * from './geometry.js';
export * from './host.js';
export * from './mark-layer.js';
export * from './pdfjs.js';
export * from './surface.js';
export * from './tools.js';
export { PdfViewer, ToolButton } from './viewer.js';
export type { PageGeometry, PdfViewerHandle, PdfViewerProps, ZoomMode } from './viewer.js';
export { SignatureDialog, trimTransparent } from './signature-dialog.js';
export type { SignatureResult } from './signature-dialog.js';
