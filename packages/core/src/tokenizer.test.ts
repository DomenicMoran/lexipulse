import { describe, expect, it } from 'vitest';
import {
  contextAround,
  isAbbreviation,
  isSentenceTerminator,
  joinTokens,
  sentenceRange,
  sentenceText,
  sentenceTextAt,
  splitLongWord,
  tokenize,
  tokenizeChapters,
} from './tokenizer.js';
import type { DocumentChapter } from './types.js';

describe('isAbbreviation', () => {
  it('recognises German and English abbreviations', () => {
    expect(isAbbreviation('z.B.')).toBe(true);
    expect(isAbbreviation('bzw.')).toBe(true);
    expect(isAbbreviation('Dr.')).toBe(true);
    expect(isAbbreviation('etc.')).toBe(true);
    expect(isAbbreviation('i.e.')).toBe(true);
  });

  it('recognises ordinals and initials', () => {
    expect(isAbbreviation('1.')).toBe(true);
    expect(isAbbreviation('42.')).toBe(true);
    expect(isAbbreviation('J.')).toBe(true);
  });

  it('does not swallow ordinary words', () => {
    expect(isAbbreviation('Ende.')).toBe(false);
    expect(isAbbreviation('Wort')).toBe(false);
  });
});

describe('isSentenceTerminator', () => {
  it('treats ! and ? as terminal regardless of abbreviation lists', () => {
    expect(isSentenceTerminator('Wirklich?')).toBe(true);
    expect(isSentenceTerminator('Los!')).toBe(true);
  });

  it('does not end a sentence on an abbreviation', () => {
    expect(isSentenceTerminator('z.B.')).toBe(false);
    expect(isSentenceTerminator('Dr.')).toBe(false);
  });

  it('ends a sentence on a normal period, including behind a quote', () => {
    expect(isSentenceTerminator('Ende.')).toBe(true);
    expect(isSentenceTerminator('Ende."')).toBe(true);
  });
});

describe('splitLongWord', () => {
  const texts = (word: string, max: number) => splitLongWord(word, max).map((s) => s.text);

  it('leaves normal words untouched', () => {
    expect(splitLongWord('Entwicklung', 22)).toEqual([
      { text: 'Entwicklung', hardBreak: false },
    ]);
  });

  it('hard-breaks an overlong word and marks the break with a hyphen', () => {
    const segments = splitLongWord('Donaudampfschifffahrtsgesellschaftskapitaen', 22);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0]?.text).toMatch(/-$/);
    expect(segments[0]?.hardBreak).toBe(true);
    expect(
      segments
        .map((s) => (s.hardBreak ? s.text.slice(0, -1) : s.text))
        .join(''),
    ).toBe('Donaudampfschifffahrtsgesellschaftskapitaen');
  });

  it('prefers an existing hyphen as the break point and does not call it a hard break', () => {
    const segments = splitLongWord('Bundes-Immissionsschutzverordnung', 20);
    expect(segments[0]?.text).toBe('Bundes-');
    expect(segments[0]?.hardBreak).toBe(false);
  });

  it('is a no-op when splitting is disabled', () => {
    const long = 'a'.repeat(60);
    expect(texts(long, 0)).toEqual([long]);
  });
});

describe('joinTokens / sentenceText', () => {
  it('reassembles a plain sentence', () => {
    const { tokens } = tokenize('Ein kurzer Satz.', { wpm: 300 });
    expect(joinTokens(tokens)).toBe('Ein kurzer Satz.');
  });

  it('drops only the hyphen the splitter invented', () => {
    const { tokens } = tokenize('Donaudampfschifffahrtsgesellschaft faehrt', {
      wpm: 300,
      maxWordLength: 20,
    });
    expect(joinTokens(tokens)).toBe('Donaudampfschifffahrtsgesellschaft faehrt');
  });

  it('keeps a real compound hyphen', () => {
    const { tokens } = tokenize('Bundes-Immissionsschutzverordnung gilt', {
      wpm: 300,
      maxWordLength: 20,
    });
    expect(joinTokens(tokens)).toBe('Bundes-Immissionsschutzverordnung gilt');
  });

  it('returns the sentence the engine is currently in', () => {
    const { tokens } = tokenize('Erster Satz hier. Zweiter Satz dort. Dritter Satz.', {
      wpm: 300,
    });
    expect(sentenceText(tokens, 0)).toBe('Erster Satz hier.');
    expect(sentenceText(tokens, 1)).toBe('Zweiter Satz dort.');
    expect(sentenceTextAt(tokens, 4)).toBe('Zweiter Satz dort.');
  });

  it('reports the token range of a sentence', () => {
    const { tokens } = tokenize('Eins zwei. Drei vier.', { wpm: 300 });
    expect(sentenceRange(tokens, 0)).toEqual({ start: 0, end: 2 });
    expect(sentenceRange(tokens, 1)).toEqual({ start: 2, end: 4 });
    expect(sentenceRange(tokens, 9)).toBeNull();
  });

  it('handles an empty stream', () => {
    expect(joinTokens([])).toBe('');
    expect(sentenceText([], 0)).toBe('');
    expect(sentenceTextAt([], 0)).toBe('');
  });
});

