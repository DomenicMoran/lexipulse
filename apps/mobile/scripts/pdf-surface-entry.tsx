/**
 * The original surface, running inside the app's own WebView.
 *
 * This is the same `PdfSurface` the website renders — pdf.js needs a DOM, a canvas and a
 * real `Worker`, none of which exist on the React Native JS thread, so the surface lives
 * in a WebView and the app around it plays host. Everything it needs from the device goes
 * over one message channel and lands in `PdfHost`.
 *
 * Importing the worker build first is what keeps it offline: it assigns
 * `globalThis.pdfjsWorker`, and pdf.js checks exactly that before trying to spawn a worker
 * from a URL, so it takes the main-thread path and never fetches anything.
 */
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.min.mjs';
import { createRoot } from 'react-dom/client';

import { configurePdfjs, PdfSurface, type PdfHost } from '@lexipulse/pdf';
import type { PdfFieldValue, PdfMark } from '@lexipulse/core';

import { base64ToBytes, bytesToBase64, frameBlob } from '../src/pdf/wire';

configurePdfjs(() => Promise.resolve(pdfjsLib as unknown as typeof import('pdfjs-dist')));

/* ------------------------------------------------------------------ transport */

declare global {
  interface Window {
    ReactNativeWebView: { postMessage(message: string): void };
    __lx: {
      chunk(id: number, data: string): void;
      resolve(id: number, ok: boolean, value: unknown, binary: boolean): void;
      start(config: string): void;
      theme(css: string): void;
    };
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  chunks: string[];
}

const pending = new Map<number, Pending>();
let nextId = 0;

/** Ask the app for something. `binary` is sent ahead of the call, in slices. */
function call(method: string, args: unknown[] = [], binary?: Uint8Array): Promise<unknown> {
  nextId += 1;
  const id = nextId;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, chunks: [] });

    if (binary) {
      for (const frame of frameBlob(id, bytesToBase64(binary))) {
        window.ReactNativeWebView.postMessage(JSON.stringify(frame));
      }
    }

    window.ReactNativeWebView.postMessage(
      JSON.stringify({ t: 'call', id, method, args, blob: binary !== undefined }),
    );
  });
}

window.__lx = {
  chunk(id, data) {
    pending.get(id)?.chunks.push(data);
  },
  resolve(id, ok, value, binary) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (!ok) {
      entry.reject(new Error(typeof value === 'string' ? value : 'Fehler'));
      return;
    }
    entry.resolve(binary ? base64ToBytes(entry.chunks.join('')) : value);
  },
  start(config) {
    mount(JSON.parse(config) as SurfaceConfig);
  },
  theme(css) {
    let style = document.getElementById('lx-theme');
    if (!style) {
      style = document.createElement('style');
      style.id = 'lx-theme';
      document.head.appendChild(style);
    }
    style.textContent = css;
  },
};

/* ------------------------------------------------------------------ the host */

interface SurfaceConfig {
  documentId: string;
  title: string;
  wordCount: number;
  fileName: string | null;
  initialPage: number;
  /** False when the document has no text to stream. */
  canStream: boolean;
}

function makeHost(config: SurfaceConfig): PdfHost {
  return {
    documentId: config.documentId,
    title: config.title,
    wordCount: config.wordCount,
    fileName: config.fileName,

    async loadOriginal() {
      const bytes = (await call('loadOriginal')) as Uint8Array;
      // No original arrives as no bytes, and an empty array would open as a broken file.
      return bytes.length > 0 ? bytes : null;
    },
    replaceOriginal: (bytes) => call('replaceOriginal', [], bytes) as Promise<void>,

    listMarks: () => call('listMarks') as Promise<PdfMark[]>,
    saveMark: (mark) => call('saveMark', [mark]) as Promise<void>,
    deleteMark: (id) => call('deleteMark', [id]) as Promise<void>,

    getFormValues: () => call('getFormValues') as Promise<Record<string, PdfFieldValue>>,
    setFormValues: (values) => call('setFormValues', [values]) as Promise<void>,

    putStamp: (bytes, mime) => call('putStamp', [mime], bytes) as Promise<string>,
    async getStamp(id) {
      const bytes = (await call('getStamp', [id])) as Uint8Array | null;
      // Length zero is how "not found" arrives: an empty chunk list decodes to no bytes.
      return bytes && bytes.length > 0 ? { bytes, mime: 'image/png' } : null;
    },

    deliver: (bytes, fileName, mime) =>
      call('deliver', [fileName, mime], bytes) as Promise<void>,

    async pickImage() {
      const picked = (await call('pickImage')) as { base64: string; mime: string } | null;
      if (!picked) return null;
      const bytes = base64ToBytes(picked.base64);
      return { bytes, mime: picked.mime, ratio: await aspectOf(bytes, picked.mime) };
    },

    ...(config.canStream
      ? { toStream: (page: number) => void call('toStream', [page]) }
      : {}),
  };
}

/**
 * height ÷ width of a picture, measured by decoding it.
 *
 * Done here rather than on the app side because this is where an image decoder exists.
 * A guessed aspect places every photograph distorted until the reader drags a corner.
 */
async function aspectOf(bytes: Uint8Array, mime: string): Promise<number> {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }));
  try {
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ w: image.naturalWidth, h: image.naturalHeight });
      image.onerror = () => reject(new Error('unreadable'));
      image.src = url;
    });
    return size.w > 0 ? size.h / size.w : 1;
  } catch {
    return 1;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------ mounting */

function mount(config: SurfaceConfig): void {
  const container = document.getElementById('root');
  if (!container) return;
  createRoot(container).render(
    <PdfSurface
      host={makeHost(config)}
      initialPage={config.initialPage}
      onBack={() => void call('close')}
    />,
  );
}

// The app sends `start` as soon as the page has loaded. Saying so removes a race where a
// fast device injects before the bundle has finished evaluating.
window.ReactNativeWebView?.postMessage(JSON.stringify({ t: 'ready' }));
