import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { PdfFieldValue, PdfMark } from '@lexipulse/core';

import { files, store } from '../lib/store';
import type { Theme } from '../theme';
import {
  base64ToBytes,
  BlobInbox,
  bytesToBase64,
  scriptLiteral,
  WIRE_CHUNK,
  type WireCall,
  type WireMessage,
} from './wire';

/**
 * The app side of the original surface.
 *
 * The surface itself is the same code the website runs; it lives in a WebView because
 * pdf.js needs a DOM, a canvas and a real `Worker`, none of which the React Native JS
 * thread has. This module is the host it talks to: SQLite for marks and form answers,
 * files for the originals, the share sheet for a finished document.
 *
 * The page is bundled into the app (`assets/pdfjs/pdf-surface.html`) and never fetched.
 * Working without a network is the point of the product, not a nice-to-have.
 */

export interface SurfaceDocument {
  documentId: string;
  title: string;
  wordCount: number;
  fileName: string | null;
}

export interface PdfSurfaceViewProps {
  document: SurfaceDocument;
  initialPage: number;
  theme: Theme;
  /** Called when the reader asks for the word stream at a page. */
  onStream?: (page: number) => void;
  onClose: () => void;
}

/** The reader's chosen theme, as the CSS variables the surface is written against. */
function themeCss(theme: Theme): string {
  const { colors, accent } = theme;
  return `:root{
    --lx-bg:${colors.bg};
    --lx-surface:${colors.surface};
    --lx-surface-hover:${colors.surfaceHover};
    --lx-border:${colors.border};
    --lx-border-strong:${colors.borderStrong};
    --lx-text:${colors.text};
    --lx-text-muted:${colors.textMuted};
    --lx-text-faint:${colors.textFaint};
    --lx-accent:${accent.base};
    --lx-accent-strong:${accent.strong};
    --lx-accent-on:${accent.on};
    --lx-accent-text:${accent.base};
    --lx-bg-deep:${colors.stage};
    color-scheme:${theme.dark ? 'dark' : 'light'};
  }`;
}

