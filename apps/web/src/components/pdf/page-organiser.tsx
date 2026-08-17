'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as React from 'react';
import type { PageOp } from '@/lib/pdf-export';
import type { PageSize } from './pdf-doc';
import { PdfPage } from './pdf-page';

/**
 * Rearranging the document itself: turning, deleting, reordering, adding.
 *
 * Applied one operation at a time and written straight back to the file, rather than
 * collected into a queue that is committed at the end. The reader can see whether the
 * page really did move, and there is no state in which the thumbnails show one order and
 * the file holds another.
 *
 * Every operation moves the reader's marks with it — that happens in the surface above,
 * because it owns them. What this panel does is say which operation to perform.
 */
export function PageOrganiser({
  doc,
  sizes,
  busy,
  onApply,
  onClose,
  onGoToPage,
}: {
  doc: PDFDocumentProxy;
  sizes: PageSize[];
  busy: boolean;
  onApply: (op: PageOp) => Promise<void>;
  onClose: () => void;
  onGoToPage: (page: number) => void;
}) {
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const toggle = (page: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });

  const insertFile = (accept: string, build: (file: File) => Promise<PageOp>) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) await onApply(await build(file));
    };
    input.click();
  };

  const after = selected.size > 0 ? Math.max(...selected) : sizes.length;

  return (
    <aside
      aria-label="Seiten"
      className="fixed top-0 right-0 z-40 flex h-[100dvh] w-full max-w-[420px] flex-col border-l border-[var(--lx-border)] bg-[var(--lx-bg)]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--lx-border)] px-3">
        <h2 className="text-[14px] font-medium">Seiten</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Seiten schließen"
          className="rounded-[6px] p-1 text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[var(--lx-border)] px-3 py-2">
        <Action label="Leere Seite" disabled={busy} onClick={() => void onApply({ kind: 'insertBlank', after })} />
        <Action
          label="PDF einfügen"
          disabled={busy}
          onClick={() =>
            insertFile('application/pdf', async (file) => ({
              kind: 'insertPdf',
              after,
              bytes: new Uint8Array(await file.arrayBuffer()),
            }))
          }
        />
        <Action
          label="Bild einfügen"
          disabled={busy}
          onClick={() =>
            insertFile('image/png,image/jpeg', async (file) => ({
              kind: 'insertImage',
              after,
              bytes: new Uint8Array(await file.arrayBuffer()),
              mime: file.type,
            }))
          }
        />
      </div>

      <p className="shrink-0 px-3 pt-2 text-[12px] text-[var(--lx-text-muted)]">
        {selected.size > 0
          ? `${selected.size} Seite${selected.size === 1 ? '' : 'n'} gewählt — Eingefügtes landet nach Seite ${after}.`
          : 'Eine Seite antippen wählt sie aus. Eingefügtes landet am Ende.'}
      </p>

      <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-3">
        {sizes.map((size, index) => {
          const page = index + 1;
          const width = 150;
          const scale = width / size.width;
          return (
            <li key={page} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(page)}
                onDoubleClick={() => onGoToPage(page)}
                aria-pressed={selected.has(page)}
                aria-label={`Seite ${page} auswählen`}
                className={
                  'rounded-[4px] border-2 p-0.5 transition-colors duration-140 ' +
                  (selected.has(page) ? 'border-[var(--lx-accent)]' : 'border-transparent')
                }
              >
                <PdfPage
                  doc={doc}
                  pageNumber={page}
                  scale={scale}
                  rotation={0}
                  active
                  size={size}
                  onSize={() => undefined}
                  onNavigate={onGoToPage}
                  invert={false}
                  minimal
                />
              </button>

              <div className="flex items-center gap-1">
                <span className="mr-1 font-mono text-[11px] tabular-nums text-[var(--lx-text-muted)]">
                  {page}
                </span>
                <Tiny
                  label={`Seite ${page} nach links drehen`}
                  glyph="⟲"
                  disabled={busy}
                  onClick={() => void onApply({ kind: 'rotate', page, degrees: 270 })}
                />
                <Tiny
                  label={`Seite ${page} nach rechts drehen`}
                  glyph="⟳"
                  disabled={busy}
                  onClick={() => void onApply({ kind: 'rotate', page, degrees: 90 })}
                />
                <Tiny
                  label={`Seite ${page} nach vorne`}
                  glyph="‹"
                  disabled={busy || page === 1}
                  onClick={() => void onApply({ kind: 'move', page, to: page - 1 })}
                />
                <Tiny
                  label={`Seite ${page} nach hinten`}
                  glyph="›"
                  disabled={busy || page === sizes.length}
                  onClick={() => void onApply({ kind: 'move', page, to: page + 1 })}
                />
                <Tiny
                  label={`Seite ${page} löschen`}
                  glyph="✕"
                  disabled={busy || sizes.length <= 1}
                  onClick={() => void onApply({ kind: 'delete', page })}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="shrink-0 border-t border-[var(--lx-border)] px-3 py-3 text-[12px] leading-relaxed text-[var(--lx-text-muted)]">
        Änderungen an den Seiten werden sofort in die Datei geschrieben. Markierungen wandern
        mit; auf einer gelöschten Seite werden sie mit ihr entfernt.
      </p>
    </aside>
  );
}

function Action({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center rounded-[6px] border border-[var(--lx-border)] px-3 text-[13px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:border-[var(--lx-border-strong)] hover:text-[var(--lx-text)] disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function Tiny({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--lx-border)] text-[12px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:bg-[var(--lx-surface-hover)] hover:text-[var(--lx-text)] disabled:opacity-30"
    >
      {glyph}
    </button>
  );
}
