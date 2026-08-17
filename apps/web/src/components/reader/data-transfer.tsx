'use client';

import {
  SCHEMA_VERSION,
  inspectBackup,
  normalizeSettings,
  type BackupSummary,
  type ImportMode,
  type ImportResult,
} from '@lexipulse/core';
import { Button, SegmentedControl } from '@lexipulse/ui';
import * as React from 'react';
import { DownloadIcon, UploadIcon } from '@/components/icons';
import { useSettings } from '@/components/settings-provider';
import { formatDateTime } from '@/lib/format';
import { getStore } from '@/lib/store';

/** German plural without a library: only the two forms this file needs. */
function plural(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** "a, b und c", so the report reads as a sentence rather than a list of fragments. */
function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`;
}

/**
 * What the overview says a backup holds.
 *
 * Only what is actually in the file is listed. A line reading "0 Markierungen" tells the
 * reader nothing and makes an empty backup look richer than it is.
 */
function summaryLines(summary: BackupSummary): string[] {
  const lines = [plural(summary.documents, 'Dokument', 'Dokumente')];
  if (summary.bookmarks > 0) lines.push(plural(summary.bookmarks, 'Lesezeichen', 'Lesezeichen'));
  if (summary.annotations > 0) {
    lines.push(plural(summary.annotations, 'Markierung', 'Markierungen'));
  }
  if (summary.tags > 0) {
    lines.push(`${plural(summary.tags, 'Dokument', 'Dokumente')} mit Schlagwörtern`);
  }
  if (summary.hasSettings) lines.push('Einstellungen');
  if (summary.hasStats) lines.push('Lesestatistik');
  return lines;
}

/**
 * The report after an import: numbers, not the word "erfolgreich".
 *
 * Merging is the one case where nothing visible may happen, because everything in the file
 * was already here. Saying so is the point of the report; "eingespielt" would leave the
 * reader wondering whether the library just doubled behind their back.
 */
function reportText(result: ImportResult): string {
  if (result.mode === 'replace') {
    const parts = [plural(result.documentsAdded, 'Dokument', 'Dokumente')];
    if (result.bookmarksAdded > 0) {
      parts.push(plural(result.bookmarksAdded, 'Lesezeichen', 'Lesezeichen'));
    }
    if (result.annotationsAdded > 0) {
      parts.push(plural(result.annotationsAdded, 'Markierung', 'Markierungen'));
    }
    if (result.progressUpdated > 0) {
      parts.push(plural(result.progressUpdated, 'Leseposition', 'Lesepositionen'));
    }
    return `Alles ersetzt. Hergestellt wurde der Stand der Datei: ${joinParts(parts)}.`;
  }

  const parts: string[] = [];
  parts.push(
    result.documentsAdded > 0
      ? `${plural(result.documentsAdded, 'Dokument', 'Dokumente')} neu`
      : 'kein neues Dokument',
  );
  if (result.documentsMatched > 0) {
    parts.push(
      result.documentsMatched === 1 ? '1 war schon da' : `${result.documentsMatched} waren schon da`,
    );
  }
  if (result.bookmarksAdded > 0) {
    parts.push(`${plural(result.bookmarksAdded, 'Lesezeichen', 'Lesezeichen')} neu`);
  }
  if (result.annotationsAdded > 0) {
    parts.push(`${plural(result.annotationsAdded, 'Markierung', 'Markierungen')} neu`);
  }
  if (result.tagsUpdated > 0) {
    parts.push(`${plural(result.tagsUpdated, 'Dokument', 'Dokumente')} mit Schlagwörtern`);
  }
  if (result.progressUpdated > 0) {
    parts.push(`${plural(result.progressUpdated, 'Leseposition', 'Lesepositionen')} übernommen`);
  }
  if (result.progressKept > 0) {
    parts.push(
      result.progressKept === 1
        ? '1 Leseposition behalten, weil sie neuer war'
        : `${result.progressKept} Lesepositionen behalten, weil sie neuer waren`,
    );
  }
  return `Zusammengeführt: ${parts.join(', ')}.`;
}

/** A backup that has been read but not applied yet. */
interface Pending {
  json: string;
  fileName: string;
  summary: BackupSummary;
  /** Documents on this device, so "Alles ersetzen" can name what it throws away. */
  localDocuments: number;
}

/**
 * Export and re-import of everything stored locally.
 *
 * The privacy policy promises this under Art. 20 DSGVO, so it has to be a working
 * round trip, not a button that produces a file nothing can read back. The export is
 * exactly what `LexiStore.exportAll()` writes and `importAll()` accepts.
 *
 * Reading a backup is never done in one click. The file is inspected first and its
 * contents are shown, because the two modes are opposites: merging keeps everything,
 * replacing throws the library away. Nobody can choose between them without seeing what
 * is in the file, and a wrong guess here costs the reader their books.
 */
export function DataTransfer({ onChanged }: { onChanged: () => void }) {
  const { replace } = useSettings();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [mode, setMode] = React.useState<ImportMode>('merge');
  const [confirmingReplace, setConfirmingReplace] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const exportAll = async () => {
    setBusy(true);
    setError(null);
    try {
      const store = await getStore();
      const json = await store.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `lexipulse-export-${stamp}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Revoking immediately would race the download in Safari.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(`Sicherung erstellt (${Math.max(1, Math.round(json.length / 1024))} KB).`);
    } catch {
      setError('Die Sicherung konnte nicht erstellt werden.');
    } finally {
      setBusy(false);
    }
  };

  /** Read and check a chosen file. Nothing is written to the store here. */
  const inspect = async (file: File) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setPending(null);
    setConfirmingReplace(false);
    setMode('merge');
    try {
      const json = await file.text();
      const summary = inspectBackup(json, SCHEMA_VERSION);
      if (summary === 'unreadable') {
        setError(
          `„${file.name}“ ist keine LexiPulse-Sicherung. Erwartet wird die JSON-Datei aus „Sicherung herunterladen“.`,
        );
        return;
      }
      if (summary === 'too-new') {
        setError(
          'Diese Sicherung stammt aus einer neueren Fassung von LexiPulse. Bitte laden Sie diese Seite neu, damit die aktuelle Fassung geladen wird, und versuchen Sie es erneut.',
        );
        return;
      }
      const store = await getStore();
      const local = await store.listDocuments();
      setPending({ json, fileName: file.name, summary, localDocuments: local.length });
    } catch {
      setError('Die Datei konnte nicht gelesen werden.');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (chosen: ImportMode) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const store = await getStore();
      const result = await store.importAll(pending.json, { mode: chosen });
      // Replacing brings the file's settings along, merging deliberately keeps the local
      // ones. Reading them back covers both without the component having to know which.
      const settings = await store.getSettings();
      replace(normalizeSettings(settings));
      setPending(null);
      setConfirmingReplace(false);
      setMessage(reportText(result));
      // The library above this section holds its own copy of the entries and the tag
      // index. Without this it would keep showing the state from before the import.
      onChanged();
    } catch {
      setError('Das Einlesen ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setPending(null);
    setConfirmingReplace(false);
    setError(null);
  };

  const exportedAt =
    pending?.summary.exportedAt != null ? Date.parse(pending.summary.exportedAt) : Number.NaN;

  return (
    <section className="rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5 sm:p-6">
      <h2 className="text-[17px] font-semibold tracking-[-0.015em]">Meine Daten</h2>
      <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-[var(--lx-text-muted)]">
        Bibliothek, Lesefortschritt, Lesezeichen, Markierungen, Einstellungen und Statistik als
        JSON-Datei. Alles läuft vollständig auf Ihrem Gerät; nichts wird übertragen. Die Datei
        enthält Ihre Dokumente im Volltext und gehört deshalb an einen sicheren Ort.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void exportAll()}>
          <DownloadIcon width={16} height={16} />
          Sicherung herunterladen
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Sicherungsdatei auswählen"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared right away so choosing the same file twice fires a change event again.
            event.target.value = '';
            if (file) void inspect(file);
          }}
        />
        <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <UploadIcon width={16} height={16} />
          Sicherung einlesen
        </Button>
      </div>

      {pending && (
        <div className="mt-5 rounded-[12px] border border-[var(--lx-border)] bg-[var(--lx-bg)] p-4">
          <h3 className="text-[15px] font-medium">Das steht in dieser Sicherung</h3>
          <p className="mt-1 text-[13px] text-[var(--lx-text-muted)]">{pending.fileName}</p>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-[var(--lx-text)]">
            {summaryLines(pending.summary).map((line) => (
              <li key={line} className="tabular-nums">
                {line}
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
            {Number.isNaN(exportedAt)
              ? 'Ohne Datum gespeichert.'
              : `Erstellt am ${formatDateTime(exportedAt)}.`}
            {pending.summary.sampleTitles.length > 0 && (
              <> Darin unter anderem: {pending.summary.sampleTitles.join(', ')}.</>
            )}
          </p>

          <div className="mt-4">
            <SegmentedControl
              label="Wie soll eingelesen werden?"
              value={mode}
              options={[
                { value: 'merge', label: 'Zusammenführen' },
                { value: 'replace', label: 'Alles ersetzen' },
              ]}
              onValueChange={(next) => {
                setMode(next);
                // Switching away and back must not keep a confirmation that was already
                // given for the previous choice.
                setConfirmingReplace(false);
              }}
            />
            <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
              {mode === 'merge'
                ? 'Nichts geht verloren. Dokumente, die schon hier sind, werden am Inhalt erkannt und nicht doppelt angelegt. Bei der Leseposition gewinnt die neuere. Ihre Einstellungen auf diesem Gerät bleiben, wie sie sind.'
                : 'Ihre Bibliothek auf diesem Gerät wird gelöscht und durch den Stand der Datei ersetzt. Auch Einstellungen und Statistik werden überschrieben. Das ist für ein neues Gerät gedacht.'}
            </p>
          </div>

          {mode === 'replace' && confirmingReplace && (
            <p
              className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-[var(--lx-danger)]"
              role="alert"
            >
              {pending.localDocuments === 0
                ? 'Hier ist noch nichts gespeichert, es geht also nichts verloren. Einstellungen und Statistik werden trotzdem überschrieben.'
                : `${plural(pending.localDocuments, 'Dokument', 'Dokumente')} auf diesem Gerät werden gelöscht, dazu Lesefortschritt, Lesezeichen und Markierungen. Das lässt sich nicht rückgängig machen.`}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {mode === 'merge' ? (
              <Button size="sm" disabled={busy} onClick={() => void runImport('merge')}>
                Zusammenführen
              </Button>
            ) : confirmingReplace ? (
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => void runImport('replace')}
              >
                Ja, alles ersetzen
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => setConfirmingReplace(true)}
              >
                Alles ersetzen
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={cancel}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-4 text-[14px] text-[var(--lx-text)]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-[var(--lx-danger)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