export function PdfSurfaceView({
  document,
  initialPage,
  theme,
  onStream,
  onClose,
}: PdfSurfaceViewProps) {
  const webRef = useRef<WebView | null>(null);
  const [source, setSource] = useState<string | null>(null);
  /** Reassembly buffers for binary arguments, keyed by the call they belong to. */
  const inbox = useRef(new BlobInbox());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const asset = Asset.fromModule(
        require('../../assets/pdfjs/pdf-surface.html') as number,
      );
      await asset.downloadAsync();
      if (!cancelled) setSource(asset.localUri ?? asset.uri);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inject = useCallback((script: string) => {
    webRef.current?.injectJavaScript(`${script};true;`);
  }, []);

  /** Answer a call. Binary results go out in slices before the resolution itself. */
  const reply = useCallback(
    (id: number, ok: boolean, value: unknown, binary?: Uint8Array) => {
      if (binary) {
        const base64 = bytesToBase64(binary);
        // Base64 needs no escaping at all, which is why it has its own entry point: a
        // slice can go into the script as a bare string literal.
        for (let i = 0; i < base64.length; i += WIRE_CHUNK) {
          inject(`window.__lx.chunk(${id},"${base64.slice(i, i + WIRE_CHUNK)}")`);
        }
        inject(`window.__lx.resolve(${id},true,null,true)`);
        return;
      }
      inject(`window.__lx.resolve(${id},${ok},JSON.parse(${scriptLiteral(value)}),false)`);
    },
    [inject],
  );

  const handle = useCallback(
    async (call: WireCall, binary: Uint8Array | null): Promise<void> => {
      const id = document.documentId;
      switch (call.method) {
        case 'loadOriginal': {
          const bytes = await store.getOriginal(id);
          reply(call.id, true, null, bytes ?? new Uint8Array(0));
          return;
        }
        case 'replaceOriginal': {
          if (binary) await store.replaceOriginal(id, binary);
          reply(call.id, true, null);
          return;
        }
        case 'listMarks': {
          reply(call.id, true, await store.listMarks(id));
          return;
        }
        case 'saveMark': {
          await store.saveMark(call.args[0] as PdfMark);
          reply(call.id, true, null);
          return;
        }
        case 'deleteMark': {
          await store.deleteMark(id, call.args[0] as string);
          reply(call.id, true, null);
          return;
        }
        case 'getFormValues': {
          reply(call.id, true, await store.getFormValues(id));
          return;
        }
        case 'setFormValues': {
          await store.setFormValues(id, call.args[0] as Record<string, PdfFieldValue>);
          reply(call.id, true, null);
          return;
        }
        case 'putStamp': {
          const stampId = `stamp:${id}:${Date.now().toString(36)}`;
          if (binary) await files.put(stampId, binary, (call.args[0] as string) ?? 'image/png');
          reply(call.id, true, stampId);
          return;
        }
        case 'getStamp': {
          const bytes = await files.get(call.args[0] as string);
          reply(call.id, true, null, bytes ?? new Uint8Array(0));
          return;
        }
        case 'deliver': {
          if (binary) await share(binary, (call.args[0] as string) ?? 'dokument.pdf');
          reply(call.id, true, null);
          return;
        }
        case 'pickImage': {
          reply(call.id, true, await pickImage());
          return;
        }
        case 'toStream': {
          onStream?.(Number(call.args[0]) || 1);
          reply(call.id, true, null);
          return;
        }
        case 'close': {
          onClose();
          reply(call.id, true, null);
          return;
        }
        default:
          reply(call.id, false, `Unbekannter Aufruf: ${call.method}`);
      }
    },
    [document.documentId, onClose, onStream, reply],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: WireMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as WireMessage;
      } catch {
        return;
      }

      if (message.t === 'ready') {
        inject(`window.__lx.theme(${JSON.stringify(themeCss(theme))})`);
        inject(
          `window.__lx.start(${JSON.stringify(
            JSON.stringify({
              documentId: document.documentId,
              title: document.title,
              wordCount: document.wordCount,
              fileName: document.fileName,
              initialPage,
              canStream: document.wordCount > 0 && onStream !== undefined,
            }),
          )})`,
        );
        return;
      }

      if (message.t === 'blob') {
        inbox.current.accept(message);
        return;
      }

      if (message.t !== 'call') return;

      const parts = inbox.current.take(message.id);
      const binary = message.blob && parts !== null ? base64ToBytes(parts) : null;

      void handle(message, binary).catch((error: unknown) => {
        reply(message.id, false, error instanceof Error ? error.message : 'Fehler');
      });
    },
    [document, handle, initialPage, inject, onStream, reply, theme],
  );

  const backgroundColor = useMemo(() => theme.colors.bg, [theme]);

  if (!source) {
    return (
      <View style={[styles.loading, { backgroundColor }]}>
        <ActivityIndicator color={theme.accent.base} />
      </View>
    );
  }

  return (
    <WebView
      ref={webRef}
      source={{ uri: source }}
      onMessage={onMessage}
      originWhitelist={['*']}
      style={{ backgroundColor }}
      // The page is a local asset with no navigation and no remote origin; these only
      // widen access to the app's own bundled file.
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      javaScriptEnabled
      domStorageEnabled={false}
      cacheEnabled={false}
      incognito
      // Hardware layers make canvas scrolling smooth; the import bridge draws nothing and
      // uses software for stability, which is the opposite trade-off.
      androidLayerType="hardware"
      setSupportMultipleWindows={false}
      // Nothing in this page navigates. Anything that tries is a document trying to open
      // a link, and it has no business replacing the surface.
      onShouldStartLoadWithRequest={(request) => request.url === source}
    />
  );
}

/** Write the file where the system can share it, then open the share sheet. */
async function share(bytes: Uint8Array, fileName: string): Promise<void> {
  const safe = fileName.replace(/[^\p{L}\p{N}._ -]/gu, '_') || 'dokument.pdf';
  const file = new FileSystem.File(FileSystem.Paths.cache, safe);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: safe,
    });
  }
}

/** A picture the reader chooses, measured so the surface can place it undistorted. */
async function pickImage(): Promise<{ base64: string; mime: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/png', 'image/jpeg', 'image/webp'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  const bytes = new Uint8Array(await new FileSystem.File(asset.uri).arrayBuffer());
  // The shape is measured on the other side, where there is an image decoder. Guessing it
  // here would place every photograph at the wrong aspect until the reader fixed it.
  return { base64: bytesToBase64(bytes), mime: asset.mimeType ?? 'image/jpeg' };
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
