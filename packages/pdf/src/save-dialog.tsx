'use client';

import * as React from 'react';

/**
 * What "speichern" is supposed to mean, asked once instead of guessed.
 *
 * Three decisions genuinely change the file, and each of them is one the reader has to
 * make knowingly:
 *
 * - **Where it goes.** A new file next to the original, or the original replaced. The
 *   second cannot be undone, so it is never the default.
 * - **Whether the form stays fillable.** Flattening turns the answers into part of the
 *   page; not flattening keeps a form the recipient could still change.
 * - **Whether a redaction removes the text or covers it.** These are not the same thing,
 *   and a black rectangle that leaves the words underneath has been the cause of enough
 *   published documents being un-redacted with a copy-paste that the difference belongs
 *   in front of the reader, not in a footnote.
 */

export interface SaveChoice {
  target: 'download' | 'replace';
  flattenForm: boolean;
  hardRedaction: boolean;
}

export function SaveDialog({
  hasRedaction,
  hasForm,
  deliverKind,
  onDone,
  onCancel,
}: {
  hasRedaction: boolean;
  hasForm: boolean;
  /** Whether the new file is downloaded or handed to the share sheet. */
  deliverKind: 'download' | 'share';
  onDone: (choice: SaveChoice) => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = React.useState<'download' | 'replace'>('download');
  const [flattenForm, setFlattenForm] = React.useState(false);
  const [hardRedaction, setHardRedaction] = React.useState(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Speichern"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
    >
      <div className="w-full max-w-[520px] rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-bg)] p-5">
        <h2 className="text-[16px] font-semibold">Bearbeitete Datei speichern</h2>

        <fieldset className="mt-4">
          <legend className="text-[13px] text-[var(--lx-text-muted)]">Wohin</legend>
          <div className="mt-2 flex flex-col gap-2">
            <Choice
              name="lx-save-target"
              checked={target === 'download'}
              onChange={() => setTarget('download')}
              title={
                deliverKind === 'share'
                  ? 'Als neue Datei weitergeben'
                  : 'Als neue Datei herunterladen'
              }
              hint={
                deliverKind === 'share'
                  ? 'Geht ins Teilen-Blatt. Das Original in der Bibliothek bleibt, wie es ist.'
                  : 'Das Original in der Bibliothek bleibt, wie es ist.'
              }
            />
            <Choice
              name="lx-save-target"
              checked={target === 'replace'}
              onChange={() => setTarget('replace')}
              title="Original in der Bibliothek ersetzen"
              hint="Nicht rückgängig zu machen. Die Markierungen bleiben trotzdem einzeln änderbar."
            />
          </div>
        </fieldset>

        {hasForm && (
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={flattenForm}
              onChange={(event) => setFlattenForm(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--lx-accent)]"
            />
            <span>
              <span className="block text-[14px] text-[var(--lx-text)]">
                Formular festschreiben
              </span>
              <span className="block text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
                Die Antworten werden Teil der Seite und lassen sich nicht mehr ändern — das,
                was man vor dem Verschicken macht.
              </span>
            </span>
          </label>
        )}

        {hasRedaction && (
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hardRedaction}
              onChange={(event) => setHardRedaction(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--lx-accent)]"
            />
            <span>
              <span className="block text-[14px] text-[var(--lx-text)]">
                Geschwärztes wirklich entfernen
              </span>
              <span className="block text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
                Die betroffenen Seiten werden als Bild neu geschrieben. Der Text darunter ist
                dann weg — auch für Kopieren und Suchen. Ohne diese Einstellung wird er nur
                überdeckt und bleibt lesbar, wenn jemand ihn markiert und kopiert.
              </span>
            </span>
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-[8px] border border-[var(--lx-border)] px-4 text-[14px] text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onDone({ target, flattenForm, hardRedaction })}
            className="h-10 rounded-[8px] bg-[var(--lx-accent)] px-5 text-[14px] font-medium text-[var(--lx-accent-on)] hover:bg-[var(--lx-accent-strong)]"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function Choice({
  name,
  checked,
  onChange,
  title,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-[var(--lx-accent)]"
      />
      <span>
        <span className="block text-[14px] text-[var(--lx-text)]">{title}</span>
        <span className="block text-[13px] leading-relaxed text-[var(--lx-text-muted)]">{hint}</span>
      </span>
    </label>
  );
}
