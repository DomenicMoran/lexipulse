/**
 * The page that runs inside the hidden WebView.
 *
 * pdf.js is a browser library — it wants a DOM, a real `Worker`, `DOMMatrix`. None of
 * that exists on the React Native JS thread, which is why this runs in a WebView instead
 * of being imported directly. The WebView never renders anything: it opens the PDF,
 * hands back positioned text runs, and closes.
 *
 * Importing the worker build first is what keeps the whole thing offline. It assigns
 * `globalThis.pdfjsWorker`, and pdf.js's `PDFWorker.#initialize` checks exactly that
 * before it tries to spawn a real worker from a URL — so it takes the main-thread path
 * and never fetches anything. Verified against pdfjs-dist 5.4.149.
 */
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.min.mjs';

/** Replies are framed so a long page cannot blow the postMessage size limit. */
const CHUNK = 96 * 1024;

let group = 0;

function post(object) {
  const json = JSON.stringify(object);
  const parts = Math.max(1, Math.ceil(json.length / CHUNK));
  group += 1;
  const g = group;
  for (let p = 0; p < parts; p += 1) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ g, p, n: parts, d: json.slice(p * CHUNK, (p + 1) * CHUNK) }),
    );
  }
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Slices of the uploaded file, accumulated until `open` arrives. */
let inbox = [];
let doc = null;

async function handle(message) {
  const { id, type } = message;
  try {
    switch (type) {
      case 'open': {
        const bytes = base64ToBytes(inbox.join(''));
        inbox = [];
        if (doc) {
          await doc.destroy().catch(() => undefined);
          doc = null;
        }
        doc = await pdfjsLib.getDocument({
          data: bytes,
          // Text extraction needs no glyph rasterisation, and both of these would pull
          // remote resources on a device that may well be offline.
          disableFontFace: true,
          useSystemFonts: false,
          isEvalSupported: false,
          verbosity: 0,
        }).promise;

        let info = {};
        try {
          const metadata = await doc.getMetadata();
          info = metadata && metadata.info ? metadata.info : {};
        } catch {
          info = {};
        }
        post({ id, ok: true, numPages: doc.numPages, info });
        return;
      }

      case 'page': {
        if (!doc) throw new Error('no document open');
        const page = await doc.getPage(message.page);
        const content = await page.getTextContent();
        // Only the four fields `itemsToLines` reads survive the hop. Sending the full
        // pdf.js item would multiply the payload for no gain.
        const items = [];
        for (const item of content.items) {
          if (typeof item.str !== 'string' || item.str.length === 0) continue;
          items.push([item.str, item.transform[4], item.transform[5], item.width]);
        }
        page.cleanup();
        post({ id, ok: true, items });
        return;
      }

      case 'close': {
        if (doc) {
          await doc.destroy().catch(() => undefined);
          doc = null;
        }
        inbox = [];
        post({ id, ok: true });
        return;
      }

      default:
        throw new Error(`unknown message: ${String(type)}`);
    }
  } catch (error) {
    post({ id, ok: false, error: String((error && error.message) || error) });
  }
}

/**
 * File upload has its own entry point.
 *
 * The React side injects these as source text, and base64 needs no escaping — which a
 * JSON envelope carrying the same payload would. It also keeps a 50 MB file out of the
 * control-message path entirely.
 */
window.__lexiPdfChunk = (base64) => {
  inbox.push(base64);
};

window.__lexiPdf = (json) => {
  let message;
  try {
    message = JSON.parse(json);
  } catch (error) {
    post({ id: -1, ok: false, error: `bad request: ${String(error)}` });
    return;
  }
  void handle(message);
};

// Handshake: the React side waits for this before it sends anything, so a slow WebView
// boot can never drop the first chunk of a file.
post({ id: 0, ok: true, ready: true, version: pdfjsLib.version });
