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
  const chapters = chunkIntoChapters(cleaned.text, chapterWords, 'Section');

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
      notes: [`${chapters.length} sections`],
      durationMs: Date.now() - started,
    },
  });
}
