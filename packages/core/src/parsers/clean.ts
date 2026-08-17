import type { ImportReport } from '../types.js';

/**
 * The smart filter.
 *
 * A PDF is a page description, not a document: every page repeats its running head,
 * its footer and its page number, tables arrive as space-aligned garbage, and words are
 * cut in half at the line break. Feeding that stream straight into an RSVP player is
 * what makes every other speed reader unusable on real books. This module removes it.
 */

export interface CleanOptions {
  /** How many lines from the top of a page can be a running head. */
  headerLines: number;
  /** How many lines from the bottom of a page can be a footer. */
  footerLines: number;
  /**
   * Fraction of pages a normalised line must appear on before it counts as boilerplate.
   * 0.5 catches alternating recto/verso heads without eating real repeated sentences.
   */
  repeatThreshold: number;
  /**
   * Below this page count, repetition analysis is skipped.
   *
   * Three is the floor because `minCount` never drops below 3: on a three-page document
   * a line must appear on *every* page to count as boilerplate, which no real sentence
   * does. Going lower would start eating body text on two-page exports.
   */
  minPagesForRepetition: number;
  /**
   * A running head is short by construction. Capping the candidate length keeps the
   * detector from eating a body line that legitimately repeats across pages.
   */
  maxBoilerplateChars: number;
  /** Drop lines that look like table rows. */
  stripTables: boolean;
  /** Rejoin words split across a line break with a hyphen. */
  dehyphenate: boolean;
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  headerLines: 3,
  footerLines: 3,
  repeatThreshold: 0.5,
  minPagesForRepetition: 3,
  maxBoilerplateChars: 80,
  stripTables: true,
  dehyphenate: true,
};

export interface CleanResult {
  /** Paragraph-separated plain text, ready for the tokenizer. */
  text: string;
  removed: ImportReport['removed'];
  dehyphenated: number;
  /**
   * Word offset in `text` at which each source page's first surviving word sits.
   * One entry per input page; empty for sources that have no pages.
   *
   * This is what lets the original-page surface and the word stream share a position:
   * page 12 of the PDF is word `pageWordStarts[11]` of the stream. A page whose every
   * line was filtered away inherits the next page's offset, so jumping to it lands on
   * the first thing that actually survived rather than at the start of the document.
   */
  pageWordStarts: number[];
}

const ROMAN = /^[ivxlcdm]+$/i;

/**
 * Collapse a line to a shape signature: digits become `#`, whitespace collapses.
 * "Kapitel 3 — Die Analyse" and "Kapitel 7 — Die Analyse" share a signature, so a
 * running head that carries the chapter number is still detected.
 */
export function lineSignature(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}# ]/gu, '');
}

/** A bare page number, with or without decoration: `42`, `- 42 -`, `[ xiv ]`. */
export function isPageNumber(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 16) return false;
  const core = t.replace(/^[[({\-–—|·\s]+/u, '').replace(/[\])}\-–—|·\s]+$/u, '');
  if (core.length === 0) return false;
  if (/^\d{1,4}$/.test(core)) return true;
  if (ROMAN.test(core) && core.length <= 7) return true;
  // "Seite 12", "Page 12 of 340", "12 / 340"
  if (/^(seite|page|s\.?|p\.?)\s*\d{1,4}(\s*(von|of|\/)\s*\d{1,4})?$/i.test(core)) return true;
  if (/^\d{1,4}\s*\/\s*\d{1,4}$/.test(core)) return true;
  return false;
}

/**
 * Table-of-contents leader lines: `Chapter 4 .......... 87`.
 * These survive header stripping because they never repeat.
 */
export function isTocLeader(line: string): boolean {
  return /[.·•\-_]{4,}\s*\d{1,4}\s*$/.test(line.trim());
}

/**
 * A space-aligned table row. PDFs emit these as a single line with wide gutters:
 * `Region      Umsatz    Marge     2024`.
 */
export function isTableRow(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;

  // Explicit pipe/tab tables.
  if ((t.match(/\|/g)?.length ?? 0) >= 2) return true;
  if ((t.match(/\t/g)?.length ?? 0) >= 2) return true;

  const cells = t.split(/\s{2,}/).filter((c) => c.length > 0);
  if (cells.length < 3) return false;

  const digits = (t.match(/\p{Nd}/gu) ?? []).length;
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  const digitRatio = digits / Math.max(digits + letters, 1);
  const avgCell = cells.reduce((sum, c) => sum + c.length, 0) / cells.length;

  // Numeric grid, or many short columns with no sentence punctuation.
  if (digitRatio > 0.25) return true;
  if (avgCell < 14 && !/[.!?]$/.test(t)) return true;
  return false;
}

