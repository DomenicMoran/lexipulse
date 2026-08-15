import { computeOrp } from './orp.js';
import { DEFAULT_PACING, endsWithSentencePunct, terminalChar, tokenDurationMs } from './pacing.js';
import type { DocumentChapter, PacingMatrix, RsvpToken } from './types.js';

/**
 * Abbreviations whose trailing period does *not* end a sentence.
 * Without this the pacer stalls for 75 % extra on every "z.B." and "Dr.".
 */
const ABBREVIATIONS = new Set([
  // German
  'z.b',
  'bzw',
  'd.h',
  'u.a',
  'usw',
  'ca',
  'ggf',
  'evtl',
  'inkl',
  'exkl',
  'nr',
  'abb',
  'vgl',
  'bspw',
  'sog',
  'jhd',
  'jh',
  'bzgl',
  'zzgl',
  'dr',
  'prof',
  'hr',
  'fr',
  'st',
  // English
  'mr',
  'mrs',
  'ms',
  'e.g',
  'i.e',
  'etc',
  'vs',
  'fig',
  'no',
  'jr',
  'sr',
  'approx',
  'inc',
  'ltd',
  'co',
  'al',
  'cf',
  'ed',
  'eds',
  'vol',
  'pp',
]);

export interface TokenizeOptions {
  wpm: number;
  pacing?: PacingMatrix;
  /**
   * Words longer than this are split into hyphenated segments so the monospace
   * player never has to reflow. 0 disables splitting.
   */
  maxWordLength?: number;
  /** Starting values, used when tokenizing chapter by chapter. */
  startIndex?: number;
  startParagraph?: number;
  startSentence?: number;
  chapterIndex?: number;
}

const DEFAULT_MAX_WORD_LENGTH = 22;

