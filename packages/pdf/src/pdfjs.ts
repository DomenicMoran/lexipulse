import type * as PdfjsNamespace from 'pdfjs-dist';

/**
 * How this package gets hold of pdf.js.
 *
 * It does not import it. Two hosts need two entirely different ways of loading the same
 * library, and both of them are the right answer where they are used:
 *
 * - The web app fetches it as a real ES module from its own origin, because bundling a
 *   two-megabyte `.mjs` from a package without `"type": "module"` breaks webpack's interop
 *   in development.
 * - The mobile WebView has it inlined into the single HTML file it is loaded from, because
 *   a page served from `file://` cannot import a sibling module at all.
 *
 * Whoever mounts the surface says which. Calling anything here before that is a
 * programming error, and it says so rather than silently loading nothing.
 */

export type PdfjsModule = typeof PdfjsNamespace;

let provider: (() => Promise<PdfjsModule>) | null = null;
let pending: Promise<PdfjsModule> | null = null;

/** Give the package its pdf.js. Called once, before the surface is mounted. */
export function configurePdfjs(load: () => Promise<PdfjsModule>): void {
  provider = load;
  pending = null;
}

export function getPdfjs(): Promise<PdfjsModule> {
  if (!provider) {
    return Promise.reject(
      new Error('configurePdfjs() has not been called — the host must supply pdf.js.'),
    );
  }
  if (!pending) pending = provider();
  return pending;
}

/**
 * True when pdf.js refused a document for want of the right password.
 *
 * Matched on the name rather than with `instanceof`: `PasswordException` is not on the
 * entry point pdf.js publishes types for, and the class the worker throws is not
 * necessarily the class this module would import anyway.
 */
export function isPasswordError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'PasswordException';
}
