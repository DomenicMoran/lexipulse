import type { PacingMatrix, RsvpToken } from './types.js';

export const MIN_WPM = 100;
export const MAX_WPM = 1200;

/**
 * Default pacing matrix.
 *
 * Flat RSVP (every word gets 60000/wpm ms) collapses comprehension because a
 * sentence boundary needs the same processing budget as a three-letter article.
 * These multipliers restore the natural rhythm of silent reading.
 */
export const DEFAULT_PACING: PacingMatrix = {
  longWord: 1.25,
  longWordThreshold: 8,
  sentenceEnd: 1.75,
  clauseEnd: 1.75,
  paragraphEnd: 2.0,
  numeric: 1.4,
  shortWord: 0.9,
  minDurationMs: 40,
  maxDurationMs: 3000,
};

const SENTENCE_PUNCT = new Set(['.', '!', '?', '…', '‽']);
const CLAUSE_PUNCT = new Set([',', ';', ':', '—', '–']);
/** Trailing wrappers that sit *after* the real punctuation and must be peeled first. */
const TRAILING_WRAPPERS = new Set(['"', "'", '”', '’', '»', ')', ']', '}', '«', '“']);

export function clampWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return 300;
  return Math.min(Math.max(Math.round(wpm), MIN_WPM), MAX_WPM);
}

/** Nominal milliseconds per word before any multiplier. */
export function baseDurationMs(wpm: number): number {
  return 60_000 / clampWpm(wpm);
}

/** Strip trailing quotes/brackets so `word."` is recognised as a sentence end. */
function peelWrappers(text: string): string {
  const chars = Array.from(text);
  let end = chars.length;
  while (end > 0 && TRAILING_WRAPPERS.has(chars[end - 1] as string)) end -= 1;
  return chars.slice(0, end).join('');
}

/** Last character after trailing wrappers have been peeled. */
export function terminalChar(text: string): string {
  const peeled = peelWrappers(text);
  const chars = Array.from(peeled);
  return chars.length > 0 ? (chars[chars.length - 1] as string) : '';
}

export function endsWithSentencePunct(text: string): boolean {
  return SENTENCE_PUNCT.has(terminalChar(text));
}

/** `,` `;` `:` `—` — peeled of any trailing quote or bracket, so `word,"` still counts. */
export function endsWithClausePunct(text: string): boolean {
  return CLAUSE_PUNCT.has(terminalChar(text));
}

/** Number of characters that count towards the "long word" rule (punctuation excluded). */
export function coreLength(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (/[\p{L}\p{N}]/u.test(ch)) n += 1;
  }
  return n;
}

export interface PaceableToken {
  text: string;
  endsSentence: boolean;
  endsParagraph: boolean;
  isNumeric: boolean;
}

/**
 * Display duration for a single token.
 *
 * Multipliers compose: a long word that also ends a sentence gets both
 * (1.25 × 1.75 = 2.19×), which is exactly the dwell a reader needs to close
 * the clause and start the next one.
 */
export function tokenDurationMs(
  token: PaceableToken,
  wpm: number,
  matrix: PacingMatrix = DEFAULT_PACING,
): number {
  const base = baseDurationMs(wpm);
  const len = coreLength(token.text);
  let ms = base;

  if (len > matrix.longWordThreshold) {
    ms *= matrix.longWord;
  } else if (len > 0 && len <= 3) {
    ms *= matrix.shortWord;
  }

  if (token.isNumeric) ms *= matrix.numeric;

  if (token.endsSentence) {
    ms *= matrix.sentenceEnd;
  } else if (endsWithClausePunct(token.text)) {
    ms *= matrix.clauseEnd;
  }

  if (token.endsParagraph) ms *= matrix.paragraphEnd;

  return Math.min(Math.max(ms, matrix.minDurationMs), matrix.maxDurationMs);
}

/** Rewrite `durationMs` on every token for a new WPM / matrix. Mutates in place. */
export function repaceTokens(
  tokens: RsvpToken[],
  wpm: number,
  matrix: PacingMatrix = DEFAULT_PACING,
): RsvpToken[] {
  for (const token of tokens) {
    token.durationMs = tokenDurationMs(token, wpm, matrix);
  }
  return tokens;
}

/** Total milliseconds for a token range — the basis for "12 min left". */
export function estimateDurationMs(
  tokens: readonly RsvpToken[],
  from = 0,
  to = tokens.length,
): number {
  let total = 0;
  const end = Math.min(to, tokens.length);
  for (let i = Math.max(0, from); i < end; i += 1) {
    total += (tokens[i] as RsvpToken).durationMs;
  }
  return total;
}

/**
 * Effective words-per-minute for a range, after the pacing matrix has had its say.
 * Always lower than the nominal WPM — that gap is the honest number to show users.
 */
export function effectiveWpm(tokens: readonly RsvpToken[], from = 0, to = tokens.length): number {
  const count = Math.min(to, tokens.length) - Math.max(0, from);
  if (count <= 0) return 0;
  const ms = estimateDurationMs(tokens, from, to);
  if (ms <= 0) return 0;
  return (count / ms) * 60_000;
}
