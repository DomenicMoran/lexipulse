import { importDocument, parseText, type ImportReport, type LexiDocument } from '@lexipulse/core';
import { loadPdf } from './pdf-loader';
import { formatNumber } from './format';

/** Hard ceiling for a single file. Past this the browser tab, not the parser, is the limit. */
export const MAX_FILE_BYTES = 80 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = '.epub,.pdf,.txt,.md,.markdown,.html,.htm,.xhtml';

export interface ImportProgress {
  /** What is happening right now, already in German. */
  label: string;
  /** 0–1 when known, null while the step has no measurable progress. */
  percent: number | null;
}

export type ProgressHandler = (progress: ImportProgress) => void;

export async function importFromFile(
  file: File,
  onProgress: ProgressHandler,
): Promise<LexiDocument> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Die Datei ist zu groß (${Math.round(file.size / 1024 / 1024)} MB). Das Maximum liegt bei 80 MB.`,
    );
  }

  onProgress({ label: 'Datei wird gelesen', percent: null });
  const bytes = new Uint8Array(await file.arrayBuffer());

  onProgress({ label: 'Text wird ausgelesen', percent: null });
  return importDocument(bytes, {
    fileName: file.name,
    pdf: {
      loader: loadPdf,
      onProgress: (page, total) =>
        onProgress({
          label: `Seite ${formatNumber(page)} von ${formatNumber(total)}`,
          percent: total > 0 ? page / total : null,
        }),
    },
  });
}

export function importFromText(text: string): LexiDocument {
  if (text.trim().length === 0) throw new Error('Der eingefügte Text ist leer.');
  return parseText(text, { source: 'clipboard', origin: null });
}

interface ExtractResponse {
  document?: LexiDocument;
  error?: string;
}

export async function importFromUrl(url: string, onProgress: ProgressHandler): Promise<LexiDocument> {
  onProgress({ label: 'Seite wird abgerufen', percent: null });

  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const payload = (await response.json().catch(() => ({}))) as ExtractResponse;
  if (!response.ok || !payload.document) {
    throw new Error(payload.error ?? 'Die Seite konnte nicht geladen werden.');
  }
  return payload.document;
}

/**
 * The import report in German, built from the structured counters rather than from the
 * `notes` array — those are English and meant for developers.
 */
export function describeReport(report: ImportReport): string[] {
  const lines: string[] = [];
  const { headers, footers, pageNumbers, tableRows, artifacts } = report.removed;

  /** German counts need the singular form; "1 Abschnitte" reads like a bug. */
  const count = (value: number, singular: string, plural: string): string =>
    `${formatNumber(value)} ${value === 1 ? singular : plural}`;

  if (report.source === 'pdf') {
    lines.push(`${count(report.rawSections, 'Seite', 'Seiten')} verarbeitet`);
  } else if (report.rawSections > 0) {
    lines.push(`${count(report.rawSections, 'Abschnitt', 'Abschnitte')} erkannt`);
  }

  const running = headers + footers;
  if (running > 0) lines.push(`${count(running, 'Kopf- oder Fußzeile', 'Kopf- und Fußzeilen')} entfernt`);
  if (pageNumbers > 0) lines.push(`${count(pageNumbers, 'Seitenzahl', 'Seitenzahlen')} entfernt`);
  if (tableRows > 0) lines.push(`${count(tableRows, 'Tabellenzeile', 'Tabellenzeilen')} entfernt`);
  if (artifacts > 0) lines.push(`${count(artifacts, 'Layout-Rest', 'Layout-Reste')} entfernt`);
  if (report.dehyphenated > 0) {
    lines.push(`${count(report.dehyphenated, 'getrenntes Wort', 'getrennte Wörter')} zusammengefügt`);
  }
  if (lines.length <= 1) lines.push('Keine Störzeilen gefunden — der Text war bereits sauber.');

  lines.push(`Verarbeitet in ${formatNumber(report.durationMs)} ms`);
  return lines;
}
