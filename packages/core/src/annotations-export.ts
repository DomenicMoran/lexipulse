/**
 * Highlights as Markdown, for taking out of the app.
 *
 * The JSON export already carries everything, but it is a backup: it exists so a reader
 * can move their library, not so they can read it. Someone who marked thirty passages in
 * a paper wants those passages in a note, an essay or a message, and that means a format
 * a person reads rather than a format a program restores.
 *
 * Pure and free of storage: the caller supplies what it already holds, which keeps this
 * usable from the app, the web version and a test alike.
 */
import type { Annotation, LexiDocument } from './types.js';

/** Colour names as they appear in the app, so an export matches what was on screen. */
const COLOR_LABELS: Record<Annotation['color'], { de: string; en: string }> = {
  yellow: { de: 'Gelb', en: 'Yellow' },
  green: { de: 'Grün', en: 'Green' },
  blue: { de: 'Blau', en: 'Blue' },
  pink: { de: 'Rosa', en: 'Pink' },
  purple: { de: 'Lila', en: 'Purple' },
};

export interface HighlightExportOptions {
  language?: 'de' | 'en';
  /** Chapter titles, indexed as `Annotation.chapterIndex`. Missing ones get a number. */
  chapterTitles?: readonly string[];
  /** Stamped into the header. Passed in rather than read, so the output is testable. */
  exportedAt?: number;
}

/**
 * Blockquote a passage.
 *
 * Every line needs its own marker, otherwise a highlight spanning a paragraph break ends
 * the quote halfway and the rest lands as body text.
 */
function quote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line.trim()}`.trimEnd())
    .join('\n');
}

export function highlightsToMarkdown(
  document: Pick<LexiDocument, 'title' | 'author' | 'chapters'>,
  annotations: readonly Annotation[],
  options: HighlightExportOptions = {},
): string {
  const { language = 'de', exportedAt } = options;
  const de = language === 'de';

  const titles =
    options.chapterTitles ?? document.chapters.map((chapter, index) => chapter.title || `${index + 1}`);

  const lines: string[] = [`# ${document.title}`];
  if (document.author) lines.push('', `*${document.author}*`);

  if (annotations.length === 0) {
    lines.push('', de ? 'Keine Markierungen.' : 'No highlights.');
    return `${lines.join('\n')}\n`;
  }

  // Reading order, not the order they were made: an export is read like the book.
  const sorted = [...annotations].sort(
    (a, b) => a.chapterIndex - b.chapterIndex || a.startToken - b.startToken,
  );

  const count = sorted.length;
  lines.push(
    '',
    de
      ? `${count} ${count === 1 ? 'Markierung' : 'Markierungen'}`
      : `${count} ${count === 1 ? 'highlight' : 'highlights'}`,
  );

  let openChapter: number | null = null;
  for (const annotation of sorted) {
    if (annotation.chapterIndex !== openChapter) {
      openChapter = annotation.chapterIndex;
      const title = titles[annotation.chapterIndex] ?? `${annotation.chapterIndex + 1}`;
      lines.push('', `## ${title}`);
    }
    lines.push('', quote(annotation.text));
    const colour = COLOR_LABELS[annotation.color][language];
    lines.push('', `*${de ? 'Farbe' : 'Colour'}: ${colour}*`);
    if (annotation.note) lines.push('', `**${de ? 'Notiz' : 'Note'}:** ${annotation.note}`);
  }

  if (exportedAt !== undefined) {
    const stamp = new Date(exportedAt).toISOString().slice(0, 10);
    lines.push('', '---', '', de ? `Exportiert am ${stamp} mit LexiPulse` : `Exported ${stamp} with LexiPulse`);
  }

  return `${lines.join('\n')}\n`;
}

/** A file name that survives every file system the export can land on. */
export function highlightsFileName(title: string): string {
  const slug =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'markierungen';
  return `${slug}-markierungen.md`;
}
