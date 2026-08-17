'use client';

import {
  defaultStyleFor,
  type LexiDocument,
  type PdfFieldValue,
  type PdfMark,
  type PdfMarkKind,
} from '@lexipulse/core';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { buildPdf, remapPage, type PageOp } from '@/lib/pdf-export';
import { getFileStore, getStore } from '@/lib/store';
import { FormPanel } from './form-panel';
import { MarkLayer, type Tool, type ToolStyle } from './mark-layer';
import { usePdfOriginal } from './pdf-doc';
import { PageOrganiser } from './page-organiser';
import { PdfViewer, ToolButton, type PdfViewerHandle } from './pdf-viewer';
import { StyleBar, ToolPalette } from './pdf-tools';
import { SaveDialog, type SaveChoice } from './save-dialog';
import { SignatureDialog, type SignatureResult } from './signature-dialog';
import { TextDialog } from './text-dialog';

/**
 * The original surface, as its own screen.
 *
 * Not a panel inside the player: a page needs the whole viewport, a sidebar and a toolbar
 * of its own, and squeezing that into the card that holds the word stream would make both
 * worse. What the two share is the position — the player hands over a page number and
 * gets one back.
 *
 * This component owns everything the reader adds. The viewer below it knows about pages
 * and zoom and nothing else, which is what keeps the editing out of the scroll path.
 */

const DEFAULT_STYLE: ToolStyle = defaultStyleFor('highlight');

