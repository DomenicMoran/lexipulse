import {
  defaultStyleFor,
  type PdfFieldValue,
  type PdfMark,
  type PdfMarkKind,
} from '@lexipulse/core';
import * as React from 'react';
import { usePdfOriginal } from './document.js';
import { buildPdf, extractPages, remapPage, type PageOp } from './export.js';
import { FormPanel } from './form-panel.js';
import type { PdfHost } from './host.js';
import { MarkLayer, type Tool, type ToolStyle } from './mark-layer.js';
import { PageOrganiser } from './page-organiser.js';
import { SaveDialog, type SaveChoice } from './save-dialog.js';
import { SignatureDialog, type SignatureResult } from './signature-dialog.js';
import { TextDialog } from './text-dialog.js';
import { StyleBar, ToolPalette } from './tools.js';
import { PdfViewer, ToolButton, type PdfViewerHandle } from './viewer.js';

/**
 * The original surface: the page as it was laid out, and everything you can do to it.
 *
 * Knows nothing about where the document came from or where a finished file goes — that
 * is the `PdfHost`. The web app fills it with IndexedDB and a download; the mobile app
 * fills it with SQLite and the share sheet, from inside a WebView. One implementation,
 * two hosts, and no chance of the two drifting apart.
 */

const DEFAULT_STYLE: ToolStyle = defaultStyleFor('highlight');

export interface PdfSurfaceProps {
  host: PdfHost;
  /** 1-based page to open on. */
  initialPage?: number;
  /** Where the back control goes. Omitted when the host has nowhere to go back to. */
  onBack?: () => void;
  /** Character maps and standard fonts, when the host serves them. */
  cMapUrl?: string;
  standardFontDataUrl?: string;
}

