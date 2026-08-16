'use client';

import type { LibraryEntry } from '@lexipulse/core';
import { Button, ProgressBar } from '@lexipulse/ui';
import Link from 'next/link';
import * as React from 'react';
import { TrashIcon, UploadIcon } from '@/components/icons';
import { DataTransfer } from '@/components/reader/data-transfer';
import { ReaderNav } from '@/components/reader/reader-nav';
import { useSettings } from '@/components/settings-provider';
import { SOURCE_LABELS, formatDate, formatMinutes, formatNumber, formatPercent } from '@/lib/format';
import { getStore } from '@/lib/store';

/**
 * Remaining time, estimated without tokenising the document.
 *
 * The pacing matrix stretches the nominal rate by roughly a fifth on ordinary prose, so
 * the estimate carries that factor. It is labelled as an estimate everywhere it appears;
 * the exact figure comes from the engine once the document is open.
 */
const PACING_OVERHEAD = 1.2;

function remainingMs(entry: LibraryEntry, wpm: number): number {
  const done = entry.progress?.percent ?? 0;
  const words = entry.document.wordCount * (1 - Math.min(Math.max(done, 0), 1));
  return (words / Math.max(wpm, 1)) * 60_000 * PACING_OVERHEAD;
}

export function LibraryView() {
  const { settings } = useSettings();
  const [entries, setEntries] = React.useState<LibraryEntry[] | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    void getStore()
      .then((store) => store.listLibrary())
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  React.useEffect(load, [load]);

  const remove = async (id: string) => {
    const store = await getStore();
    await store.deleteDocument(id);
    setConfirming(null);
    load();
  };

  return (
    <>
      <ReaderNav />
      <main id="inhalt" data-lexipulse-screen="05-library" className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-12">
        <h1 className="text-[31px] font-semibold tracking-[-0.03em]">Bibliothek</h1>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
          Alle importierten Dokumente liegen in der IndexedDB dieses Browsers. Es gibt keine
          Synchronisierung zwischen Geräten — das ist der Preis dafür, dass nichts hochgeladen
          wird.
        </p>

        {entries === null && (
          <p className="py-16 text-[15px] text-[var(--lx-text-muted)]">Wird geladen…</p>
        )}

        {entries !== null && entries.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-[14px] border border-dashed border-[var(--lx-border-strong)] px-6 py-16 text-center">
            <UploadIcon width={24} height={24} className="text-[var(--lx-text-muted)]" />
            <p className="text-[16px]">Noch keine Dokumente.</p>
            <Link
              href="/reader"
              className="inline-flex h-10 items-center rounded-[10px] bg-[var(--lx-accent)] px-4 text-[15px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
            >
              Erstes Dokument importieren
            </Link>
          </div>
        )}

        {entries !== null && entries.length > 0 && (
          <ul className="mt-8 flex flex-col gap-3">
            {entries.map((entry) => {
              const { document, progress } = entry;
              const percent = progress?.percent ?? 0;
              return (
                <li
                  key={document.id}
                  className="flex gap-4 rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-4"
                >
                  <div className="hidden h-[104px] w-[72px] shrink-0 overflow-hidden rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-bg)] sm:block">
                    {document.coverDataUrl ? (
                      // Covers are data URLs from the user's own file. They never leave the
                      // device, so there is nothing for an image optimiser to fetch.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={document.coverDataUrl}
                        alt=""
                        width={72}
                        height={104}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-[11px] tracking-[0.08em] text-[var(--lx-text-muted)] uppercase"
                        style={{ fontFamily: 'var(--lx-font-mono-ui)' }}
                      >
                        {SOURCE_LABELS[document.source] ?? document.source}
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 className="text-[16px] font-medium text-[var(--lx-text)]">
                        {document.title}
                      </h2>
                      <span className="font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]">
                        {formatPercent(percent)}
                      </span>
                    </div>

                    <p className="text-[13px] text-[var(--lx-text-muted)]">
                      {document.author ? `${document.author} · ` : ''}
                      {SOURCE_LABELS[document.source] ?? document.source} ·{' '}
                      {formatNumber(document.wordCount)} Wörter · noch ca.{' '}
                      {formatMinutes(remainingMs(entry, settings.wpm))} · importiert am{' '}
                      {formatDate(document.createdAt)}
                    </p>

                    <ProgressBar value={percent} label={`Fortschritt in ${document.title}`} />

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/reader?doc=${encodeURIComponent(document.id)}`}
                        className="inline-flex h-8 items-center rounded-[8px] bg-[var(--lx-accent)] px-3 text-[13px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
                      >
                        {percent > 0.001 ? 'Fortsetzen' : 'Lesen'}
                      </Link>

                      {confirming === document.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => void remove(document.id)}
                          >
                            Wirklich löschen
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                            Abbrechen
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`${document.title} löschen`}
                          onClick={() => setConfirming(document.id)}
                        >
                          <TrashIcon width={15} height={15} />
                          Löschen
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-10">
          <DataTransfer onChanged={load} />
        </div>
      </main>
    </>
  );
}
