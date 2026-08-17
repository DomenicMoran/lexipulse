import type { DocumentChapter, ImportReport, LexiDocument } from '../types.js';

/** Stable-ish id without a uuid dependency: source + slug + time + entropy. */
export function createDocumentId(source: string, title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${source}_${slug || 'doc'}_${stamp}${rand}`;
}

/** Whitespace-delimited word count — the number shown in the library. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export interface FinalizeInput {
  id: string;
  title: string;
  author: string | null;
  source: LexiDocument['source'];
  origin: string | null;
  language: string | null;
  chapters: DocumentChapter[];
  coverDataUrl: string | null;
  importReport: ImportReport;
  pageWordStarts?: number[] | null;
}

/**
 * Fill in the derived fields every parser shares.
 * `startToken` / `tokenCount` stay 0 here — they are settings-dependent and get written
 * by `tokenizeChapters` once the reader knows the user's pacing.
 */
export function finalizeDocument(input: FinalizeInput): LexiDocument {
  let wordCount = 0;
  for (const chapter of input.chapters) {
    chapter.text = chapter.text.replace(/\n{3,}/g, '\n\n').trim();
    wordCount += countWords(chapter.text);
  }
  const now = Date.now();
  return {
    ...input,
    title: input.title.trim().slice(0, 200) || 'Untitled',
    author: input.author?.trim().slice(0, 160) || null,
    totalTokens: wordCount,
    wordCount,
    createdAt: now,
    updatedAt: now,
  };
}

/** Split a long flat text into pseudo-chapters so the reader gets a usable outline. */
export function chunkIntoChapters(
  text: string,
  targetWords = 1200,
  titlePrefix = 'Section',
): DocumentChapter[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return [];

  const chapters: DocumentChapter[] = [];
  let buffer: string[] = [];
  let words = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const body = buffer.join('\n\n');
    const first = (buffer[0] as string).replace(/\s+/g, ' ').trim();
    const heading = first.length <= 80 && !/[.!?]$/.test(first) ? first : null;
    chapters.push({
      id: `chunk-${chapters.length}`,
      title: heading ?? `${titlePrefix} ${chapters.length + 1}`,
      text: body,
      startToken: 0,
      tokenCount: 0,
    });
    buffer = [];
    words = 0;
  };

  for (const paragraph of paragraphs) {
    buffer.push(paragraph.trim());
    words += countWords(paragraph);
    if (words >= targetWords) flush();
  }
  flush();

  return chapters;
}

export function emptyImportReport(source: LexiDocument['source']): ImportReport {
  return {
    source,
    rawSections: 0,
    removed: { headers: 0, footers: 0, pageNumbers: 0, tableRows: 0, artifacts: 0 },
    dehyphenated: 0,
    notes: [],
    durationMs: 0,
  };
}