export function PdfSurface({
  host,
  initialPage = 1,
  onBack,
  cMapUrl,
  standardFontDataUrl,
}: PdfSurfaceProps) {
  const options = React.useMemo(
    () => ({ cMapUrl, standardFontDataUrl }),
    [cMapUrl, standardFontDataUrl],
  );
  const { state, submitPassword, reload } = usePdfOriginal(host, options);
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

  /*
   * The host object is rebuilt on every render of whatever mounts this. Holding it in a
   * ref keeps every callback below stable — otherwise each of them changes identity on
   * every render and the memoised page list re-renders the whole document on every
   * keystroke.
   */
  const hostRef = React.useRef(host);
  // Written from an effect, never during render: React may discard a render, and the ref
  // would then keep a value from a pass that never reached the screen. Declared before
  // every other effect so the ones below already see the current host.
  React.useEffect(() => {
    hostRef.current = host;
  }, [host]);

  const documentId = host.documentId;
  const formLoaded = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    formLoaded.current = false;
    void (async () => {
      const [stored, values] = await Promise.all([
        hostRef.current.listMarks(),
        hostRef.current.getFormValues(),
      ]);
      if (cancelled) return;
      setMarks(stored);
      setFormValues(values);
      formLoaded.current = true;
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

  /*
   * Form answers are written out whenever they change, not from the handler that changed
   * them. The state update is then a pure function of the previous state, which is what
   * lets three edits inside one batch all survive.
   */
  React.useEffect(() => {
    if (!formLoaded.current) return;
    void hostRef.current.setFormValues(formValues);
  }, [formValues]);

  /* ------------------------------------------------------------------ marks */

  const addMark = React.useCallback(async (mark: PdfMark) => {
    setMarks((current) => [...current, mark]);
    setSelectedId(mark.id);
    await hostRef.current.saveMark(mark);
  }, []);

  const updateMark = React.useCallback(async (mark: PdfMark) => {
    setMarks((current) => current.map((entry) => (entry.id === mark.id ? mark : entry)));
    await hostRef.current.saveMark(mark);
  }, []);

  const removeSelected = React.useCallback(async () => {
    if (!selectedId) return;
    setMarks((current) => current.filter((entry) => entry.id !== selectedId));
    setSelectedId(null);
    await hostRef.current.deleteMark(selectedId);
  }, [selectedId]);

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
    const picture = await new Promise<SignatureResult | null>((resolve) => {
      answerStamp.current = resolve;
      if (tool === 'signature') setSigning(true);
      else {
        void hostRef.current.pickImage().then(resolve);
      }
    });
    answerStamp.current = null;
    if (!picture) return null;

    const imageId = await hostRef.current.putStamp(picture.bytes, picture.mime);
    return { imageId, ratio: picture.ratio };
  }, [tool]);

  const requestText = React.useCallback(async (initial: string) => {
    const answer = await new Promise<string | null>((resolve) => {
      answerText.current = resolve;
      setTextPrompt({ title: initial.length > 0 ? 'Text ändern' : 'Text', initial });
    });
    answerText.current = null;
    setTextPrompt(null);
    return answer;
  }, []);

  const loadStamp = React.useCallback(
    (id: string) => hostRef.current.getStamp(id),
    [],
  );

  /* ------------------------------------------------------------------ saving */

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
      setSaving(false);
      setBusy('Die Datei wird geschrieben…');
      try {
        const original = await hostRef.current.loadOriginal();
        if (!original) throw new Error('Die Originaldatei fehlt.');

        const output = await buildPdf(original, {
          marks,
          formValues,
          flattenForm: choice.flattenForm,
          hardRedaction: choice.hardRedaction,
          renderPage: renderPageToPng,
          loadImage: (id) => hostRef.current.getStamp(id),
        });

        if (choice.target === 'download') {
          await hostRef.current.deliver(
            output,
            editedFileName(hostRef.current.fileName ?? hostRef.current.title),
            'application/pdf',
          );
          setToast('Die bearbeitete Datei ist fertig.');
        } else {
          await hostRef.current.replaceOriginal(output);
          setToast('Das Original wurde ersetzt.');
          reload();
        }
      } catch (error) {
        setToast(
          error instanceof Error ? error.message : 'Die Datei konnte nicht geschrieben werden.',
        );
      } finally {
        setBusy(null);
      }
    },
    [marks, formValues, renderPageToPng, reload],
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
      setBusy('Die Seiten werden neu geschrieben…');
      try {
        const original = await hostRef.current.loadOriginal();
        if (!original) throw new Error('Die Originaldatei fehlt.');

        const output = await buildPdf(original, { marks: [], ops: [op] });
        await hostRef.current.replaceOriginal(output);

        const moved: PdfMark[] = [];
        for (const mark of marks) {
          const nextPage = remapPage(op, mark.page);
          if (nextPage === null) {
            await hostRef.current.deleteMark(mark.id);
            continue;
          }
          const next = nextPage === mark.page ? mark : { ...mark, page: nextPage, updatedAt: Date.now() };
          if (next !== mark) await hostRef.current.saveMark(next);
          moved.push(next);
        }
        setMarks(moved);
        setSelectedId(null);
        reload();
      } catch (error) {
        setToast(
          error instanceof Error ? error.message : 'Die Seiten konnten nicht geändert werden.',
        );
      } finally {
        setBusy(null);
      }
    },
    [marks, reload],
  );

  /** The chosen pages as a document of their own. The original is not touched. */
  const extractSelection = React.useCallback(async (pages: number[]) => {
    if (pages.length === 0) return;
    setBusy('Die Seiten werden herausgelöst…');
    try {
      const original = await hostRef.current.loadOriginal();
      if (!original) throw new Error('Die Originaldatei fehlt.');
      const output = await extractPages(original, pages);
      const base = (hostRef.current.fileName ?? hostRef.current.title).replace(/\.pdf$/i, '');
      await hostRef.current.deliver(
        output,
        `${base}-seite-${pages[0]}${pages.length > 1 ? '-ff' : ''}.pdf`,
        'application/pdf',
      );
      setToast(`${pages.length} Seite${pages.length === 1 ? '' : 'n'} als neue Datei gespeichert.`);
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : 'Die Seiten konnten nicht herausgelöst werden.',
      );
    } finally {
      setBusy(null);
    }
  }, []);

  const shareOriginal = React.useCallback(async () => {
    const bytes = await hostRef.current.loadOriginal();
    if (!bytes) return;
    await hostRef.current.deliver(
      bytes,
      hostRef.current.fileName ?? `${hostRef.current.title}.pdf`,
      'application/pdf',
    );
  }, []);

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
  const toStream = host.toStream;

  return (
    /*
     * The marker the store-screenshot driver looks for. It photographs the running app
     * rather than a rebuilt mock, but only where a screen says which one it is — a route
     * that happens to return 200 proves nothing about what is on it.
     */
    <div
      className="flex h-[100dvh] flex-col"
      data-lexipulse-screen={editing ? '08-tools' : '07-original'}
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--lx-border)] bg-[var(--lx-bg)] px-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 items-center rounded-[6px] px-2 text-[14px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:bg-[var(--lx-surface-hover)] hover:text-[var(--lx-text)]"
          >
            ‹ Zurück
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--lx-text)]">
          {host.title}
        </h1>
        {marks.length > 0 && (
          <span className="font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]">
            {marks.length} Markierung{marks.length === 1 ? '' : 'en'}
          </span>
        )}
      </header>

      {/*
        The panels sit beside the viewer in the same row rather than floating over it.
        Fixed to the right edge they covered the toolbar, and the save button under them
        could not be clicked at all.
      */}
      <div className="flex min-h-0 flex-1">
        <main id="inhalt" className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                  <ToolButton label="Original weitergeben" onClick={() => void shareOriginal()}>
                    ⭳
                  </ToolButton>
                  <ToolButton
                    label="Bearbeitete Datei speichern"
                    onClick={() => setSaving(true)}
                  >
                    ⤓
                  </ToolButton>
                  {/*
                    Hidden for a document with no text layer. There is nothing to stream,
                    and the reader screen would only send the reader straight back here.
                  */}
                  {toStream && host.wordCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toStream(page.current)}
                      className="inline-flex h-8 shrink-0 items-center rounded-[6px] bg-[var(--lx-accent)] px-3 text-[13px] font-medium whitespace-nowrap text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
                    >
                      {/* The long form needs room a phone does not have. */}
                      <span className="sm:hidden">Wortstrom</span>
                      <span className="hidden sm:inline">Ab hier im Wortstrom</span>
                    </button>
                  )}
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
                    documentId={documentId}
                    selectedId={editing ? selectedId : null}
                    onSelect={setSelectedId}
                    onCreate={(mark) => void addMark(mark)}
                    onUpdate={(mark) => void updateMark(mark)}
                    requestStamp={requestStamp}
                    requestText={requestText}
                    loadStamp={loadStamp}
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
            onExtract={extractSelection}
            onClose={() => setPanel('none')}
            onGoToPage={(value) => viewer.current?.goToPage(value)}
          />
        )}

        {panel === 'form' && (
          <FormPanel
            documentId={documentId}
            values={formValues}
            onSet={(name, value) => setFormValues((current) => ({ ...current, [name]: value }))}
            onClose={() => setPanel('none')}
            loadOriginal={() => hostRef.current.loadOriginal()}
          />
        )}
      </div>

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

/** `Vertrag.pdf` → `Vertrag-bearbeitet.pdf`, so the original is never silently overwritten. */
export function editedFileName(name: string): string {
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