describe('tokenize', () => {
  it('produces one token per word', () => {
    const { tokens } = tokenize('Ein kurzer Satz.', { wpm: 300 });
    expect(tokens.map((t) => t.text)).toEqual(['Ein', 'kurzer', 'Satz.']);
  });

  it('assigns continuous indices and a duration to every token', () => {
    const { tokens } = tokenize('Ein kurzer Satz.', { wpm: 300 });
    tokens.forEach((token, i) => {
      expect(token.index).toBe(i);
      expect(token.durationMs).toBeGreaterThan(0);
    });
  });

  it('collapses soft wraps but keeps blank lines as paragraph breaks', () => {
    const { tokens } = tokenize('Erste Zeile\nzweite Zeile\n\nNeuer Absatz', { wpm: 300 });
    const paragraphs = new Set(tokens.map((t) => t.paragraphIndex));
    expect(paragraphs.size).toBe(2);
    expect(tokens.find((t) => t.text === 'Zeile' && t.endsParagraph)).toBeDefined();
  });

  it('marks the last token of each paragraph', () => {
    const { tokens } = tokenize('Eins zwei\n\ndrei vier', { wpm: 300 });
    expect(tokens.filter((t) => t.endsParagraph).map((t) => t.text)).toEqual(['zwei', 'vier']);
  });

  it('increments the sentence index only on real sentence ends', () => {
    const { tokens } = tokenize('Herr Dr. Meier kam. Er ging.', { wpm: 300 });
    const byText = new Map(tokens.map((t) => [t.text, t]));
    expect(byText.get('Dr.')?.endsSentence).toBe(false);
    expect(byText.get('kam.')?.endsSentence).toBe(true);
    expect(byText.get('Er')?.sentenceIndex).toBe(1);
  });

  it('splits overlong words into several tokens', () => {
    const { tokens } = tokenize('Donaudampfschifffahrtsgesellschaftskapitaen fuhr', {
      wpm: 300,
      maxWordLength: 20,
    });
    expect(tokens.length).toBeGreaterThan(2);
    expect(tokens[tokens.length - 1]?.text).toBe('fuhr');
  });

  it('flags tokens with digits', () => {
    const { tokens } = tokenize('Im Jahr 2026 kam es', { wpm: 300 });
    expect(tokens.find((t) => t.text === '2026')?.isNumeric).toBe(true);
    expect(tokens.find((t) => t.text === 'Jahr')?.isNumeric).toBe(false);
  });

  it('returns an empty stream for empty or whitespace-only input', () => {
    expect(tokenize('', { wpm: 300 }).tokens).toHaveLength(0);
    expect(tokenize('   \n\n  \t ', { wpm: 300 }).tokens).toHaveLength(0);
  });

  it('continues indices when called with a start offset', () => {
    const first = tokenize('Eins zwei.', { wpm: 300 });
    const second = tokenize('Drei vier.', {
      wpm: 300,
      startIndex: first.nextIndex,
      startParagraph: first.nextParagraph,
      startSentence: first.nextSentence,
    });
    expect(second.tokens[0]?.index).toBe(first.tokens.length);
    expect(second.tokens[0]?.paragraphIndex).toBe(1);
    expect(second.tokens[0]?.sentenceIndex).toBe(1);
  });

  it('gives every token a valid ORP inside its own text', () => {
    const { tokens } = tokenize('Verantwortungsbewusstsein „zitiert" — 42%.', { wpm: 300 });
    for (const token of tokens) {
      expect(token.orp).toBeGreaterThanOrEqual(0);
      expect(token.orp).toBeLessThan(Array.from(token.text).length);
    }
  });
});

describe('tokenizeChapters', () => {
  const chapters: DocumentChapter[] = [
    { id: 'a', title: 'A', text: 'Eins zwei drei.', startToken: 0, tokenCount: 0 },
    { id: 'b', title: 'B', text: 'Vier fuenf.', startToken: 0, tokenCount: 0 },
  ];

  it('writes back startToken and tokenCount and keeps indices continuous', () => {
    const copy = chapters.map((c) => ({ ...c }));
    const tokens = tokenizeChapters(copy, { wpm: 300 });
    expect(copy[0]?.startToken).toBe(0);
    expect(copy[0]?.tokenCount).toBe(3);
    expect(copy[1]?.startToken).toBe(3);
    expect(copy[1]?.tokenCount).toBe(2);
    expect(tokens).toHaveLength(5);
    expect(tokens[3]?.chapterIndex).toBe(1);
    expect(tokens[3]?.index).toBe(3);
  });
});

describe('contextAround', () => {
  const { tokens } = tokenize('eins zwei drei vier fuenf sechs sieben', { wpm: 300 });

  it('returns the neighbours of a token', () => {
    const ctx = contextAround(tokens, 3, 2);
    expect(ctx.before).toEqual(['zwei', 'drei']);
    expect(ctx.current).toBe('vier');
    expect(ctx.after).toEqual(['fuenf', 'sechs']);
  });

  it('clips at the stream boundaries instead of throwing', () => {
    expect(contextAround(tokens, 0, 3).before).toEqual([]);
    expect(contextAround(tokens, 999, 3).current).toBe('sieben');
    expect(contextAround([], 0).current).toBe('');
  });
});
