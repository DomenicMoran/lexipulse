import { describe, expect, it } from 'vitest';
import {
  pageForToken,
  pageTokenStarts,
  tokenForPage,
  tokenIndexForWord,
  wordIndexForToken,
  wordStarts,
} from './pagemap.js';
import { tokenizeChapters } from './tokenizer.js';
import type { RsvpToken } from './types.js';

function stream(spec: readonly (readonly [string, boolean])[]): RsvpToken[] {
  return spec.map(([text, continuesWord], index) => ({
    index,
    text,
    orp: 0,
    durationMs: 100,
    chapterIndex: 0,
    paragraphIndex: 0,
    sentenceIndex: 0,
    charOffset: 0,
    endsSentence: false,
    endsParagraph: false,
    isNumeric: false,
    ...(continuesWord ? { continuesWord: true } : {}),
  }));
}

describe('wordStarts', () => {
  it('counts one start per whole word', () => {
    const tokens = stream([
      ['Der', false],
      ['Bundes-', true],
      ['ausbildungs-', true],
      ['zuschuss', false],
      ['zählt', false],
    ]);
    expect(wordStarts(tokens)).toEqual([0, 1, 4]);
  });

  it('treats an unsplit stream as one word per token', () => {
    expect(wordStarts(stream([['a', false], ['b', false], ['c', false]]))).toEqual([0, 1, 2]);
  });

  it('survives an empty stream', () => {
    expect(wordStarts([])).toEqual([]);
  });
});

describe('tokenIndexForWord / wordIndexForToken', () => {
  const starts = wordStarts(
    stream([
      ['Eins', false],
      ['Sehr-', true],
      ['langes-', true],
      ['Wort', false],
      ['Drei', false],
    ]),
  );

  it('round-trips every whole word', () => {
    for (let word = 0; word < starts.length; word += 1) {
      expect(wordIndexForToken(starts, tokenIndexForWord(starts, word))).toBe(word);
    }
  });

  it('maps a fragment back to the word it belongs to', () => {
    // Tokens 1..3 are one word; all three answer "word 1".
    expect(wordIndexForToken(starts, 2)).toBe(1);
    expect(wordIndexForToken(starts, 3)).toBe(1);
  });

  it('clamps rather than throwing', () => {
    expect(tokenIndexForWord(starts, -5)).toBe(0);
    expect(tokenIndexForWord(starts, 9999)).toBe(4);
    expect(tokenIndexForWord([], 3)).toBe(0);
  });
});

describe('pageTokenStarts', () => {
  it('anchors pages to the tokens of the words they start on', () => {
    const chapters = [
      {
        id: 'c0',
        title: 'One',
        text: 'eins zwei drei vier\n\nfünf sechs sieben acht',
        startToken: 0,
        tokenCount: 0,
      },
    ];
    const tokens = tokenizeChapters(chapters, { wpm: 300 });
    // Page 1 starts at word 0, page 2 at word 4 ("fünf").
    const starts = pageTokenStarts({ pageWordStarts: [0, 4] }, tokens);

    expect(starts).not.toBeNull();
    expect(tokens[(starts as number[])[0] as number]?.text).toBe('eins');
    expect(tokens[(starts as number[])[1] as number]?.text).toBe('fünf');
  });

  it('returns null when the source had no pages', () => {
    expect(pageTokenStarts({ pageWordStarts: null }, [])).toBeNull();
    expect(pageTokenStarts({ pageWordStarts: [] }, [])).toBeNull();
  });
});

describe('pageForToken / tokenForPage', () => {
  const pageStarts = [0, 40, 40, 95];

  it('is 1-based and round-trips', () => {
    expect(pageForToken(pageStarts, 0)).toBe(1);
    expect(pageForToken(pageStarts, 39)).toBe(1);
    expect(pageForToken(pageStarts, 95)).toBe(4);
    expect(tokenForPage(pageStarts, 4)).toBe(95);
  });

  it('reports the last of several pages sharing an offset', () => {
    // Page 2 kept nothing and inherited page 3's offset; a reader at token 40 is on 3.
    expect(pageForToken(pageStarts, 40)).toBe(3);
  });

  it('clamps out-of-range pages and copes with no page structure', () => {
    expect(tokenForPage(pageStarts, 0)).toBe(0);
    expect(tokenForPage(pageStarts, 99)).toBe(95);
    expect(tokenForPage(null, 3)).toBe(0);
    expect(pageForToken(null, 12)).toBe(1);
  });
});
