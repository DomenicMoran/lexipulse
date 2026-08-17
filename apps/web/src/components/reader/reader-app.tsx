'use client';

import {
  pageTokenStarts,
  tokenForPage,
  tokenizeChapters,
  type LexiDocument,
  type LibraryEntry,
  type RsvpToken,
} from '@lexipulse/core';
import { Button } from '@lexipulse/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { ArrowRightIcon, CloseIcon, SettingsIcon } from '@/components/icons';
import { useSettings } from '@/components/settings-provider';
import { ImportPanel } from '@/components/reader/import-panel';
import { Player } from '@/components/reader/player';
import { ReaderNav } from '@/components/reader/reader-nav';
import { SettingsSheet } from '@/components/reader/settings-sheet';
import { ShortcutsOverlay } from '@/components/reader/shortcuts-overlay';
import { formatNumber, formatPercent, SOURCE_LABELS } from '@/lib/format';
import { describeReport } from '@/lib/import';
import { getStore } from '@/lib/store';

interface LoadedDocument {
  document: LexiDocument;
  tokens: RsvpToken[];
  startIndex: number;
  msRead: number;
  firstOpen: boolean;
}

type Sheet = 'none' | 'settings' | 'help';

export function ReaderApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('doc');
  /** Set when the reader came back from the original surface: open where they left it. */
  const fromPage = searchParams.get('page');
  const { settings, hydrated } = useSettings();

  // Tokenising uses the current speed, but a later speed change must not rebuild the
  // stream — the engine re-paces the existing tokens in place.
  // Written in an effect, never in the render body: assigning to `ref.current` while
  // rendering is a rules-of-React violation, because React may discard a render and the
  // ref would keep a value from a pass that never reached the screen.
  const wpmRef = React.useRef(settings.wpm);
  React.useEffect(() => {
    wpmRef.current = settings.wpm;
  }, [settings.wpm]);

  const [loaded, setLoaded] = React.useState<LoadedDocument | null>(null);
  const [recent, setRecent] = React.useState<LibraryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<{ title: string; lines: string[] } | null>(null);
  const [sheet, setSheet] = React.useState<Sheet>('none');
  const [toast, setToast] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const store = await getStore();

        if (documentId) {
          const document = await store.getDocument(documentId);
          if (document) {
            const progress = await store.getProgress(documentId);
            const tokens = tokenizeChapters(document.chapters, { wpm: wpmRef.current });
            if (cancelled) return;

            /*
             * A scan has pages but no words. The word stream would be an empty screen with
             * a dead play button, so the reader is taken to the surface that can actually
             * show the document — once, and only when there is one.
             */
            if (tokens.length === 0 && document.original) {
              router.replace(`/reader/original?doc=${encodeURIComponent(document.id)}&page=1`);
              return;
            }

            const requestedPage = fromPage === null ? null : Number.parseInt(fromPage, 10);
            const startIndex =
              requestedPage !== null && Number.isFinite(requestedPage)
                ? tokenForPage(pageTokenStarts(document, tokens), requestedPage)
                : (progress?.tokenIndex ?? 0);

            setLoaded({
              document,
              tokens,
              startIndex,
              msRead: progress?.msRead ?? 0,
              firstOpen: progress === null,
            });
            setLoading(false);
            return;
          }
          if (!cancelled) setError('Dieses Dokument liegt nicht mehr in Ihrer Bibliothek.');
        }

        const library = await store.listLibrary();
        if (cancelled) return;
        setRecent(library.slice(0, 4));
        setLoaded(null);
      } catch {
        if (!cancelled) setError('Der lokale Speicher ist nicht verfügbar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, fromPage, hydrated, router]);

  React.useEffect(() => {
    if (sheet === 'none') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet('none');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheet]);

  React.useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleImported = React.useCallback(
    async (document: LexiDocument) => {
      const store = await getStore();
      await store.saveDocument(document);
      setReport({ title: document.title, lines: describeReport(document.importReport) });
      setError(null);
      router.replace(`/reader?doc=${encodeURIComponent(document.id)}`);
    },
    [router],
  );

  /*
   * Marker for the store-screenshot driver. It photographs the running app instead of a
   * rebuilt mock, but only when a screen identifies itself. Exactly one element carries
   * the attribute at a time: the settings sheet takes it over while it is open, so the
   * driver never has to guess which of two visible surfaces it is looking at.
   */
  const screen: string | undefined =
    sheet === 'settings'
      ? undefined
      : report
        ? '03-filter'
        : loaded
          ? '01-player'
          : '02-import';

  return (
    <>
      <ReaderNav>
        <button
          type="button"
          onClick={() => setSheet('settings')}
          aria-label="Einstellungen öffnen"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--lx-border)] text-[var(--lx-text-muted)] transition-colors duration-140 hover:bg-[var(--lx-surface-hover)] hover:text-[var(--lx-text)]"
        >
          <SettingsIcon />
        </button>
      </ReaderNav>

      <main
        id="inhalt"
        data-lexipulse-screen={screen}
        className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-12"
      >
        {error && (
          <p
            role="alert"
            className="mb-6 rounded-[10px] border border-[var(--lx-border-strong)] px-4 py-3 text-[14px] text-[var(--lx-text-muted)]"
          >
            {error}
          </p>
        )}

        {report && (
          <div className="mb-8 rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-semibold">Import abgeschlossen</h2>
                <p className="mt-0.5 text-[14px] text-[var(--lx-text-muted)]">{report.title}</p>
              </div>
              <button
                type="button"
                aria-label="Import-Bericht schließen"
                onClick={() => setReport(null)}
                className="rounded-[6px] p-1 text-[var(--lx-text-muted)] transition-colors duration-140 hover:text-[var(--lx-text)]"
              >
                <CloseIcon width={16} height={16} />
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              {report.lines.map((line) => (
                <li
                  key={line}
                  className="flex items-center gap-2 text-[13px] text-[var(--lx-text-muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="block h-1 w-1 rounded-full bg-[var(--lx-accent)]"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading && (
          <p className="py-20 text-center text-[15px] text-[var(--lx-text-muted)]">Wird geladen…</p>
        )}

        {!loading && loaded && (
          <Player
            key={loaded.document.id}
            document={loaded.document}
            tokens={loaded.tokens}
            startIndex={loaded.startIndex}
            initialMsRead={loaded.msRead}
            firstOpen={loaded.firstOpen}
            onOpenSettings={() => setSheet('settings')}
            onOpenHelp={() => setSheet('help')}
            onBookmarked={() => setToast('Lesezeichen gesetzt')}
          />
        )}

        {!loading && !loaded && (
          <div className="flex flex-col gap-8">
            <ImportPanel onImported={handleImported} />

            {recent.length > 0 && (
              <section>
                <h2 className="mb-3 text-[15px] font-semibold">Zuletzt geöffnet</h2>
                <ul className="flex flex-col gap-2">
                  {recent.map((entry) => (
                    <li key={entry.document.id}>
                      <Link
                        href={`/reader?doc=${encodeURIComponent(entry.document.id)}`}
                        className="flex items-center justify-between gap-4 rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-4 py-3 transition-colors duration-140 hover:border-[var(--lx-border-strong)] hover:bg-[var(--lx-surface-hover)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] text-[var(--lx-text)]">
                            {entry.document.title}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-[var(--lx-text-muted)]">
                            {SOURCE_LABELS[entry.document.source] ?? entry.document.source} ·{' '}
                            {formatNumber(entry.document.wordCount)} Wörter ·{' '}
                            {entry.progress ? formatPercent(entry.progress.percent) : 'neu'}
                          </span>
                        </span>
                        <ArrowRightIcon className="shrink-0 text-[var(--lx-text-muted)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4"
                  variant="ghost"
                  onClick={() => router.push('/reader/library')}
                >
                  Ganze Bibliothek
                </Button>
              </section>
            )}

            <p className="text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
              Dokumente, Lesefortschritt und Lesezeichen liegen in der Datenbank Ihres
              Browsers. Sie verlassen dieses Gerät nicht — und sind weg, wenn Sie die
              Website-Daten löschen. In der Bibliothek können Sie alles als Datei sichern.
            </p>
          </div>
        )}
      </main>

      {sheet === 'settings' && <SettingsSheet onClose={() => setSheet('none')} />}
      {sheet === 'help' && <ShortcutsOverlay onClose={() => setSheet('none')} />}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[10px] border border-[var(--lx-border-strong)] bg-[var(--lx-surface)] px-4 py-2 text-[14px] text-[var(--lx-text)] shadow-[0_4px_16px_rgba(0,0,0,0.28)]"
        >
          {toast}
        </div>
      )}
    </>
  );
}
