/**
 * The page-mode engine: search, bionic emphasis, and the token↔text mapping both
 * surfaces need.
 *
 * RSVP and page mode share one position, and that position is a token index. Everything
 * here converts between "the reader is at word 412" and "this is the paragraph on screen",
 * so switching modes never loses the place.
 *
 * Platform-free on purpose, like the rest of core: no DOM, no React Native, no Node.
 */

import type { Annotation, RsvpToken } from './types.js';

/* ------------------------------------------------------------------ paragraphs */

export interface ReaderParagraph {
  /** Stable across renders: the paragraph index the tokenizer assigned. */
  key: number;
  chapterIndex: number;
  tokens: RsvpToken[];
  /** Token index of the first word, for scroll targets and search hits. */
  firstToken: number;
  lastToken: number;
}

/**
 * Group a token stream into paragraphs.
 *
 * `chapterIndex` limits the result to one chapter; leaving it out returns the whole
 * document, which is what page mode reads.
 */
export function paragraphsOf(
  tokens: readonly RsvpToken[],
  chapterIndex?: number,
): ReaderParagraph[] {
  const out: ReaderParagraph[] = [];
  for (const token of tokens) {
    if (chapterIndex !== undefined && token.chapterIndex !== chapterIndex) continue;
    const last = out[out.length - 1];
    if (last && last.key === token.paragraphIndex) {
      last.tokens.push(token);
      last.lastToken = token.index;
    } else {
      out.push({
        key: token.paragraphIndex,
        chapterIndex: token.chapterIndex,
        tokens: [token],
        firstToken: token.index,
        lastToken: token.index,
      });
    }
  }
  return out;
}

/** The paragraph holding a token, or -1. Used to scroll to the shared position. */
export function paragraphIndexOfToken(
  paragraphs: readonly ReaderParagraph[],
  tokenIndex: number,
): number {
  for (let i = 0; i < paragraphs.length; i += 1) {
    const p = paragraphs[i] as ReaderParagraph;
    if (tokenIndex >= p.firstToken && tokenIndex <= p.lastToken) return i;
  }
  return -1;
}

/* ---------------------------------------------------------------------- search */

export interface SearchHit {
  tokenIndex: number;
  chapterIndex: number;
  /** Text around the hit, for the result list. */
  preview: string;
  /** Where the match starts inside `preview`, so the UI can mark it. */
  previewOffset: number;
  matchLength: number;
}

/**
 * Find every occurrence of `query` in the token stream.
 *
 * Matching runs over a joined, lower-cased string rather than token by token, because a
 * reader searching for "im Vergleich" expects a hit across the word boundary. Diacritics
 * are folded so "fur" finds "für" — the alternative is a search that silently fails on
 * exactly the words German readers type without an umlaut.
 */
export function searchTokens(
  tokens: readonly RsvpToken[],
  query: string,
  options: { limit?: number; contextChars?: number } = {},
): SearchHit[] {
  const { limit = 200, contextChars = 44 } = options;
  const needle = fold(query.trim());
  if (needle.length === 0) return [];

  // One pass builds the haystack and the offset→token map together.
  const starts: number[] = [];
  let haystack = '';
  for (const token of tokens) {
    starts.push(haystack.length);
    haystack += `${fold(token.text)} `;
  }

  const hits: SearchHit[] = [];
  let from = 0;
  while (hits.length < limit) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    const tokenIndex = tokenAtOffset(starts, at);
    const token = tokens[tokenIndex];
    if (token) {
      const start = Math.max(0, at - contextChars);
      const end = Math.min(haystack.length, at + needle.length + contextChars);
      // The preview begins at a word boundary, not at `start`: `rebuild` snaps outwards to
      // whole tokens rather than cutting a word in half. So the offset has to be measured
      // from that same boundary — measuring it from `start` puts the marker a few letters
      // early, on the tail of the preceding word.
      const previewStart = starts[tokenAtOffset(starts, start)] ?? 0;
      hits.push({
        tokenIndex: token.index,
        chapterIndex: token.chapterIndex,
        preview: rebuild(tokens, starts, start, end),
        previewOffset: at - previewStart,
        matchLength: needle.length,
      });
    }
    from = at + needle.length;
  }
  return hits;
}

/** Binary search: which token covers this offset in the joined string. */
function tokenAtOffset(starts: readonly number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((starts[mid] as number) <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** The original text for an offset range — the folded haystack is not presentable. */
function rebuild(
  tokens: readonly RsvpToken[],
  starts: readonly number[],
  from: number,
  to: number,
): string {
  const first = tokenAtOffset(starts, from);
  const last = tokenAtOffset(starts, Math.max(from, to - 1));
  const parts: string[] = [];
  for (let i = first; i <= last && i < tokens.length; i += 1) {
    parts.push((tokens[i] as RsvpToken).text);
  }
  return parts.join(' ');
}

/**
 * Lower-case and strip diacritics, keeping length stable so offsets stay valid.
 *
 * `normalize('NFD')` would change the length and break the offset map, so the mapping is
 * done character by character over the pairs that actually occur in the languages this
 * app parses.
 */
const FOLD: Record<string, string> = {
  ä: 'a', ö: 'o', ü: 'u', ß: 's', á: 'a', à: 'a', â: 'a', ã: 'a', å: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ñ: 'n', ç: 'c',
  ý: 'y', ÿ: 'y', ø: 'o', æ: 'a', œ: 'o',
};

export function fold(input: string): string {
  let out = '';
  for (const char of input.toLowerCase()) out += FOLD[char] ?? char;
  return out;
}

/* --------------------------------------------------------------------- bionic */

/**
 * How many leading characters of a word to embolden.
 *
 * "Bionic" reading fixes the eye on word openings. The published ratios are roughly half
 * the word at full strength, tapering for short words — a two-letter word with one bold
 * letter reads as emphasis, with two as shouting.
 */
export function bionicPrefix(word: string, strength: number): number {
  if (strength <= 0) return 0;
  const letters = word.replace(/[^\p{L}\p{N}]/gu, '').length;
  if (letters === 0) return 0;
  if (letters <= 1) return strength >= 4 ? 1 : 0;
  if (letters <= 3) return 1;
  const ratio = 0.3 + strength * 0.06; // 0.36 at 1 … 0.6 at 5
  return Math.max(1, Math.min(letters - 1, Math.round(letters * ratio)));
}

/* ---------------------------------------------------------------- annotations */

/** The annotations covering a token, innermost last. */
export function annotationsAt(
  annotations: readonly Annotation[],
  tokenIndex: number,
): Annotation[] {
  return annotations.filter((a) => tokenIndex >= a.startToken && tokenIndex <= a.endToken);
}

/** Text of a token range, for storing with a highlight. */
export function textOfRange(
  tokens: readonly RsvpToken[],
  startToken: number,
  endToken: number,
): string {
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.index < startToken) continue;
    if (token.index > endToken) break;
    parts.push(token.text);
  }
  return parts.join(' ');
}
