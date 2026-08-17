'use client';

import * as React from 'react';

/**
 * The words of a text box or a note.
 *
 * A dialog rather than editing in place on the page: at 60 % zoom a text box is six
 * pixels tall, and typing into something that small is a way of making mistakes rather
 * than a way of writing.
 */
export function TextDialog({
  title,
  initial,
  onDone,
  onCancel,
}: {
  title: string;
  initial: string;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  const field = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    field.current?.focus();
    field.current?.setSelectionRange(initial.length, initial.length);
  }, [initial.length]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onDone(value);
        }}
        className="w-full max-w-[480px] rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-bg)] p-5"
      >
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <label htmlFor="lx-mark-text" className="sr-only">
          {title}
        </label>
        <textarea
          id="lx-mark-text"
          ref={field}
          rows={4}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancel();
            // Enter alone breaks the line, because a note is prose; the shortcut confirms.
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onDone(value);
          }}
          className="mt-3 w-full resize-y rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-3 text-[14px] leading-relaxed text-[var(--lx-text)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-[8px] border border-[var(--lx-border)] px-4 text-[14px] text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="h-10 rounded-[8px] bg-[var(--lx-accent)] px-5 text-[14px] font-medium text-[var(--lx-accent-on)] hover:bg-[var(--lx-accent-strong)]"
          >
            Übernehmen
          </button>
        </div>
      </form>
    </div>
  );
}
