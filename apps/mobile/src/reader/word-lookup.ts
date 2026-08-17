/**
 * The offline half of looking a word up: where else it stands in this document.
 *
 * A dictionary is not what a reader usually needs mid-page. What they need is context:
 * this word turned up before, in that chapter, in that sentence. The document itself
 * answers that, and it answers it without a server, which is the whole reason this exists
 * instead of a lookup API.
 *
 * The matching is `searchTokens` from core, unchanged, so the overview and the search
 * sheet agree on what a hit is and diacritic folding works the same in both.
 *
 * No React Native import in this file on purpose: it is the part worth testing, and tests
 * run under Node.
 */
import { fold, searchTokens, type RsvpToken, type SearchHit } from '@lexipulse/core';

/**
 * How many raw matches to scan before giving up on an exact total.
 *
 * A common word in a book has thousands of hits, and nobody scrolls a list that long. The
 * cap keeps the scan bounded and the count is then reported as a floor rather than a lie.
 */
export const OCCURRENCE_LIMIT = 250;

export interface WordOccurrences {
  /** The cleaned word the scan actually ran on, which is what the sheet shows. */
  word: string;
  hits: SearchHit[];
  /** True when the scan stopped at the limit, so `hits.length` is a floor, not a total. */
  capped: boolean;
}

/**
 * Trim a tapped word down to what can be looked up.
 *
 * Tokens carry their punctuation, so a selection is routinely "Schnelllesen." or „Wort".
 * Searching for that finds only the occurrences that happen to be followed by the same
 * mark, and handing it to a dictionary app finds nothing at all. Inner punctuation stays:
 * "US-Dollar" and "don't" are one word each.
 */
export function normalizeLookupWord(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '');
}

/**
 * Every place this word stands in the document.
 *
 * `searchTokens` matches substrings, which is right for a search box ("lesen" should find
 * "Schnelllesen") and wrong for a count: "der" would be reported a thousand times because
 * it hides inside "anderen". So hits are kept only where the match starts on a whole word,
 * checked against the token it begins in. That makes the number on screen the number a
 * reader would arrive at by counting.
 */
export function occurrencesOf(tokens: readonly RsvpToken[], selection: string): WordOccurrences {
  const word = normalizeLookupWord(selection);
  if (word.length === 0) return { word, hits: [], capped: false };

  const raw = searchTokens(tokens, word, { limit: OCCURRENCE_LIMIT, contextChars: 52 });
  const opening = fold(word).split(' ')[0] ?? '';
  const hits = raw.filter((hit) => {
    const token = tokenAt(tokens, hit.tokenIndex);
    if (!token) return false;
    return fold(normalizeLookupWord(token.text)) === opening;
  });

  return { word, hits, capped: raw.length >= OCCURRENCE_LIMIT };
}

/**
 * The token a hit points at. Usually the array position, because the stream is the whole
 * document in order; the scan is the fallback for any slice that is not.
 */
function tokenAt(tokens: readonly RsvpToken[], index: number): RsvpToken | null {
  const direct = tokens[index];
  if (direct && direct.index === index) return direct;
  return tokens.find((token) => token.index === index) ?? null;
}
