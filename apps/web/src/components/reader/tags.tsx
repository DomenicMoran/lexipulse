'use client';

/**
 * Tags: the shelves a reader sorts the library onto.
 *
 * Two pieces, because the library needs them in two places. A row of chips that filters the
 * list, and a dialog that edits one document's tags. Both use the same chip, so a tag looks
 * the same wherever it turns up.
 */
import { fold, normalizeTags } from '@lexipulse/core';
import { Button } from '@lexipulse/ui';
import * as React from 'react';
import { CloseIcon, type IconProps } from '@/components/icons';

/** The label, drawn to the same hairline grid as the rest of the set. */
export const TagIcon = (props: IconProps) => (
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
    <path d="M3.5 11.2V4.5a1 1 0 0 1 1-1h6.7a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-6.7 6.7a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" />
    <circle cx="7.8" cy="7.8" r="1.3" />
  </svg>
);

function chipClass(selected: boolean): string {
  return (
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-140 ' +
    (selected
      ? 'border-[var(--lx-accent)] bg-[var(--lx-accent-soft)] text-[var(--lx-text)]'
      : 'border-[var(--lx-border)] text-[var(--lx-text-muted)] hover:border-[var(--lx-border-strong)] hover:text-[var(--lx-text)]')
  );
}

/**
 * The filter row above the list.
 *
 * Nothing at all while no document carries a tag: an empty shelf rail is a control that
 * teaches the reader nothing and costs them a row of height.
 */
export function TagFilterBar({
  tags,
  active,
  onToggle,
}: {
  tags: string[];
  /** Folded form of the selected tag, or null. */
  active: string | null;
  onToggle: (tag: string) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--lx-text-muted)] uppercase">
        Schlagwörter
      </span>
      {tags.map((tag) => {
        const selected = active === fold(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(tag)}
            className={chipClass(selected)}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Edit one document's tags.
 *
 * Mounted only while open, so the draft starts from the stored list without an effect
 * copying props into state. Nothing is written until the reader saves, because a dialog
 * that persists every keystroke cannot be cancelled.
 */
export function TagEditor({
  documentTitle,
  tags,
  suggestions,
  onCancel,
  onSave,
}: {
  documentTitle: string;
  tags: string[];
  /** Tags used on other documents, offered as one-click additions. */
  suggestions: string[];
  onCancel: () => void;
  onSave: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState<string[]>(tags);
  const [input, setInput] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const add = (raw: string) => {
    // Normalising on the way in rather than on save: the chip the reader sees is then the
    // string that will be stored, trimming and deduplication included.
    setDraft((current) => normalizeTags([...current, raw]));
    setInput('');
  };

  const unused = suggestions.filter((tag) => !draft.some((held) => fold(held) === fold(tag)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--lx-overlay)] p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lx-tags-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-[26rem] flex-col overflow-y-auto rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5"
      >
        <h2 id="lx-tags-title" className="text-[17px] font-semibold tracking-[-0.015em]">
          Schlagwörter bearbeiten
        </h2>
        <p className="mt-0.5 truncate text-[13px] text-[var(--lx-text-muted)]">{documentTitle}</p>

        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim().length > 0) add(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={32}
            aria-label="Neues Schlagwort"
            placeholder="Neues Schlagwort"
            className="h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-bg)] px-3 text-[14px] text-[var(--lx-text)] outline-none focus-visible:border-[var(--lx-accent)]"
          />
          <Button type="submit" size="sm" disabled={input.trim().length === 0}>
            Hinzufügen
          </Button>
        </form>

        {draft.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {draft.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-label={`${tag} entfernen`}
                onClick={() => setDraft((current) => current.filter((held) => held !== tag))}
                className={chipClass(true)}
              >
                {tag}
                <CloseIcon width={14} height={14} />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-[var(--lx-text-muted)]">
            Noch keine Schlagwörter vergeben.
          </p>
        )}

        {unused.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--lx-text-muted)] uppercase">
              Schon vergeben
            </span>
            <div className="flex flex-wrap gap-2">
              {unused.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => add(tag)}
                  className={chipClass(false)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button size="sm" variant="primary" onClick={() => onSave(draft)}>
            Sichern
          </Button>
        </div>
      </div>
    </div>
  );
}
