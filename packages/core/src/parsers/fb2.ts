/**
 * FictionBook 2 (.fb2), the one open e-book format the reader was still missing.
 *
 * FB2 is a single XML file rather than a container, which makes it the simplest real
 * book format there is: the metadata sits in `<description>`, the text in `<body>`, and
 * images are base64 in `<binary>` elements at the end. No zip, no spine, no manifest.
 *
 * Parsed with regular expressions like the EPUB reader beside it, and for the same
 * reason: pulling in an XML parser to read six element names would cost every reader a
 * dependency for a format most of them will never open. FB2 in the wild is machine
 * written and well formed; anything that is not still lands as readable text, because
 * unknown markup is stripped rather than trusted.
 */
import type { DocumentChapter, LexiDocument } from '../types.js';
import { cleanFlowText } from './clean.js';
import { decodeEntities } from './html-text.js';
import { createDocumentId, emptyImportReport, finalizeDocument } from './shared.js';

export interface Fb2ParseOptions {
  origin?: string | null;
  /** Used when the file carries no `<book-title>`. */
  fallbackTitle?: string;
}

/**
 * The first `length` bytes read as ASCII, without going through `TextDecoder`.
 *
 * Hermes, the engine the app runs on, rejects the label `ascii` outright and throws
 * `Unknown encoding: ascii`. Node accepts it, so the test suite was perfectly happy while
 * every import on a phone failed, which is how this was found. Bytes above 127 become a
 * placeholder, which is fine because everything this is used to find is ASCII by
 * specification.
 */
export function asciiHead(bytes: Uint8Array, length: number): string {
  let out = '';
  const end = Math.min(length, bytes.length);
  for (let i = 0; i < end; i += 1) {
    const byte = bytes[i] as number;
    out += byte < 128 ? String.fromCharCode(byte) : '�';
  }
  return out;
}

/**
 * FB2 predates UTF-8 being a given, and Russian-language files are routinely
 * windows-1251. The declaration is the only thing that says so, and it is plain ASCII in
 * every encoding worth supporting, so it can be read off the head of the file before
 * committing to a decoder.
 */
export function decodeFb2(bytes: Uint8Array): string {
  const head = asciiHead(bytes, 200);
  const declared = /encoding\s*=\s*["']([\w-]+)["']/i.exec(head)?.[1]?.toLowerCase();
  if (declared && declared !== 'utf-8' && declared !== 'utf8') {
    try {
      return new TextDecoder(declared).decode(bytes);
    } catch {
      // An encoding label this runtime does not know is not worth failing the import
      // over; UTF-8 still yields readable text for the ASCII range.
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/** Text content of the first `<name>` element, with markup and entities resolved. */
function textOf(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  if (!m?.[1]) return null;
  const text = stripInline(m[1]).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

/**
 * Drop every tag but keep what it wrapped.
 *
 * FB2 marks emphasis, footnote links and stress accents inline. None of them survive
 * into a word stream, and a stray `<emphasis>` shown literally would be read aloud as a
 * word. `<empty-line/>` is the format's paragraph break and becomes one.
 */
function stripInline(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<empty-line\s*\/?>/gi, '\n\n')
      // `<v>` is a line of verse and `<subtitle>` a heading inside a section. Both are
      // block level, and dropping their tags without a break runs a whole poem into one
      // paragraph, which the stream then reads as a single endless sentence.
      .replace(/<\/(p|v|subtitle|stanza|cite|text-author)\s*>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  );
}

/** Author names are split across up to three elements and any of them may be absent. */
function authorOf(description: string): string | null {
  const block = /<author\b[^>]*>([\s\S]*?)<\/author>/i.exec(description)?.[1];
  if (!block) return null;
  const parts = ['first-name', 'middle-name', 'last-name']
    .map((tag) => textOf(block, tag))
    .filter((part): part is string => part !== null && part.length > 0);
  if (parts.length > 0) return parts.join(' ');
  return textOf(block, 'nickname');
}

/**
 * Split `<body>` at its top-level sections.
 *
 * Depth counting rather than a lazy match: FB2 nests sections for parts and subchapters,
 * and `[\s\S]*?</section>` would close the outer one at the first inner tag, cutting
 * every multi-part book after its first paragraph.
 */
function topLevelSections(body: string): string[] {
  const tagRe = /<(\/?)section\b[^>]*?(\/?)>/gi;
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(body)) !== null) {
    const closing = tag[1] === '/';
    const selfClosing = tag[2] === '/';
    if (selfClosing) continue;
    if (closing) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        out.push(body.slice(start, tag.index));
        start = -1;
      }
    } else {
      if (depth === 0) start = tagRe.lastIndex;
      depth += 1;
    }
  }
  return out;
}