/** Rules, bullets-only lines, form feeds, OCR noise. */
export function isArtifact(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (/^[\s\f\u00A0]*$/.test(t)) return true;
  // A line with no letters and no digits at all.
  if (!/[\p{L}\p{N}]/u.test(t)) return true;
  // Repeated rule characters.
  if (/^[-_=~*.·•\s]{4,}$/.test(t)) return true;
  // Single stray character.
  if (t.length === 1) return true;
  return false;
}

/**
 * Heading heuristic: short, no terminal punctuation, often numbered or all-caps.
 * Headings become their own paragraph so the pacer gives them a full stop.
 */
export function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 90) return false;
  if (/[.,;:]$/.test(t)) return false;
  if (/^(\d+(\.\d+)*|[IVXLCDM]+)[.)]?\s+\p{Lu}/u.test(t)) return true;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
  return false;
}

interface RepetitionMaps {
  headers: Set<string>;
  footers: Set<string>;
}

/** Find the running heads and feet by looking for signatures that repeat across pages. */
export function findRepeatedBoilerplate(
  pages: readonly (readonly string[])[],
  options: CleanOptions,
): RepetitionMaps {
  const headers = new Set<string>();
  const footers = new Set<string>();
  if (pages.length < options.minPagesForRepetition) return { headers, footers };

  const headCounts = new Map<string, number>();
  const footCounts = new Map<string, number>();

  const candidate = (line: string): string | null => {
    const trimmed = line.trim();
    if (trimmed.length > options.maxBoilerplateChars) return null;
    const sig = lineSignature(line);
    return sig.length >= 2 ? sig : null;
  };

  for (const page of pages) {
    const seenHead = new Set<string>();
    const seenFoot = new Set<string>();
    for (let i = 0; i < Math.min(options.headerLines, page.length); i += 1) {
      const sig = candidate(page[i] as string);
      if (sig && !seenHead.has(sig)) {
        seenHead.add(sig);
        headCounts.set(sig, (headCounts.get(sig) ?? 0) + 1);
      }
    }
    for (let i = Math.max(0, page.length - options.footerLines); i < page.length; i += 1) {
      const sig = candidate(page[i] as string);
      if (sig && !seenFoot.has(sig)) {
        seenFoot.add(sig);
        footCounts.set(sig, (footCounts.get(sig) ?? 0) + 1);
      }
    }
  }

  const minCount = Math.max(3, Math.ceil(pages.length * options.repeatThreshold));
  for (const [sig, count] of headCounts) if (count >= minCount) headers.add(sig);
  for (const [sig, count] of footCounts) if (count >= minCount) footers.add(sig);
  return { headers, footers };
}

/**
 * Reflow hard-wrapped lines into paragraphs.
 *
 * A PDF line break is a typesetting artefact, not a paragraph break. We only start a new
 * paragraph when the previous line was clearly terminal: it ended a sentence *and* was
 * noticeably shorter than the body measure, it was a heading, or an explicit blank line
 * separated them.
 */
export function reflowParagraphs(lines: readonly string[], dehyphenate: boolean): {
  text: string;
  dehyphenated: number;
} {
  const { paragraphs, dehyphenated } = reflowTagged(
    lines.map((text) => ({ text, page: 0 })),
    dehyphenate,
  );
  return { text: paragraphs.map((p) => p.text).join('\n\n'), dehyphenated };
}

/** A kept line together with the source page it came off. */
interface TaggedLine {
  text: string;
  page: number;
}

/** A finished paragraph together with the page its first line came off. */
interface TaggedParagraph {
  text: string;
  page: number;
}

/**
 * The reflow above, but carrying each line's source page through to the paragraph.
 *
 * Split out rather than duplicated: a second copy of this heuristic would drift from the
 * first the moment either is touched, and the paragraph boundaries would then differ
 * between the text the reader sees and the page offsets used to jump into it.
 */