/** True when the trailing period belongs to an abbreviation or an ordinal, not a sentence. */
export function isAbbreviation(word: string): boolean {
  const stripped = word
    .replace(/[»«"'”’)\]}]+$/u, '')
    .replace(/^[«»"'“‘([{]+/u, '')
    .toLowerCase();
  if (!stripped.endsWith('.')) return false;
  const body = stripped.slice(0, -1);
  if (body.length === 0) return false;
  // Ordinals and enumerations: "1.", "12.", "IV."
  if (/^\d+$/.test(body)) return true;
  // Single initial: "J." in "J. R. R. Tolkien"
  if (Array.from(body).length === 1 && /\p{L}/u.test(body)) return true;
  return ABBREVIATIONS.has(body);
}

/** A trailing `.`/`!`/`?` that is not an abbreviation or ordinal. */
export function isSentenceTerminator(word: string): boolean {
  if (!endsWithSentencePunct(word)) return false;
  const last = terminalChar(word);
  if (last === '!' || last === '?' || last === '…' || last === '‽') return true;
  return !isAbbreviation(word);
}

function containsDigit(word: string): boolean {
  return /\p{Nd}/u.test(word);
}

/**
 * Split an overlong word into render-safe segments.
 * Segments break on an existing hyphen when there is one nearby, otherwise hard-break
 * and append a hyphen so the reader sees the continuation.
 */
export function splitLongWord(word: string, maxLength: number): string[] {
  const chars = Array.from(word);
  if (maxLength <= 0 || chars.length <= maxLength) return [word];

  const segments: string[] = [];
  let rest = chars;
  while (rest.length > maxLength) {
    // Prefer the rightmost existing hyphen inside the window — a real compound break
    // reads better than an invented one.
    let cut = -1;
    for (let i = maxLength - 1; i >= 1; i -= 1) {
      if (rest[i] === '-' || rest[i] === '‑' || rest[i] === '–') {
        cut = i + 1;
        break;
      }
    }
    if (cut > 0) {
      segments.push(rest.slice(0, cut).join(''));
      rest = rest.slice(cut);
    } else {
      segments.push(`${rest.slice(0, maxLength - 1).join('')}-`);
      rest = rest.slice(maxLength - 1);
    }
  }
  segments.push(rest.join(''));
  return segments;
}

export interface TokenizeResult {
  tokens: RsvpToken[];
  /** Continuation values so the next chapter picks up where this one stopped. */
  nextIndex: number;
  nextParagraph: number;
  nextSentence: number;
}

/**
 * Turn plain text into a paced RSVP token stream.
 *
 * Paragraphs are separated by a blank line ("\n\n"); single newlines inside a
 * paragraph are treated as soft wraps and collapse to spaces.
 */
export function tokenize(text: string, options: TokenizeOptions): TokenizeResult {
  const {
    wpm,
    pacing = DEFAULT_PACING,
    maxWordLength = DEFAULT_MAX_WORD_LENGTH,
    startIndex = 0,
    startParagraph = 0,
    startSentence = 0,
    chapterIndex = 0,
  } = options;

  const tokens: RsvpToken[] = [];
  let index = startIndex;
  let paragraphIndex = startParagraph;
  let sentenceIndex = startSentence;
  let charOffset = 0;

  const paragraphs = text.split(/\n[ \t]*\n+/);

  for (let p = 0; p < paragraphs.length; p += 1) {
    const raw = (paragraphs[p] as string).replace(/\s+/g, ' ').trim();
    if (raw.length === 0) {
      charOffset += (paragraphs[p] as string).length + 2;
      continue;
    }

    const words = raw.split(' ');
    const paragraphTokens: RsvpToken[] = [];

    for (const word of words) {
      if (word.length === 0) continue;
      const segments = splitLongWord(word, maxWordLength);
      const lastSegmentIdx = segments.length - 1;

      for (let s = 0; s < segments.length; s += 1) {
        const segment = segments[s] as string;
        const isLast = s === lastSegmentIdx;
        const endsSentence = isLast && isSentenceTerminator(word);

        const token: RsvpToken = {
          index,
          text: segment,
          orp: computeOrp(segment),
          durationMs: 0,
          chapterIndex,
          paragraphIndex,
          sentenceIndex,
          charOffset,
          endsSentence,
          endsParagraph: false,
          isNumeric: containsDigit(segment),
        };
        paragraphTokens.push(token);
        index += 1;
        charOffset += segment.length;
        if (endsSentence) sentenceIndex += 1;
      }
      charOffset += 1; // the space we split on
    }

    if (paragraphTokens.length > 0) {
      const last = paragraphTokens[paragraphTokens.length - 1] as RsvpToken;
      last.endsParagraph = true;
      // A paragraph break is a sentence break even without punctuation (headings, lists).
      if (!last.endsSentence) sentenceIndex += 1;
      for (const token of paragraphTokens) {
        token.durationMs = tokenDurationMs(token, wpm, pacing);
      }
      tokens.push(...paragraphTokens);
      paragraphIndex += 1;
    }

    charOffset += 2; // the "\n\n" we split on
  }

  return {
    tokens,
    nextIndex: index,
    nextParagraph: paragraphIndex,
    nextSentence: sentenceIndex,
  };
}

/**
 * Tokenize a whole document chapter by chapter, keeping indices continuous and
 * back-filling each chapter's `startToken` / `tokenCount`.
 */
export function tokenizeChapters(
  chapters: DocumentChapter[],
  options: Omit<TokenizeOptions, 'chapterIndex' | 'startIndex'>,
): RsvpToken[] {
  const all: RsvpToken[] = [];
  let index = 0;
  let paragraph = 0;
  let sentence = 0;

  for (let c = 0; c < chapters.length; c += 1) {
    const chapter = chapters[c] as DocumentChapter;
    const result = tokenize(chapter.text, {
      ...options,
      chapterIndex: c,
      startIndex: index,
      startParagraph: paragraph,
      startSentence: sentence,
    });
    chapter.startToken = index;
    chapter.tokenCount = result.tokens.length;
    all.push(...result.tokens);
    index = result.nextIndex;
    paragraph = result.nextParagraph;
    sentence = result.nextSentence;
  }

  return all;
}

/** Plain-text preview around a token — used for bookmarks and the scrubber tooltip. */
export function contextAround(
  tokens: readonly RsvpToken[],
  index: number,
  radius = 6,
): { before: string[]; current: string; after: string[] } {
  const clamped = Math.min(Math.max(index, 0), Math.max(tokens.length - 1, 0));
  const before: string[] = [];
  const after: string[] = [];
  for (let i = Math.max(0, clamped - radius); i < clamped; i += 1) {
    before.push((tokens[i] as RsvpToken).text);
  }
  for (let i = clamped + 1; i <= Math.min(tokens.length - 1, clamped + radius); i += 1) {
    after.push((tokens[i] as RsvpToken).text);
  }
  return { before, current: (tokens[clamped]?.text ?? '') as string, after };
}
