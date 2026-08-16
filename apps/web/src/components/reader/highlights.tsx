'use client';

import { HIGHLIGHT_COLORS, type Annotation, type HighlightColor } from '@lexipulse/core';
import { IconButton } from '@lexipulse/ui';
import * as React from 'react';
import { CloseIcon, TrashIcon, type IconProps } from '@/components/icons';

/** The pen, drawn to the same hairline grid as the rest of the set. */
export const HighlightIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path d="M4 20h16" />
    <path d="M6.5 16.5 15 8l3 3-8.5 8.5H6.5v-3Z" />
    <path d="m15 8 2-2a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6l-2 2" />
  </svg>
);

/** Fixed swatches, readable on the dark surface and distinct from the accent red. */
export const HIGHLIGHT_TINTS: Record<HighlightColor, string> = {
  yellow: '#FFD54A',
  green: '#79D27A',
  blue: '#6FB6FF',
  pink: '#FF8FB8',
  purple: '#BFA0FF',
};

/**
 * The same hues laid under running text.
 *
 * A solid swatch behind body copy would need the text to flip to black; at this alpha the
 * mark reads as a mark and the paragraph keeps its contrast ratio.
 */
export const HIGHLIGHT_WASHES: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 213, 74, 0.28)',
  green: 'rgba(121, 210, 122, 0.28)',
  blue: 'rgba(111, 182, 255, 0.28)',
  pink: 'rgba(255, 143, 184, 0.28)',
  purple: 'rgba(191, 160, 255, 0.28)',
};

export const HIGHLIGHT_LABELS: Record<HighlightColor, string> = {
  yellow: 'Gelb',
  green: 'Grün',
  blue: 'Blau',
  pink: 'Rosa',
  purple: 'Violett',
};

/** The five swatches, as a row of buttons. */
function ColorRow({
  selected,
  onPick,
  size = 26,
}: {
  selected: HighlightColor | null;
  onPick: (color: HighlightColor) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onPick(color)}
          aria-label={`Markierung ${HIGHLIGHT_LABELS[color]}`}
          aria-pressed={selected === color}
          title={HIGHLIGHT_LABELS[color]}
          className="rounded-full transition-transform duration-140 hover:scale-110"
          style={{
            width: size,
            height: size,
            backgroundColor: HIGHLIGHT_TINTS[color],
            border:
              selected === color ? '2px solid var(--lx-text)' : '1px solid var(--lx-border-strong)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * The bar under the page panel once a passage is selected.
 *
 * On the phone the selection is built word by word because dragging over running text is
 * unreliable there. In a browser the native selection is the expected gesture, so this
 * only has to offer the five colours and get out of the way.
 */
export function HighlightBar({
  preview,
  onColor,
  onCancel,
}: {
  preview: string;
  onColor: (color: HighlightColor) => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--lx-border-strong)] bg-[var(--lx-surface)] px-4 py-3">
      <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--lx-text-muted)]">
        <span className="text-[var(--lx-text)]">Markieren:</span> {preview}
      </p>
      <ColorRow selected={null} onPick={onColor} />
      <IconButton label="Auswahl aufheben" variant="ghost" size="sm" onClick={onCancel}>
        <CloseIcon width={16} height={16} />
      </IconButton>
    </div>
  );
}

/**
 * Every marked passage in the document, newest anchor first as the store returns them.
 *
 * This is the half of highlighting that makes the other half worth having: a mark you
 * cannot find again is a mark you did not make.
 */
export function AnnotationList({
  annotations,
  chapterTitles,
  onJump,
  onColor,
  onNote,
  onDelete,
}: {
  annotations: Annotation[];
  chapterTitles: string[];
  onJump: (tokenIndex: number) => void;
  onColor: (annotation: Annotation, color: HighlightColor) => void;
  onNote: (annotation: Annotation, note: string) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  return (
    <section
      aria-label="Markierungen"
      className="rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-4"
    >
      <h2 className="text-[15px] font-semibold">Markierungen</h2>
      {annotations.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
          Noch nichts markiert. Öffnen Sie den Fließtext und wählen Sie eine Stelle mit der
          Maus aus — die Farben erscheinen dann unter dem Text.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {annotations.map((annotation) => (
            <li key={annotation.id}>
              <AnnotationRow
                annotation={annotation}
                chapter={chapterTitles[annotation.chapterIndex] ?? null}
                onJump={onJump}
                onColor={onColor}
                onNote={onNote}
                onDelete={onDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AnnotationRow({
  annotation,
  chapter,
  onJump,
  onColor,
  onNote,
  onDelete,
}: {
  annotation: Annotation;
  chapter: string | null;
  onJump: (tokenIndex: number) => void;
  onColor: (annotation: Annotation, color: HighlightColor) => void;
  onNote: (annotation: Annotation, note: string) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [note, setNote] = React.useState(annotation.note ?? '');

  return (
    <div className="rounded-[10px] border border-[var(--lx-border)] p-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: HIGHLIGHT_TINTS[annotation.color] }}
        />
        <button
          type="button"
          onClick={() => onJump(annotation.startToken)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="line-clamp-3 text-[14px] leading-relaxed text-[var(--lx-text)]">
            {annotation.text}
          </span>
          <span className="mt-1 block text-[12px] text-[var(--lx-text-faint)]">
            {chapter ?? `Kapitel ${annotation.chapterIndex + 1}`} · zur Stelle springen
          </span>
        </button>
        <IconButton
          label="Markierung löschen"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(annotation)}
        >
          <TrashIcon width={16} height={16} />
        </IconButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <ColorRow
          selected={annotation.color}
          size={22}
          onPick={(color) => onColor(annotation, color)}
        />
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[13px] text-[var(--lx-text-muted)] underline underline-offset-2 transition-colors duration-140 hover:text-[var(--lx-text)]"
          >
            {annotation.note ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`lx-note-${annotation.id}`} className="sr-only">
            Notiz zur Markierung
          </label>
          <textarea
            id={`lx-note-${annotation.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Notiz"
            className="w-full resize-y rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-bg)] px-3 py-2 text-[14px] text-[var(--lx-text)] outline-none placeholder:text-[var(--lx-text-faint)] focus-visible:border-[var(--lx-accent)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onNote(annotation, note.trim());
                setEditing(false);
              }}
              className="rounded-[8px] bg-[var(--lx-accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
            >
              Notiz sichern
            </button>
            <button
              type="button"
              onClick={() => {
                setNote(annotation.note ?? '');
                setEditing(false);
              }}
              className="rounded-[8px] px-3 py-1.5 text-[13px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:text-[var(--lx-text)]"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : annotation.note ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
          {annotation.note}
        </p>
      ) : null}
    </div>
  );
}