function reflowTagged(
  lines: readonly TaggedLine[],
  dehyphenate: boolean,
): { paragraphs: TaggedParagraph[]; dehyphenated: number } {
  const measured = lines
    .filter((l) => l.text.trim().length > 0)
    .map((l) => l.text.trim().length);
  measured.sort((a, b) => a - b);
  const median = measured.length > 0 ? (measured[Math.floor(measured.length / 2)] as number) : 70;
  const shortLine = median * 0.75;

  const paragraphs: TaggedParagraph[] = [];
  let current = '';
  let currentPage = 0;
  let dehyphenated = 0;

  const flush = () => {
    const t = current.replace(/\s+/g, ' ').trim();
    if (t.length > 0) paragraphs.push({ text: t, page: currentPage });
    current = '';
  };

  for (let i = 0; i < lines.length; i += 1) {
    const entry = lines[i] as TaggedLine;
    const line = entry.text.trim();

    if (line.length === 0) {
      flush();
      continue;
    }

    if (looksLikeHeading(line)) {
      flush();
      paragraphs.push({ text: line, page: entry.page });
      continue;
    }

    if (current.length === 0) {
      current = line;
      currentPage = entry.page;
    } else if (dehyphenate && /[\p{Ll}\p{Lu}]-$/u.test(current) && /^[\p{Ll}]/u.test(line)) {
      // "Doku-\nmentation" → "Dokumentation"
      current = current.slice(0, -1) + line;
      dehyphenated += 1;
      continue;
    } else {
      current = `${current} ${line}`;
    }

    const endsSentence = /[.!?…]["'”’»)\]]?$/.test(line);
    const isShort = line.length < shortLine;
    const next = lines[i + 1]?.text.trim() ?? '';
    const nextStartsUpper = next.length === 0 || /^["'“„«(]?[\p{Lu}\p{Nd}]/u.test(next);

    if (endsSentence && isShort && nextStartsUpper) flush();
  }
  flush();

  return { paragraphs, dehyphenated };
}

/** Whitespace-delimited words, counted the way the tokenizer will split them. */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Word offset of the first paragraph belonging to each page.
 *
 * Pages that lost everything to the filter — a full-page table, a plate, a blank verso —
 * inherit the offset of the next page that kept something, so a jump to them still lands
 * forwards rather than at word zero.
 */
function pageOffsets(paragraphs: readonly TaggedParagraph[], pageCount: number): number[] {
  const firstWordOfPage = new Map<number, number>();
  let words = 0;
  for (const paragraph of paragraphs) {
    if (!firstWordOfPage.has(paragraph.page)) firstWordOfPage.set(paragraph.page, words);
    words += countWords(paragraph.text);
  }

  const starts = new Array<number>(pageCount);
  let next = words;
  for (let page = pageCount - 1; page >= 0; page -= 1) {
    const own = firstWordOfPage.get(page);
    if (own !== undefined) next = own;
    starts[page] = next;
  }
  return starts;
}

/**
 * Run the full filter over a page-structured document.
 * `pages` is one array of raw lines per source page.
 */
export function cleanPages(
  pages: readonly (readonly string[])[],
  options: Partial<CleanOptions> = {},
): CleanResult {
  const opts = { ...DEFAULT_CLEAN_OPTIONS, ...options };
  const { headers, footers } = findRepeatedBoilerplate(pages, opts);

  const removed: ImportReport['removed'] = {
    headers: 0,
    footers: 0,
    pageNumbers: 0,
    tableRows: 0,
    artifacts: 0,
  };

  const kept: TaggedLine[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex] as readonly string[];
    const pageKept: string[] = [];
    for (let i = 0; i < page.length; i += 1) {
      const line = page[i] as string;
      const inHeadZone = i < opts.headerLines;
      const inFootZone = i >= page.length - opts.footerLines;
      const sig = lineSignature(line);

      if (inHeadZone && headers.has(sig)) {
        removed.headers += 1;
        continue;
      }
      if (inFootZone && footers.has(sig)) {
        removed.footers += 1;
        continue;
      }
      if ((inHeadZone || inFootZone) && isPageNumber(line)) {
        removed.pageNumbers += 1;
        continue;
      }
      if (isTocLeader(line)) {
        removed.artifacts += 1;
        continue;
      }
      if (isArtifact(line)) {
        removed.artifacts += 1;
        continue;
      }
      if (opts.stripTables && isTableRow(line)) {
        removed.tableRows += 1;
        continue;
      }
      pageKept.push(line);
    }
    if (pageKept.length > 0) {
      for (const line of pageKept) kept.push({ text: line, page: pageIndex });
      // Page boundary is a soft break; reflow decides whether it becomes a paragraph.
      kept.push({ text: '', page: pageIndex });
    }
  }

  const { paragraphs, dehyphenated } = reflowTagged(kept, opts.dehyphenate);
  return {
    text: paragraphs.map((p) => p.text).join('\n\n'),
    removed,
    dehyphenated,
    pageWordStarts: pageOffsets(paragraphs, pages.length),
  };
}

/** Convenience wrapper for sources that have no page structure (HTML, EPUB, TXT). */
export function cleanFlowText(input: string, options: Partial<CleanOptions> = {}): CleanResult {
  const opts = { ...DEFAULT_CLEAN_OPTIONS, ...options, stripTables: false };
  const removed: ImportReport['removed'] = {
    headers: 0,
    footers: 0,
    pageNumbers: 0,
    tableRows: 0,
    artifacts: 0,
  };
  const lines: string[] = [];
  for (const line of input.split(/\r?\n/)) {
    if (line.trim().length > 0 && isArtifact(line)) {
      removed.artifacts += 1;
      continue;
    }
    lines.push(line);
  }
  const { text, dehyphenated } = reflowParagraphs(lines, opts.dehyphenate);
  return { text, removed, dehyphenated, pageWordStarts: [] };
}

export function emptyReport(): ImportReport['removed'] {
  return { headers: 0, footers: 0, pageNumbers: 0, tableRows: 0, artifacts: 0 };
}
