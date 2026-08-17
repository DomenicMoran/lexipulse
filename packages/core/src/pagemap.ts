/**
 * The bridge between a source page and the word stream.
 *
 * The original surface counts in pages, the player counts in tokens, and neither number
 * can be turned into the other by arithmetic: the smart filter drops running heads and
 * table rows, and the tokenizer splits words longer than its cap into several tokens.
 * What survives both is the word — so pages are anchored to word offsets at import time
 * (`pageWordStarts`) and converted to token indices here, against the token stream the
 * reader is actually looking at.
 *
 * Platform-free, like the rest of core.
 */

import type { LexiDocument, RsvpToken } from './types.js';

/**
 * Token index at which each whole word begins.
 *
 * `continuesWord` marks a token that is a fragment of the word before it, so a word
 * starts at every token whose predecessor was not such a fragment.
 */
export function wordStarts(tokens: readonly RsvpToken[]): number[] {
  const starts: number[] = [];
  let previousContinues = false;
  for (let i = 0; i < tokens.length; i += 1) {
    if (!previousContinues) starts.push(i);
    previousContinues = (tokens[i] as RsvpToken).continuesWord === true;
  }
  return starts;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/** Token index of the `wordIndex`-th word, clamped into the stream. */
export function tokenIndexForWord(starts: readonly number[], wordIndex: number): number {
  if (starts.length === 0) return 0;
  const i = clamp(Math.floor(wordIndex), 0, starts.length - 1);
  return starts[i] as number;
}

/** How many whole words precede `tokenIndex`. The inverse of `tokenIndexForWord`. */
export function wordIndexForToken(starts: readonly number[], tokenIndex: number): number {
  if (starts.length === 0) return 0;
  let low = 0;
  let high = starts.length - 1;
  let answer = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((starts[mid] as number) <= tokenIndex) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer;
}

/**
 * A document's page anchors as token indices, or null when it has no page structure.
 *
 * Computed once per open and handed to both surfaces, because doing it per page turn
 * would rebuild the word index of a 400-page book on every tap.
 */
export function pageTokenStarts(
  document: Pick<LexiDocument, 'pageWordStarts'>,
  tokens: readonly RsvpToken[],
): number[] | null {
  const words = document.pageWordStarts;
  if (!words || words.length === 0) return null;
  const starts = wordStarts(tokens);
  return words.map((wordIndex) => tokenIndexForWord(starts, wordIndex));
}

/** 1-based page holding `tokenIndex`. Returns 1 when the document has no pages. */
export function pageForToken(pageStarts: readonly number[] | null, tokenIndex: number): number {
  if (!pageStarts || pageStarts.length === 0) return 1;
  let low = 0;
  let high = pageStarts.length - 1;
  let answer = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((pageStarts[mid] as number) <= tokenIndex) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer + 1;
}

/** Token index at which a 1-based page begins. */
export function tokenForPage(pageStarts: readonly number[] | null, page: number): number {
  if (!pageStarts || pageStarts.length === 0) return 0;
  const i = clamp(Math.floor(page) - 1, 0, pageStarts.length - 1);
  return pageStarts[i] as number;
}
