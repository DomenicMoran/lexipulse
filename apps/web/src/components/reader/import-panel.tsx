'use client';

import type { LexiDocument } from '@lexipulse/core';
import { Button, SegmentedControl } from '@lexipulse/ui';
import * as React from 'react';
import { LinkIcon, TextIcon, UploadIcon } from '@/components/icons';
import {
  ACCEPTED_EXTENSIONS,
  IMAGE_TYPES,
  importFromFile,
  importFromImages,
  importFromText,
  importFromUrl,
  type ImportProgress,
} from '@/lib/import';

type Mode = 'file' | 'url' | 'paste';

const MODES = [
  { value: 'file' as const, label: 'Datei' },
  { value: 'url' as const, label: 'Adresse' },
  { value: 'paste' as const, label: 'Text' },
];

export interface ImportPanelProps {
  onImported: (document: LexiDocument) => void | Promise<void>;
}

export function ImportPanel({ onImported }: ImportPanelProps) {
  const [mode, setMode] = React.useState<Mode>('file');
  const [dragging, setDragging] = React.useState(false);
  const [progress, setProgress] = React.useState<ImportProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState('');
  const [text, setText] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const busy = progress !== null;

  const run = React.useCallback(
    async (task: () => Promise<LexiDocument> | LexiDocument) => {
      setError(null);
      setProgress({ label: 'Import startet', percent: null });
      try {
        const document = await task();
        setProgress({ label: 'Wird gespeichert', percent: 1 });
        await onImported(document);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Der Import ist fehlgeschlagen.');
      } finally {
        setProgress(null);
      }
    },
    [onImported],
  );

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      const chosen = Array.from(files ?? []);
      const first = chosen[0];
      if (!first) return;

      /*
       * Pictures become one PDF, in the order they were chosen.
       *
       * A photographed contract is the case: three pictures go in, one document comes
       * out, and everything after this point is the path a PDF already takes.
       */
      if (IMAGE_TYPES.test(first.type)) {
        void run(() => importFromImages(chosen.filter((f) => IMAGE_TYPES.test(f.type)), setProgress));
        return;
      }
      void run(() => importFromFile(first, setProgress));
    },
    [run],
  );

  return (
    <div className="rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Dokument importieren</h2>
          <p className="mt-1 text-[14px] text-[var(--lx-text-muted)]">
            Alles wird auf Ihrem Gerät verarbeitet und gespeichert.
          </p>
        </div>
        <SegmentedControl<Mode>
          label="Import-Art"
          value={mode}
          options={MODES}
          onValueChange={setMode}
        />
      </div>

      <div className="mt-6">
        {mode === 'file' && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleFiles(event.dataTransfer.files);
            }}
            className={
              'flex flex-col items-center justify-center gap-4 rounded-[12px] border border-dashed px-6 py-14 text-center transition-colors duration-140 ' +
              (dragging
                ? 'border-[var(--lx-accent)] bg-[var(--lx-accent-soft)]'
                : 'border-[var(--lx-border-strong)]')
            }
          >
            <UploadIcon width={24} height={24} className="text-[var(--lx-text-muted)]" />
            <div>
              <p className="text-[16px] text-[var(--lx-text)]">
                Datei hierher ziehen oder auswählen
              </p>
              <p className="mt-1 text-[13px] text-[var(--lx-text-muted)]">
                PDF, EPUB, FB2, TXT, Markdown, HTML — bis 80 MB
              </p>
              <p className="mt-1 text-[13px] text-[var(--lx-text-muted)]">
                Mehrere Bilder werden zu einer PDF, in der Reihenfolge der Auswahl.
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Datei auswählen
            </Button>
          </div>
        )}

        {mode === 'url' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (url.trim().length === 0) return;
              void run(() => importFromUrl(url.trim(), setProgress));
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="lx-url" className="text-[13px] font-medium text-[var(--lx-text-muted)]">
              Adresse des Artikels
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <LinkIcon
                  width={16}
                  height={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--lx-text-muted)]"
                />
                <input
                  id="lx-url"
                  type="url"
                  inputMode="url"
                  required
                  placeholder="https://example.com/artikel"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="h-11 w-full rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-bg)] pr-3 pl-9 text-[15px] text-[var(--lx-text)] outline-none placeholder:text-[var(--lx-text-muted)] focus-visible:border-[var(--lx-accent)]"
                />
              </div>
              <Button type="submit" variant="primary" disabled={busy}>
                Artikel laden
              </Button>
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
              Die Seite wird von unserem Server abgerufen, weil der Browser fremde Seiten
              nicht direkt auslesen darf. Die Adresse wird dabei nicht protokolliert und
              nicht gespeichert.
            </p>
          </form>
        )}

        {mode === 'paste' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => importFromText(text));
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="lx-text" className="text-[13px] font-medium text-[var(--lx-text-muted)]">
              Text einfügen
            </label>
            <textarea
              id="lx-text"
              rows={9}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Text hier einfügen. Leerzeilen trennen Absätze."
              className="w-full resize-y rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-bg)] p-3 text-[15px] leading-relaxed text-[var(--lx-text)] outline-none placeholder:text-[var(--lx-text-muted)] focus-visible:border-[var(--lx-accent)]"
            />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={busy || text.trim().length === 0}>
                Text übernehmen
              </Button>
              <span className="text-[13px] text-[var(--lx-text-muted)]">
                {text.trim().length > 0
                  ? `${text.trim().split(/\s+/).length} Wörter`
                  : 'Markdown wird erkannt'}
              </span>
            </div>
          </form>
        )}
      </div>

      {progress && (
        <div className="mt-6 flex flex-col gap-2" aria-live="polite">
          <div className="flex items-center justify-between text-[13px] text-[var(--lx-text-muted)]">
            <span>{progress.label}</span>
            {progress.percent !== null && (
              <span className="font-mono tabular-nums">
                {Math.round(progress.percent * 100)} %
              </span>
            )}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--lx-border)]">
            <div
              className={
                'h-full rounded-full bg-[var(--lx-accent)] ' +
                (progress.percent === null ? 'w-1/3 animate-pulse' : '')
              }
              style={progress.percent !== null ? { width: `${progress.percent * 100}%` } : undefined}
            />
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-[10px] border border-[var(--lx-danger)] bg-[var(--lx-danger-soft)] px-4 py-3 text-[14px] text-[var(--lx-text)]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--lx-border)] pt-5 text-[13px] text-[var(--lx-text-muted)]">
        <span className="inline-flex items-center gap-2">
          <TextIcon width={15} height={15} />
          Reine Scan-PDFs ohne Textebene lassen sich nicht lesen.
        </span>
      </div>
    </div>
  );
}
