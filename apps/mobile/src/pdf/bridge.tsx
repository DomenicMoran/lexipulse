import { Asset } from 'expo-asset';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { PdfDocumentProxy, PdfLoader, PdfTextItem } from '@lexipulse/core';

import { bytesToBase64 } from './base64';

/**
 * React Native side of the pdf.js bridge.
 *
 * pdf.js cannot run on the RN JS thread — it needs a DOM, `DOMMatrix` and a real
 * `Worker`. So a zero-sized WebView hosts it and this module speaks a small request/reply
 * protocol to it. The page (`assets/pdfjs/pdf-bridge.html`) is bundled, never fetched:
 * PDF import has to work in flight mode like everything else in this app.
 */

/** Base64 is streamed in slices — a multi-megabyte `evaluateJavascript` call fails on Android. */
const UPLOAD_CHUNK = 96 * 1024;

/** Compact wire form of a text item: [text, x, y, width]. */
type WireItem = [string, number, number, number];

interface Reply {
  id: number;
  ok: boolean;
  error?: string;
  ready?: boolean;
  version?: string;
  numPages?: number;
  info?: Record<string, unknown>;
  items?: WireItem[];
}

interface Pending {
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PdfBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfBridgeError';
  }
}

interface BridgeApi {
  /** A `PdfLoader` for `parsePdf` / `importDocument`, backed by this WebView. */
  createLoader: () => PdfLoader;
  ready: boolean;
}

const BridgeContext = createContext<BridgeApi | null>(null);

