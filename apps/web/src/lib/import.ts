import { importDocument, parseText, type ImportReport, type LexiDocument } from '@lexipulse/core';
import { loadPdf } from './pdf-loader';
import { formatNumber } from './format';
import { getStore } from './store';

/** Hard ceiling for a single file. Past this the browser tab, not the parser, is the limit. */
export const MAX_FILE_BYTES = 80 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS =
  '.epub,.fb2,.pdf,.txt,.md,.markdown,.html,.htm,.xhtml,.png,.jpg,.jpeg,.webp';

/** Pictures the app turns into a PDF before importing them. */
export const IMAGE_TYPES = /^image\/(png|jpeg|webp)$/;

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
  const document = await importDocument(bytes, {
    fileName: file.name,
    pdf: {
      loader: loadPdf,
      /*
       * A PDF with no text layer is still a document.
       *
       * Refusing it was right while the only thing the app could do with a PDF was read
       * words out of it. Now the page itself can be shown, marked up and signed, so a
       * scan or a photographed contract comes in — with no words, which the reader is
       * told rather than left to discover.
       */
      allowEmptyText: true,
      onProgress: (page, total) =>
        onProgress({
          label: `Seite ${formatNumber(page)} von ${formatNumber(total)}`,
          percent: total > 0 ? page / total : null,
        }),
    },
  });

  if (!KEEP_ORIGINAL.has(document.source)) return document;

  onProgress({ label: 'Original wird abgelegt', percent: null });
  try {
    /*
     * Read from the file a second time rather than reuse `bytes`.
     *
     * pdf.js transfers the array it is handed to its worker thread, which leaves the
     * buffer on this side detached — reading it afterwards throws. Copying it before the
     * parse would mean holding the whole document twice in memory for the length of the
     * parse; re-reading costs one more pass over a file that is still in the page cache.
     */
    const store = await getStore();
    const pristine = new Uint8Array(await file.arrayBuffer());
    const original = await store.putOriginal(document.id, pristine, {
      mime: file.type || MIME_BY_SOURCE[document.source] || 'application/octet-stream',
      fileName: file.name,
      pageCount: document.source === 'pdf' ? document.importReport.rawSections : null,
    });
    return original ? { ...document, original } : document;
  } catch {
    // Out of quota, or a browser that refuses the file store. The text is already parsed
    // and worth keeping — the reader loses the original page, not the document.
    return document;
  }
}

/**
 * Sources whose original file is worth keeping.
 *
 * PDF because the page *is* the document: its figures, tables, forms and signature lines
 * have no representation in extracted text. Nothing else qualifies yet — a text file
 * loses nothing on the way in, and keeping a second copy of every EPUB would double what
 * the library costs for no surface that could show it.
 */
const KEEP_ORIGINAL = new Set<LexiDocument['source']>(['pdf']);

const MIME_BY_SOURCE: Partial<Record<LexiDocument['source'], string>> = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  fb2: 'application/x-fictionbook+xml',
};

/**
 * Photographs and scans, turned into one PDF and imported as such.
 *
 * The everyday case this exists for: a contract on the kitchen table, three pictures on a
 * phone, and something that has to be signed and sent back. Building a PDF out of them
 * first means everything downstream — the viewer, the signature, the export — is the one
 * path that already works, rather than a second kind of document to maintain.
 */
export async function importFromImages(
  files: readonly File[],
  onProgress: ProgressHandler,
): Promise<LexiDocument> {
  if (files.length === 0) throw new Error('Es wurde kein Bild ausgewählt.');

  onProgress({ label: 'Bilder werden gelesen', percent: null });
  const pictures: { bytes: Uint8Array; mime: string }[] = [];
  for (const file of files) {
    if (!IMAGE_TYPES.test(file.type)) {
      throw new Error(`${file.name} ist kein PNG, JPEG oder WebP.`);
    }
    pictures.push({ bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type });
  }

  onProgress({ label: 'PDF wird gebaut', percent: null });
  const { imagesToPdf } = await import('./pdf-export');
  const bytes = await imagesToPdf(pictures);

  const name =
    files.length === 1
      ? (files[0] as File).name.replace(/\.[a-z0-9]+$/i, '')
      : `${files.length} Bilder`;

  return importFromFile(new File([bytes.slice().buffer as ArrayBuffer], `${name}.pdf`, {
    type: 'application/pdf',
  }), onProgress);
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
    if (report.notes.includes('no text layer — pages only')) {
      lines.push('Kein Textlayer — Seiten ja, Wortstrom und Suche nein');
      lines.push(`Verarbeitet in ${formatNumber(report.durationMs)} ms`);
      return lines;
    }
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
