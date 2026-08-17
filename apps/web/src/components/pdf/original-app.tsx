'use client';

import type { LexiDocument, PdfFieldValue, PdfMark } from '@lexipulse/core';
import { configurePdfjs, PdfSurface, type PdfHost } from '@lexipulse/pdf';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { getPdfjs } from '@/lib/pdf-loader';
import { getFileStore, getStore } from '@/lib/store';

/**
 * The web host for the original surface.
 *
 * The surface itself lives in `@lexipulse/pdf` and is the same code the mobile app runs
 * inside a WebView. What differs is everything around it, and all of it is here: the
 * document comes out of IndexedDB, a finished file becomes a download, and a picture is
 * chosen with a file input.
 */

/** pdf.js as the web app loads it: a real ES module from our own origin. */
configurePdfjs(getPdfjs);

const CMAP_URL = '/pdfjs/cmaps/';
const STANDARD_FONTS_URL = '/pdfjs/standard_fonts/';

/** Stamps are files too, and they are swept with the document like the original is. */
function stampId(documentId: string): string {
  return `stamp:${documentId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function OriginalApp() {
  const router = useRouter();
  const params = useSearchParams();
  const documentId = params.get('doc');
  const initialPage = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  /*
   * The record is stored with the id it belongs to, and "still loading" is derived rather
   * than assigned. A separate flag set from the effect would render one frame in which
   * the previous document's title sits above the new document's pages.
   */
  const [lookup, setLookup] = React.useState<{ id: string; document: LexiDocument | null } | null>(
    null,
  );
  const record = lookup?.id === documentId ? lookup.document : undefined;
  const missing = documentId === null || record === null;

  React.useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    void (async () => {
      const store = await getStore();
      const document = await store.getDocument(documentId);
      if (!cancelled) setLookup({ id: documentId, document });
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const host: PdfHost | null = React.useMemo(() => {
    if (!documentId || !record) return null;
    return {
      documentId,
      title: record.title,
      wordCount: record.wordCount,
      fileName: record.original?.fileName ?? null,

      async loadOriginal() {
        return (await getStore()).getOriginal(documentId);
      },
      async replaceOriginal(bytes) {
        await (await getStore()).replaceOriginal(documentId, bytes);
      },

      async listMarks() {
        return (await getStore()).listMarks(documentId);
      },
      async saveMark(mark: PdfMark) {
        await (await getStore()).saveMark(mark);
      },
      async deleteMark(id: string) {
        await (await getStore()).deleteMark(documentId, id);
      },

      async getFormValues() {
        return (await getStore()).getFormValues(documentId);
      },
      async setFormValues(values: Record<string, PdfFieldValue>) {
        await (await getStore()).setFormValues(documentId, values);
      },

      async putStamp(bytes, mime) {
        const files = await getFileStore();
        const id = stampId(documentId);
        await files.put(id, bytes, mime);
        return id;
      },
      async getStamp(id) {
        const files = await getFileStore();
        const bytes = await files.get(id);
        const meta = await files.stat(id);
        return bytes ? { bytes, mime: meta?.mime ?? 'image/png' } : null;
      },

      async deliver(bytes, fileName, mime) {
        const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        // Revoked on a later tick: released synchronously the download never starts in
        // Safari.
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      },

      pickImage() {
        return new Promise((resolve) => {
          const input = window.document.createElement('input');
          input.type = 'file';
          input.accept = 'image/png,image/jpeg,image/webp';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const bitmap = await createImageBitmap(file);
            const ratio = bitmap.height / bitmap.width;
            bitmap.close();
            resolve({
              bytes: new Uint8Array(await file.arrayBuffer()),
              mime: file.type,
              ratio,
            });
          };
          // A cancelled picker fires nothing at all in most browsers, so the promise
          // would hang; `cancel` is the event that says the reader closed it.
          input.oncancel = () => resolve(null);
          input.click();
        });
      },

      toStream: (page: number) => {
        router.push(`/reader?doc=${encodeURIComponent(documentId)}&page=${page}`);
      },
    };
  }, [documentId, record, router]);

  if (missing) {
    return (
      <div className="mx-auto max-w-[46ch] px-5 py-24 text-center">
        <p className="text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
          Dieses Dokument liegt nicht mehr in Ihrer Bibliothek.
        </p>
        <Link
          href="/reader"
          className="mt-6 inline-flex h-10 items-center rounded-[8px] border border-[var(--lx-border)] px-4 text-[14px] text-[var(--lx-text)] transition-colors duration-140 hover:bg-[var(--lx-surface-hover)]"
        >
          Zum Reader
        </Link>
      </div>
    );
  }

  if (!host) {
    return (
      <p className="py-24 text-center text-[15px] text-[var(--lx-text-muted)]">Wird geladen…</p>
    );
  }

  return (
    <PdfSurface
      host={host}
      initialPage={initialPage}
      onBack={() => router.push(`/reader?doc=${encodeURIComponent(host.documentId)}`)}
      cMapUrl={CMAP_URL}
      standardFontDataUrl={STANDARD_FONTS_URL}
    />
  );
}
