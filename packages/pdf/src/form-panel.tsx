'use client';

import type { PdfFieldValue } from '@lexipulse/core';
import * as React from 'react';
import { readFormFields, type PdfFormField } from './export.js';

/**
 * Filling in an interactive form.
 *
 * A list beside the page rather than boxes drawn on top of it. Two reasons: a PDF form
 * field is a rectangle with no label — the words next to it are page content, not part of
 * the field — so an input placed on the page is an unlabelled box a screen reader cannot
 * announce. And the fields of a real form are spread over pages the reader would
 * otherwise have to hunt through.
 *
 * Nothing is written into the file here. The answers are stored beside the document and
 * become part of a PDF only when one is exported, which is what lets a half-filled form
 * survive closing the tab.
 */
export function FormPanel({
  documentId,
  values,
  onSet,
  onClose,
  loadOriginal,
}: {
  documentId: string;
  values: Record<string, PdfFieldValue>;
  /**
   * One field at a time, never the whole record.
   *
   * Handing back a merged object closes over the `values` of the render the handler was
   * created in. Three edits inside one batch then all merge into the same stale copy and
   * only the last one survives — which is exactly what happened to a ticked checkbox
   * between a typed name and a chosen option.
   */
  onSet: (name: string, value: PdfFieldValue) => void;
  onClose: () => void;
  loadOriginal: () => Promise<Uint8Array | null>;
}) {
  const [fields, setFields] = React.useState<PdfFormField[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bytes = await loadOriginal();
        if (!bytes) throw new Error('Die Originaldatei fehlt.');
        const read = await readFormFields(bytes);
        if (!cancelled) setFields(read);
      } catch {
        if (!cancelled) setError('Die Formularfelder konnten nicht gelesen werden.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, loadOriginal]);

  const set = onSet;

  return (
    <aside
      aria-label="Formular"
      className="flex h-full w-full shrink-0 flex-col border-l border-[var(--lx-border)] bg-[var(--lx-bg)] sm:w-[360px]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--lx-border)] px-3">
        <h2 className="text-[14px] font-medium">Formular</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Formular schließen"
          className="rounded-[6px] p-1 text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error && <p className="text-[13px] text-[var(--lx-text-muted)]">{error}</p>}
        {!error && fields === null && (
          <p className="text-[13px] text-[var(--lx-text-muted)]">Wird gelesen…</p>
        )}
        {fields !== null && fields.length === 0 && (
          <p className="text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
            Diese Datei enthält kein ausfüllbares Formular. Mit dem Textfeld-Werkzeug lässt
            sich trotzdem an jeder Stelle etwas eintragen.
          </p>
        )}

        <div className="flex flex-col gap-4">
          {(fields ?? []).map((field) => {
            const id = `lx-form-${field.name.replace(/[^a-z0-9]/gi, '-')}`;
            const value = values[field.name] ?? field.value ?? '';

            return (
              <div key={field.name}>
                <label
                  htmlFor={id}
                  className="mb-1 block text-[13px] break-words text-[var(--lx-text-muted)]"
                >
                  {field.name}
                  {field.readOnly && ' (unveränderlich)'}
                </label>

                {field.type === 'text' &&
                  (field.multiline ? (
                    <textarea
                      id={id}
                      rows={3}
                      disabled={field.readOnly}
                      value={String(value)}
                      onChange={(event) => set(field.name, event.target.value)}
                      className="w-full resize-y rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-2 text-[14px] text-[var(--lx-text)] disabled:opacity-50"
                    />
                  ) : (
                    <input
                      id={id}
                      disabled={field.readOnly}
                      value={String(value)}
                      onChange={(event) => set(field.name, event.target.value)}
                      className="h-10 w-full rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 text-[14px] text-[var(--lx-text)] disabled:opacity-50"
                    />
                  ))}

                {field.type === 'checkbox' && (
                  <input
                    id={id}
                    type="checkbox"
                    disabled={field.readOnly}
                    checked={value === true}
                    onChange={(event) => set(field.name, event.target.checked)}
                    className="h-5 w-5 accent-[var(--lx-accent)]"
                  />
                )}

                {(field.type === 'dropdown' || field.type === 'radio') && (
                  <select
                    id={id}
                    disabled={field.readOnly}
                    value={String(value)}
                    onChange={(event) => set(field.name, event.target.value)}
                    className="h-10 w-full rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-2 text-[14px] text-[var(--lx-text)] disabled:opacity-50"
                  >
                    <option value="">— bitte wählen —</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'options' && (
                  <select
                    id={id}
                    multiple
                    disabled={field.readOnly}
                    value={Array.isArray(value) ? value : []}
                    onChange={(event) =>
                      set(
                        field.name,
                        Array.from(event.target.selectedOptions).map((option) => option.value),
                      )
                    }
                    className="w-full rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-2 text-[14px] text-[var(--lx-text)] disabled:opacity-50"
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="shrink-0 border-t border-[var(--lx-border)] px-4 py-3 text-[12px] leading-relaxed text-[var(--lx-text-muted)]">
        Die Antworten liegen auf diesem Gerät. In die PDF kommen sie erst beim Speichern.
      </p>
    </aside>
  );
}