export function PdfBridgeProvider({ children }: { children: React.ReactNode }) {
  const webRef = useRef<WebView | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /**
   * The WebView only exists while a PDF is being imported.
   *
   * Mounting it at startup would cost a WebView process and 1.4 MB of pdf.js parsing on
   * every single launch, for a feature most reading sessions never touch. It is torn down
   * again as soon as the loader is destroyed.
   */
  const [mounted, setMounted] = useState(false);

  const nextId = useRef(1);
  const pending = useRef(new Map<number, Pending>());
  const readyWaiters = useRef<(() => void)[]>([]);
  /** Reassembly buffers, keyed by the frame group the page stamped on them. */
  const frames = useRef(new Map<number, string[]>());

  useEffect(
    () => () => {
      for (const entry of pending.current.values()) {
        clearTimeout(entry.timer);
        entry.reject(new PdfBridgeError('PDF bridge unmounted'));
      }
      pending.current.clear();
    },
    [],
  );

  /** Resolve the bundled page to a URI and mount the WebView. */
  const mount = useCallback(async () => {
    if (!source) {
      // In a release build the HTML lives inside the app package; `downloadAsync` copies
      // it into the cache directory and hands back a file:// URI the WebView can open.
      const asset = Asset.fromModule(require('../../assets/pdfjs/pdf-bridge.html') as number);
      await asset.downloadAsync();
      setSource(asset.localUri ?? asset.uri);
    }
    setMounted(true);
  }, [source]);

  const unmount = useCallback(() => {
    setMounted(false);
    setReady(false);
    frames.current.clear();
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    let frame: { g: number; p: number; n: number; d: string };
    try {
      frame = JSON.parse(event.nativeEvent.data) as typeof frame;
    } catch {
      return;
    }

    let buffer = frames.current.get(frame.g);
    if (!buffer) {
      buffer = new Array<string>(frame.n).fill('');
      frames.current.set(frame.g, buffer);
    }
    buffer[frame.p] = frame.d;
    if (buffer.filter((part) => part.length > 0).length < frame.n) return;
    frames.current.delete(frame.g);

    const json = buffer.join('');

    let reply: Reply;
    try {
      reply = JSON.parse(json) as Reply;
    } catch {
      return;
    }

    if (reply.ready) {
      setReady(true);
      for (const waiter of readyWaiters.current) waiter();
      readyWaiters.current = [];
      return;
    }

    const entry = pending.current.get(reply.id);
    if (!entry) return;
    pending.current.delete(reply.id);
    clearTimeout(entry.timer);
    entry.resolve(reply);
  }, []);

  /** Mount the WebView if needed and wait for the page's handshake. */
  const awaitReady = useCallback(async () => {
    if (ready) return;
    const waited = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new PdfBridgeError('PDF engine did not start within 20 s')),
        20_000,
      );
      readyWaiters.current.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
    await mount();
    await waited;
  }, [mount, ready]);

  /**
   * Control messages only. Their payloads are built here and contain nothing but ASCII
   * identifiers and numbers, so a JSON string literal is safe — the file itself travels
   * through `sendChunk` instead, precisely so that no user data ever reaches this path.
   */
  const send = useCallback((message: Record<string, unknown>) => {
    const payload = JSON.stringify(JSON.stringify(message));
    webRef.current?.injectJavaScript(`window.__lexiPdf(${payload});true;`);
  }, []);

  /** Base64 needs no escaping at all, which is why the upload has its own entry point. */
  const sendChunk = useCallback((base64: string) => {
    webRef.current?.injectJavaScript(`window.__lexiPdfChunk("${base64}");true;`);
  }, []);

  const request = useCallback(
    (message: Record<string, unknown>, timeoutMs = 120_000): Promise<Reply> => {
      const id = nextId.current;
      nextId.current += 1;
      return new Promise<Reply>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current.delete(id);
          reject(new PdfBridgeError(`PDF engine timed out after ${Math.round(timeoutMs / 1000)} s`));
        }, timeoutMs);
        pending.current.set(id, { resolve, reject, timer });
        send({ ...message, id });
      });
    },
    [send],
  );

  const createLoader = useCallback((): PdfLoader => {
    return async (data: Uint8Array): Promise<PdfDocumentProxy> => {
      await awaitReady();

      const base64 = bytesToBase64(data);
      for (let offset = 0; offset < base64.length; offset += UPLOAD_CHUNK) {
        sendChunk(base64.slice(offset, offset + UPLOAD_CHUNK));
      }

      const opened = await request({ type: 'open' });
      if (!opened.ok) throw new PdfBridgeError(opened.error ?? 'could not open the PDF');

      return {
        numPages: opened.numPages ?? 0,
        async getPage(pageNumber: number) {
          const reply = await request({ type: 'page', page: pageNumber });
          if (!reply.ok) throw new PdfBridgeError(reply.error ?? `page ${pageNumber} failed`);
          const items: PdfTextItem[] = (reply.items ?? []).map(([str, x, y, width]) => ({
            str,
            // `itemsToLines` reads transform[4] (x) and transform[5] (y) only, but the
            // field is typed as the full pdf.js matrix, so it is rebuilt in full.
            transform: [1, 0, 0, 1, x, y],
            width,
          }));
          return { getTextContent: () => Promise.resolve({ items }) };
        },
        getMetadata: () => Promise.resolve({ info: opened.info ?? {} }),
        destroy: async () => {
          await request({ type: 'close' }, 15_000).catch(() => undefined);
          // `parsePdf` calls this in a `finally`, so the WebView goes away whether the
          // import succeeded or threw.
          unmount();
        },
      };
    };
  }, [awaitReady, request, sendChunk, unmount]);

  const value = useMemo<BridgeApi>(() => ({ createLoader, ready }), [createLoader, ready]);

  return (
    <BridgeContext.Provider value={value}>
      {children}
      {mounted && source ? (
        <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden>
          <WebView
            ref={webRef}
            source={{ uri: source }}
            onMessage={handleMessage}
            originWhitelist={['*']}
            // The page is a local asset with no navigation and no remote origin; these
            // only widen access to the app's own bundled file.
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            javaScriptEnabled
            domStorageEnabled={false}
            cacheEnabled={false}
            incognito
            androidLayerType="software"
            // pdf.js keeps the page structure in memory; a large book would otherwise be
            // reloaded from scratch when Android reclaims the WebView.
            setSupportMultipleWindows={false}
          />
        </View>
      ) : null}
    </BridgeContext.Provider>
  );
}

export function usePdfBridge(): BridgeApi {
  const value = useContext(BridgeContext);
  if (!value) throw new Error('usePdfBridge must be used inside <PdfBridgeProvider>');
  return value;
}

const styles = StyleSheet.create({
  // 1x1 and effectively invisible, but still inside the window: Android pauses timers in
  // a WebView whose window visibility drops, and moving it fully off-screen risks exactly
  // that. It never paints anything anyway — the page has an empty body.
  hidden: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 1,
    height: 1,
    opacity: 0.01,
    zIndex: -1,
  },
});
