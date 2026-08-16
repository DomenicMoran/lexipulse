'use client';

import { normalizeSettings } from '@lexipulse/core';
import { Button } from '@lexipulse/ui';
import * as React from 'react';
import { DownloadIcon, UploadIcon } from '@/components/icons';
import { useSettings } from '@/components/settings-provider';
import { getStore } from '@/lib/store';

/**
 * Export and re-import of everything stored locally.
 *
 * The privacy policy promises this under Art. 20 DSGVO, so it has to be a working
 * round trip, not a button that produces a file nothing can read back. The export is
 * exactly what `LexiStore.exportAll()` writes and `importAll()` accepts.
 */
export function DataTransfer({ onChanged }: { onChanged: () => void }) {
  const { replace } = useSettings();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
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
      setMessage(`Export erstellt (${Math.max(1, Math.round(json.length / 1024))} KB).`);
    } catch {
      setError('Der Export ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const importAll = async (file: File) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const json = await file.text();
      const store = await getStore();
      const result = await store.importAll(json);
      const settings = await store.getSettings();
      replace(normalizeSettings(settings));
      const plural = (value: number, one: string, many: string) =>
        `${value} ${value === 1 ? one : many}`;
      // Every kind the export carries is named here. Reporting only documents and
      // bookmarks made a complete import look partial, and the file is meant to be a
      // complete backup. Empty kinds are dropped so the sentence stays short.
      const parts = [
        plural(result.documents, 'Dokument', 'Dokumente'),
        result.bookmarks > 0 ? plural(result.bookmarks, 'Lesezeichen', 'Lesezeichen') : null,
        result.annotations > 0
          ? plural(result.annotations, 'Markierung', 'Markierungen')
          : null,
        result.tags > 0 ? plural(result.tags, 'Schlagwort', 'Schlagwörter') : null,
      ].filter((part): part is string => part !== null);
      const listed =
        parts.length === 1
          ? parts[0]
          : `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`;
      setMessage(`${listed} eingespielt.`);
      onChanged();
    } catch {
      setError('Die Datei konnte nicht gelesen werden. Erwartet wird ein LexiPulse-Export.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-5 sm:p-6">
      <h2 className="text-[17px] font-semibold tracking-[-0.015em]">Meine Daten</h2>
      <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-[var(--lx-text-muted)]">
        Bibliothek, Lesefortschritt, Lesezeichen, Einstellungen und Statistik als
        JSON-Datei. Der Export läuft vollständig auf Ihrem Gerät; nichts wird übertragen.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void exportAll()}>
          <DownloadIcon width={16} height={16} />
          Meine Daten exportieren
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void importAll(file);
          }}
        />
        <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <UploadIcon width={16} height={16} />
          Export wieder einspielen
        </Button>
      </div>

      {message && (
        <p className="mt-4 text-[14px] text-[var(--lx-text)]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 text-[14px] text-[var(--lx-danger)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