/** Stamps are files too, and they are deleted with the document like the original is. */
function stampId(documentId: string): string {
  return `stamp:${documentId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function OriginalApp() {
  const router = useRouter();
  const params = useSearchParams();
  const documentId = params.get('doc');
  const initialPage = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const [record, setRecord] = React.useState<LexiDocument | null>(null);
  const { state, submitPassword, reload } = usePdfOriginal(documentId);
  const viewer = React.useRef<PdfViewerHandle | null>(null);
  const page = React.useRef(initialPage);

  const [editing, setEditing] = React.useState(false);
  const [tool, setTool] = React.useState<Tool>('select');
  /*
   * One appearance per tool, kept apart.
   *
   * A single shared style means picking red for an arrow leaves the highlighter red, and
   * the next highlight is unreadable. Each tool starts at its own sensible default and
   * remembers whatever the reader changed it to.
   */
  const [styles, setStyles] = React.useState<Partial<Record<Tool, ToolStyle>>>({});
  const style: ToolStyle =
    styles[tool] ?? (tool === 'select' ? DEFAULT_STYLE : defaultStyleFor(tool as PdfMarkKind));
  const [marks, setMarks] = React.useState<PdfMark[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState<Record<string, PdfFieldValue>>({});
  const [panel, setPanel] = React.useState<'none' | 'form' | 'pages'>('none');

  const [signing, setSigning] = React.useState(false);
  const [textPrompt, setTextPrompt] = React.useState<{ title: string; initial: string } | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  /*
   * Dialogs are asked a question and answer it, so the code that needs a signature reads
   * as one line instead of as a state machine spread over four handlers.
   */
  const answerStamp = React.useRef<((value: SignatureResult | null) => void) | null>(null);
  const answerText = React.useRef<((value: string | null) => void) | null>(null);

  React.useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    void (async () => {
      const store = await getStore();
      const [document, stored, values] = await Promise.all([
        store.getDocument(documentId),
        store.listMarks(documentId),
        store.getFormValues(documentId),
      ]);
      if (cancelled) return;
      setRecord(document);
      setMarks(stored);
      setFormValues(values);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  React.useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ------------------------------------------------------------------ marks */

  const addMark = React.useCallback(async (mark: PdfMark) => {
    setMarks((current) => [...current, mark]);
    setSelectedId(mark.id);
    const store = await getStore();
    await store.saveMark(mark);
  }, []);

  const updateMark = React.useCallback(async (mark: PdfMark) => {
    setMarks((current) => current.map((entry) => (entry.id === mark.id ? mark : entry)));
    const store = await getStore();
    await store.saveMark(mark);
  }, []);

  const removeSelected = React.useCallback(async () => {
    if (!selectedId || !documentId) return;
    setMarks((current) => current.filter((entry) => entry.id !== selectedId));
    setSelectedId(null);
    const store = await getStore();
    await store.deleteMark(documentId, selectedId);
  }, [selectedId, documentId]);

  React.useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedId) {
          event.preventDefault();
          void removeSelected();
        }
      } else if (event.key === 'Escape') {
        setTool('select');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing, selectedId, removeSelected]);

  /* ---------------------------------------------------------------- dialogs */

  const requestStamp = React.useCallback(async () => {
    if (!documentId) return null;

    const picture = await new Promise<SignatureResult | null>((resolve) => {
      answerStamp.current = resolve;
      if (tool === 'signature') setSigning(true);
      else pickImage(resolve);
    });
    answerStamp.current = null;
    if (!picture) return null;

    const files = await getFileStore();
    const id = stampId(documentId);
    await files.put(id, picture.bytes, picture.mime);
    return { imageId: id, ratio: picture.ratio };
  }, [documentId, tool]);

  const requestText = React.useCallback(async (initial: string) => {
    const answer = await new Promise<string | null>((resolve) => {
      answerText.current = resolve;
      setTextPrompt({ title: initial.length > 0 ? 'Text ändern' : 'Text', initial });
    });
    answerText.current = null;
    setTextPrompt(null);
    return answer;
  }, []);

  /* ------------------------------------------------------------------ saving */

  const loadOriginalBytes = React.useCallback(async (): Promise<Uint8Array | null> => {
    if (!documentId) return null;
    const store = await getStore();
    return store.getOriginal(documentId);
  }, [documentId]);

  /** Renders one page to a PNG, for the redaction that really removes text. */
  const renderPageToPng = React.useCallback(
    async (pageNumber: number, scale: number): Promise<Uint8Array> => {
      if (state.status !== 'ready') throw new Error('Das Dokument ist nicht geöffnet.');
      const pdfPage = await state.doc.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Die Seite konnte nicht gezeichnet werden.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Die Seite konnte nicht gezeichnet werden.');
      return new Uint8Array(await blob.arrayBuffer());
    },
    [state],
  );

  const performSave = React.useCallback(
    async (choice: SaveChoice) => {
      if (!documentId) return;
      setSaving(false);
      setBusy('Die Datei wird geschrieben…');
      try {
        const original = await loadOriginalBytes();
        if (!original) throw new Error('Die Originaldatei fehlt.');

        const files = await getFileStore();
        const output = await buildPdf(original, {
          marks,
          formValues,
          flattenForm: choice.flattenForm,
          hardRedaction: choice.hardRedaction,
          renderPage: renderPageToPng,
          loadImage: async (id) => {
            const bytes = await files.get(id);
            const meta = await files.stat(id);
            return bytes ? { bytes, mime: meta?.mime ?? 'image/png' } : null;
          },
        });

        if (choice.target === 'download') {
          downloadBytes(
            output,
            suggestFileName(record?.original?.fileName ?? record?.title ?? 'dokument'),
          );
          setToast('Die bearbeitete Datei wurde heruntergeladen.');
        } else {
          const store = await getStore();
          await store.replaceOriginal(documentId, output);
          setToast('Das Original wurde ersetzt. Die Seite wird neu geladen.');
          // The open pdf.js document still holds the old bytes; reloading is the honest
          // way to show what is now on disk rather than what was.
          window.setTimeout(() => window.location.reload(), 900);
        }
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Die Datei konnte nicht geschrieben werden.');
      } finally {
        setBusy(null);
      }
    },
    [documentId, marks, formValues, loadOriginalBytes, renderPageToPng, record],
  );

  /**
   * One structural change, written straight into the file, with the marks carried along.
   *
   * The marks move first in memory and then in storage, and the document is re-opened
   * afterwards, so what the thumbnails show is what the file now contains rather than
   * what it contained a moment ago.
   */
  const applyPageOp = React.useCallback(
    async (op: PageOp) => {
      if (!documentId) return;
      setBusy('Die Seiten werden neu geschrieben…');
      try {
        const store = await getStore();
        const original = await store.getOriginal(documentId);
        if (!original) throw new Error('Die Originaldatei fehlt.');

        const output = await buildPdf(original, { marks: [], ops: [op] });
        await store.replaceOriginal(documentId, output);

        const moved: PdfMark[] = [];
        for (const mark of marks) {
          const page = remapPage(op, mark.page);
          if (page === null) {
            await store.deleteMark(documentId, mark.id);
            continue;
          }
          const next = page === mark.page ? mark : { ...mark, page, updatedAt: Date.now() };
          if (next !== mark) await store.saveMark(next);
          moved.push(next);
        }
        setMarks(moved);
        setSelectedId(null);
        reload();
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Die Seiten konnten nicht geändert werden.');
      } finally {
        setBusy(null);
      }
    },
    [documentId, marks, reload],
  );

  const download = React.useCallback(async () => {
    const bytes = await loadOriginalBytes();
    if (!bytes) return;
    downloadBytes(bytes, record?.original?.fileName ?? `${record?.title ?? 'dokument'}.pdf`);
  }, [loadOriginalBytes, record]);

  const toStream = React.useCallback(() => {
    if (!documentId) return;
    router.push(`/reader?doc=${encodeURIComponent(documentId)}&page=${page.current}`);
  }, [documentId, router]);

  /* ------------------------------------------------------------------ render */

  const marksByPage = React.useMemo(() => {
    const map = new Map<number, PdfMark[]>();
    for (const mark of marks) {
      const list = map.get(mark.page);
      if (list) list.push(mark);
      else map.set(mark.page, [mark]);
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt);
    return map;
  }, [marks]);

  const noMarks: PdfMark[] = React.useMemo(() => [], []);

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--lx-border)] bg-[var(--lx-bg)] px-3">
        <Link
          href={documentId ? `/reader?doc=${encodeURIComponent(documentId)}` : '/reader'}
          className="inline-flex h-8 items-center rounded-[6px] px-2 text-[14px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:bg-[var(--lx-surface-hover)] hover:text-[var(--lx-text)]"
        >
          ‹ Zurück
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--lx-text)]">
          {record?.title ?? 'Original'}
        </h1>
        {marks.length > 0 && (
          <span className="font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]">
            {marks.length} Markierung{marks.length === 1 ? '' : 'en'}
          </span>
        )}
      </header>

      <main id="inhalt" className="flex min-h-0 flex-1 flex-col">
        {state.status === 'loading' && (
          <p className="py-24 text-center text-[15px] text-[var(--lx-text-muted)]">
            Original wird geöffnet…
          </p>
        )}

        {state.status === 'password' && (
          <PasswordPrompt wrong={state.wrong} onSubmit={submitPassword} />
        )}

        {state.status === 'error' && (
          <div className="mx-auto max-w-[46ch] px-5 py-24 text-center">
            <p className="text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
              {state.message}
            </p>
            <Link
              href="/reader"
              className="mt-6 inline-flex h-10 items-center rounded-[8px] border border-[var(--lx-border)] px-4 text-[14px] text-[var(--lx-text)] transition-colors duration-140 hover:bg-[var(--lx-surface-hover)]"
            >
              Zum Reader
            </Link>
          </div>
        )}

        {state.status === 'ready' && (
          <PdfViewer
            ref={viewer}
            doc={state.doc}
            sizes={state.sizes}
            onPageSize={() => undefined}
            initialPage={initialPage}
            onPageChange={(value) => {
              page.current = value;
            }}
            banner={
              editing ? (
                <div className="flex flex-col gap-2 border-b border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 py-2">
                  <ToolPalette tool={tool} onTool={setTool} />
                  <StyleBar
                    tool={tool}
                    style={style}
                    onChange={(next) =>
                      setStyles((current) => ({ ...current, [tool]: { ...style, ...next } }))
                    }
                    onDelete={() => void removeSelected()}
                    canDelete={selectedId !== null}
                  />
                </div>
              ) : null
            }
            toolbarExtra={
              <>
                <ToolButton
                  label={editing ? 'Bearbeiten beenden' : 'Bearbeiten'}
                  pressed={editing}
                  onClick={() => {
                    setEditing((open) => !open);
                    setTool('select');
                    setSelectedId(null);
                  }}
                >
                  ✎
                </ToolButton>
                <ToolButton
                  label="Seiten ordnen"
                  pressed={panel === 'pages'}
                  onClick={() => setPanel((current) => (current === 'pages' ? 'none' : 'pages'))}
                >
                  ⧉
                </ToolButton>
                <ToolButton
                  label="Formular ausfüllen"
                  pressed={panel === 'form'}
                  onClick={() => setPanel((current) => (current === 'form' ? 'none' : 'form'))}
                >
                  ▤
                </ToolButton>
                <ToolButton label="Original herunterladen" onClick={() => void download()}>
                  ⭳
                </ToolButton>
                <ToolButton label="Bearbeitete Datei speichern" onClick={() => setSaving(true)}>
                  ⤓
                </ToolButton>
                <button
                  type="button"
                  onClick={toStream}
                  className="inline-flex h-8 items-center rounded-[6px] bg-[var(--lx-accent)] px-3 text-[13px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
                >
                  Ab hier im Wortstrom
                </button>
              </>
            }
            pageOverlay={(pageNumber, geometry) => {
              const pageMarks = marksByPage.get(pageNumber) ?? noMarks;
              if (!editing && pageMarks.length === 0) return null;
              return (
                <MarkLayer
                  pageNumber={pageNumber}
                  size={geometry.size}
                  scale={geometry.scale}
                  rotation={geometry.rotation}
                  marks={pageMarks}
                  tool={editing ? tool : 'select'}
                  style={style}
                  documentId={documentId ?? ''}
                  selectedId={editing ? selectedId : null}
                  onSelect={setSelectedId}
                  onCreate={(mark) => void addMark(mark)}
                  onUpdate={(mark) => void updateMark(mark)}
                  requestStamp={requestStamp}
                  requestText={requestText}
                />
              );
            }}
          />
        )}
      </main>

      {panel === 'pages' && state.status === 'ready' && (
        <PageOrganiser
          doc={state.doc}
          sizes={state.sizes}
          busy={busy !== null}
          onApply={applyPageOp}
          onClose={() => setPanel('none')}
          onGoToPage={(value) => viewer.current?.goToPage(value)}
        />
      )}

      {panel === 'form' && documentId && (
        <FormPanel
          documentId={documentId}
          values={formValues}
          onChange={async (next) => {
            setFormValues(next);
            const store = await getStore();
            await store.setFormValues(documentId, next);
          }}
          onClose={() => setPanel('none')}
          loadOriginal={loadOriginalBytes}
        />
      )}

      {signing && (
        <SignatureDialog
          onDone={(result) => {
            setSigning(false);
            answerStamp.current?.(result);
          }}
          onCancel={() => {
            setSigning(false);
            answerStamp.current?.(null);
          }}
        />
      )}

      {textPrompt && (
        <TextDialog
          title={textPrompt.title}
          initial={textPrompt.initial}
          onDone={(text) => answerText.current?.(text)}
          onCancel={() => answerText.current?.(null)}
        />
      )}

      {saving && (
        <SaveDialog
          hasRedaction={marks.some((mark) => mark.kind === 'redact')}
          hasForm={Object.keys(formValues).length > 0}
          onDone={(choice) => void performSave(choice)}
          onCancel={() => setSaving(false)}
        />
      )}

      {busy && (
        <div
          role="status"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-[15px] text-white"
        >
          {busy}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[10px] border border-[var(--lx-border-strong)] bg-[var(--lx-surface)] px-4 py-2 text-[14px] text-[var(--lx-text)] shadow-[0_4px_16px_rgba(0,0,0,0.28)]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

/** A file input that exists only for the length of one question. */
function pickImage(resolve: (value: SignatureResult | null) => void): void {
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
    resolve({ bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, ratio });
  };
  // A cancelled picker fires nothing at all in most browsers, so the promise would hang;
  // `cancel` is the event that says the reader closed it.
  input.oncancel = () => resolve(null);
  input.click();
}

function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Revoked on a later tick: released synchronously the download never starts in Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** `Vertrag.pdf` → `Vertrag-bearbeitet.pdf`, so the original is never silently overwritten. */
export function suggestFileName(name: string): string {
  const base = name.replace(/\.pdf$/i, '').slice(0, 120) || 'dokument';
  return `${base}-bearbeitet.pdf`;
}

function PasswordPrompt({
  wrong,
  onSubmit,
}: {
  wrong: boolean;
  onSubmit: (password: string) => void;
}) {
  const [value, setValue] = React.useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value.length > 0) onSubmit(value);
      }}
      className="mx-auto w-full max-w-[36ch] px-5 py-24"
    >
      <h2 className="text-[16px] font-semibold">Diese Datei ist geschützt</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--lx-text-muted)]">
        {wrong
          ? 'Das Kennwort stimmt nicht. Versuchen Sie es noch einmal.'
          : 'Geben Sie das Kennwort ein, um die Seiten zu sehen. Es wird nirgends gespeichert und nirgends gesendet.'}
      </p>
      <label htmlFor="lx-pdf-password" className="sr-only">
        Kennwort
      </label>
      <input
        id="lx-pdf-password"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-5 h-10 w-full rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 text-[14px] text-[var(--lx-text)]"
      />
      <button
        type="submit"
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[8px] bg-[var(--lx-accent)] text-[14px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
      >
        Öffnen
      </button>
    </form>
  );
}
