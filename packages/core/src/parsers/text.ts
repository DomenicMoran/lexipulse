import type { LexiDocument } from '../types.js';
import { cleanFlowText } from './clean.js';
import { chunkIntoChapters, createDocumentId, finalizeDocument } from './shared.js';

export interface TextParseOptions {
  title?: string;
  author?: string | null;
  origin?: string | null;
  language?: string | null;
  chapterWords?: number;
  source?: 'text' | 'markdown' | 'clipboard';
}

/** Strip Markdown syntax down to the prose the reader actually needs. */
export function markdownToText(markdown: string): string {
  return (
    markdown
      // Fenced code blocks carry no prose value in an RSVP stream.
      .replace(/```[\s\S]*?```/g, '\n\n')
      .replace(/~~~[\s\S]*?~~~/g, '\n\n')
      // Images before links, so alt text does not survive as a caption.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}([-*_])\s*\1\s*\1[\s*\-_]*$/gm, '\n')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/^\s{0,3}\d+\.\s+/gm, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/^\s*\|.*\|\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
  );
}

/**
 * Split Markdown at its headings, so a document that says where its chapters are gets
 * them.
 *
 * Without this a Markdown file falls back to word-count chunking, and a short book with
 * three `##` chapters arrives as one undivided "Section 1" — the chapter list empty, the
 * jump controls pointless, and the format advertised on the import screen only half kept.
 *
 * The deepest heading level that occurs more than once wins: `#` is usually the document
 * title, and cutting there would produce a single chapter again. Returns null when the
 * file has no usable structure, and the caller falls back to word count.
 */
export function splitMarkdownChapters(markdown: string): { title: string; text: string }[] | null {
  const lines = markdown.split(/\r?\n/);
  const headings = lines
    .map((line, index) => {
      const match = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      return match ? { level: match[1]!.length, title: match[2]!.trim(), index } : null;
    })
    .filter((h): h is { level: number; title: string; index: number } => h !== null);

  if (headings.length === 0) return null;

  const counts = new Map<number, number>();
  for (const h of headings) counts.set(h.level, (counts.get(h.level) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([, count]) => count > 1).map(([level]) => level);
  if (repeated.length === 0) return null;
  const level = Math.min(...repeated);

  const cuts = headings.filter((h) => h.level === level);
  const chapters: { title: string; text: string }[] = [];
  for (let i = 0; i < cuts.length; i += 1) {
    const from = cuts[i]!;
    const to = cuts[i + 1]?.index ?? lines.length;
    const body = markdownToText(lines.slice(from.index + 1, to).join('\n')).trim();
    if (body.length > 0) chapters.push({ title: from.title, text: body });
  }
  return chapters.length > 1 ? chapters : null;
}

/** Guess a title from the first heading or the first short line. */
export function inferTitle(text: string, fallback = 'Pasted Text'): string {
  const heading = /^\s{0,3}#{1,6}\s+(.+)$/m.exec(text)?.[1];
  if (heading) return heading.trim().slice(0, 160);
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine && firstLine.length <= 90 && !/[.!?]$/.test(firstLine)) {
    return firstLine.slice(0, 160);
  }
  return fallback;
}

/** Parse plain text, Markdown or clipboard content into a reader-ready document. */
export function parseText(input: string, options: TextParseOptions = {}): LexiDocument {
  const started = Date.now();
  const { source = 'text', origin = null, author = null, language = null, chapterWords = 1200 } =
    options;

  const prepared = source === 'markdown' ? markdownToText(input) : input;
  const cleaned = cleanFlowText(prepared);

  if (cleaned.text.trim().length === 0) {
    throw new Error('There is no readable text in this input.');
  }

  const title = options.title ?? inferTitle(input, source === 'clipboard' ? 'Clipboard' : 'Document');
  const structured = source === 'markdown' ? splitMarkdownChapters(input) : null;
  const chapters = structured
    ? structured.map((chapter, index) => ({
        id: `chunk-${index}`,
        title: chapter.title,
        text: cleanFlowText(chapter.text).text,
        startToken: 0,
        tokenCount: 0,
      }))
    : chunkIntoChapters(cleaned.text, chapterWords, 'Section');

  return finalizeDocument({
    id: createDocumentId(source, title),
    title,
    author,
    source,
    origin,
    language,
    chapters,
    coverDataUrl: null,
    importReport: {
      source,
      rawSections: 1,
      removed: cleaned.removed,
      dehyphenated: cleaned.dehyphenated,
      notes: [`${chapters.length} ${chapters.length === 1 ? 'section' : 'sections'}`],
      durationMs: Date.now() - started,
    },
  });
}