/** A section's own heading, without the headings of the sections nested inside it. */
function sectionTitle(section: string): string | null {
  const nested = section.search(/<section\b/i);
  const head = nested === -1 ? section : section.slice(0, nested);
  return textOf(head, 'title');
}

function sectionText(section: string): string {
  const withoutTitles = section.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');
  return cleanFlowText(stripInline(withoutTitles)).text;
}

export function parseFb2(bytes: Uint8Array, options: Fb2ParseOptions = {}): LexiDocument {
  const xml = decodeFb2(bytes);
  if (!/<FictionBook\b/i.test(xml)) {
    throw new Error('This is not a FictionBook file.');
  }

  const description = /<description\b[^>]*>([\s\S]*?)<\/description>/i.exec(xml)?.[1] ?? '';
  const titleInfo = /<title-info\b[^>]*>([\s\S]*?)<\/title-info>/i.exec(description)?.[1] ?? description;

  const title = textOf(titleInfo, 'book-title') ?? options.fallbackTitle ?? 'Document';
  const author = authorOf(titleInfo);
  const language = textOf(titleInfo, 'lang');

  /*
   * Only the main body is text. `<body name="notes">` holds footnotes, which belong to
   * the passages that reference them, not to the end of the book as a chapter of their
   * own, and reading them aloud in sequence makes no sense.
   */
  const bodies = [...xml.matchAll(/<body\b([^>]*)>([\s\S]*?)<\/body>/gi)];
  const main = bodies.find((b) => !/name\s*=\s*["']notes["']/i.test(b[1] ?? ''));
  const body = main?.[2] ?? bodies[0]?.[2] ?? '';

  const chapters: DocumentChapter[] = [];
  const sections = topLevelSections(body);
  for (const [index, section] of sections.entries()) {
    const text = sectionText(section);
    if (text.length === 0) continue;
    chapters.push({
      id: `fb2-${index}`,
      title: sectionTitle(section) ?? `${index + 1}`,
      text,
      startToken: 0,
      tokenCount: 0,
    });
  }

  // A book with no sections at all is still a book; take the body as one chapter.
  if (chapters.length === 0) {
    const text = cleanFlowText(stripInline(body)).text;
    if (text.length === 0) throw new Error('There is no readable text in this file.');
    chapters.push({ id: 'fb2-0', title, text, startToken: 0, tokenCount: 0 });
  }

  const report = emptyImportReport('fb2');
  // Structured as well as written out: the app builds its own sentence from the number
  // so the report reads in the language of the interface.
  report.rawSections = chapters.length;
  report.notes.push(`${chapters.length} ${chapters.length === 1 ? 'section' : 'sections'}`);

  return finalizeDocument({
    id: createDocumentId('fb2', title),
    title,
    author,
    source: 'fb2',
    origin: options.origin ?? null,
    language,
    chapters,
    coverDataUrl: coverOf(xml),
    importReport: report,
  });
}

/**
 * The cover, if the book names one.
 *
 * `<coverpage>` points at a `<binary>` by id, and the binary already holds base64 with
 * its own content type, so the data URL is a matter of stitching the two together rather
 * than re-encoding anything.
 */
function coverOf(xml: string): string | null {
  const href = /<coverpage\b[^>]*>([\s\S]*?)<\/coverpage>/i
    .exec(xml)?.[1]
    ?.match(/href\s*=\s*["']#?([^"']+)["']/i)?.[1];
  if (!href) return null;

  const binary = new RegExp(
    `<binary\\b[^>]*id\\s*=\\s*["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)</binary>`,
    'i',
  ).exec(xml);
  if (!binary?.[1]) return null;

  const type =
    /content-type\s*=\s*["']([^"']+)["']/i.exec(binary[0])?.[1] ?? 'image/jpeg';
  const base64 = binary[1].replace(/\s+/g, '');
  return base64.length > 0 ? `data:${type};base64,${base64}` : null;
}
