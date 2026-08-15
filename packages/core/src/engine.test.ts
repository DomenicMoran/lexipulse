import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RsvpEngine, formatDuration, type EngineEvent } from './engine.js';
import { DEFAULT_SETTINGS } from './settings.js';
import { tokenize } from './tokenizer.js';
import type { RsvpSettings, RsvpToken } from './types.js';

const TEXT =
  'Eins zwei drei vier fuenf.\n\nSechs sieben acht neun zehn.\n\nElf zwoelf dreizehn vierzehn.';

/** Deterministic clock: tests drive time explicitly, never wall-clock. */
function makeClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
      return now;
    },
    set: (ms: number) => {
      now = ms;
      return now;
    },
  };
}

function build(overrides: Partial<RsvpSettings> = {}, text = TEXT) {
  const settings: RsvpSettings = { ...DEFAULT_SETTINGS, warmupTokens: 0, ...overrides };
  const tokens = tokenize(text, { wpm: settings.wpm, pacing: settings.pacing }).tokens;
  const clock = makeClock();
  const engine = new RsvpEngine({ tokens, settings, now: clock.now });
  return { engine, tokens, clock, settings };
}

/** Run the engine forward in 16 ms frames, like a rAF loop would. */
function runFrames(engine: RsvpEngine, clock: ReturnType<typeof makeClock>, ms: number) {
  const frames = Math.ceil(ms / 16);
  for (let i = 0; i < frames; i += 1) {
    clock.advance(16);
    engine.update(clock.now());
  }
}

describe('RsvpEngine lifecycle', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('starts idle at token 0', () => {
    const snap = ctx.engine.getSnapshot();
    expect(snap.status).toBe('idle');
    expect(snap.index).toBe(0);
    expect(snap.token?.text).toBe('Eins');
  });

  it('does not advance while idle', () => {
    runFrames(ctx.engine, ctx.clock, 5000);
    expect(ctx.engine.getIndex()).toBe(0);
  });

  it('advances exactly one token per token duration', () => {
    ctx.engine.play();
    const duration = ctx.engine.currentDurationMs();
    ctx.clock.advance(duration + 1);
    ctx.engine.update(ctx.clock.now());
    expect(ctx.engine.getIndex()).toBe(1);
  });

  it('does not drift when frames are dropped', () => {
    ctx.engine.play();
    // One giant gap must land on the same token as many small steps would.
    const budget = 3000;
    ctx.clock.advance(budget);
    ctx.engine.update(ctx.clock.now());
    const jumped = ctx.engine.getIndex();

    const stepwise = build();
    stepwise.engine.play();
    runFrames(stepwise.engine, stepwise.clock, budget);
    expect(stepwise.engine.getIndex()).toBe(jumped);
  });

  it('pauses and resumes without losing the partial dwell', () => {
    ctx.engine.play();
    const duration = ctx.engine.currentDurationMs();
    ctx.clock.advance(duration * 0.6);
    ctx.engine.update(ctx.clock.now());
    ctx.engine.pause();
    expect(ctx.engine.getIndex()).toBe(0);

    ctx.engine.play();
    ctx.clock.advance(duration * 0.45);
    ctx.engine.update(ctx.clock.now());
    // 60 % + 45 % > 100 % → the token must have flipped.
    expect(ctx.engine.getIndex()).toBe(1);
  });

  it('reaches the end and emits finish exactly once', () => {
    const events: EngineEvent[] = [];
    ctx.engine.subscribe((e) => events.push(e));
    ctx.engine.play();
    runFrames(ctx.engine, ctx.clock, 60_000);
    expect(ctx.engine.getStatus()).toBe('finished');
    expect(events.filter((e) => e.type === 'finish')).toHaveLength(1);
    expect(ctx.engine.getIndex()).toBe(ctx.tokens.length - 1);
  });

  it('restarts from the beginning when play is pressed after finishing', () => {
    ctx.engine.play();
    runFrames(ctx.engine, ctx.clock, 60_000);
    ctx.engine.play();
    expect(ctx.engine.getStatus()).toBe('playing');
    expect(ctx.engine.getIndex()).toBe(0);
  });
});

describe('RsvpEngine seeking', () => {
  it('rewinds ten tokens by default and clamps at zero', () => {
    const { engine } = build();
    engine.seek(12);
    engine.rewind();
    expect(engine.getIndex()).toBe(2);
    engine.rewind();
    expect(engine.getIndex()).toBe(0);
  });

  it('honours a custom rewind distance', () => {
    const { engine } = build({ rewindTokens: 3 });
    engine.seek(9);
    engine.rewind();
    expect(engine.getIndex()).toBe(6);
    engine.rewind(5);
    expect(engine.getIndex()).toBe(1);
  });

  it('clamps forward seeks to the last token', () => {
    const { engine, tokens } = build();
    engine.seek(9999);
    expect(engine.getIndex()).toBe(tokens.length - 1);
  });

  it('seekPercent maps 0 and 1 to the stream boundaries', () => {
    const { engine, tokens } = build();
    engine.seekPercent(1);
    expect(engine.getIndex()).toBe(tokens.length - 1);
    engine.seekPercent(0);
    expect(engine.getIndex()).toBe(0);
    engine.seekPercent(0.5);
    expect(engine.getIndex()).toBe(Math.round((tokens.length - 1) / 2));
  });

  it('restarts the current sentence before stepping to the previous one', () => {
    const { engine, tokens } = build();
    const secondSentenceStart = tokens.findIndex((t) => t.sentenceIndex === 1);
    engine.seek(secondSentenceStart + 2);
    engine.seekSentence(-1);
    expect(engine.getIndex()).toBe(secondSentenceStart);
    engine.seekSentence(-1);
    expect(engine.getIndex()).toBe(0);
  });

  it('steps forward to the next sentence start', () => {
    const { engine, tokens } = build();
    engine.seek(0);
    engine.seekSentence(1);
    expect(tokens[engine.getIndex()]?.sentenceIndex).toBe(1);
  });

  it('jumps to the start of a chapter', () => {
    const chapters = [
      { id: 'a', title: 'A', text: 'eins zwei drei', startToken: 0, tokenCount: 0 },
      { id: 'b', title: 'B', text: 'vier fuenf sechs', startToken: 0, tokenCount: 0 },
    ];
    const settings = { ...DEFAULT_SETTINGS, warmupTokens: 0 };
    // tokenizeChapters is exercised in tokenizer.test; here we only need chapterIndex.
    const tokens: RsvpToken[] = [];
    let i = 0;
    chapters.forEach((chapter, chapterIndex) => {
      for (const word of chapter.text.split(' ')) {
        tokens.push({
          index: i,
          text: word,
          orp: 1,
          durationMs: 100,
          chapterIndex,
          paragraphIndex: chapterIndex,
          sentenceIndex: chapterIndex,
          charOffset: 0,
          endsSentence: false,
          endsParagraph: false,
          isNumeric: false,
        });
        i += 1;
      }
    });
    const engine = new RsvpEngine({ tokens, settings });
    engine.seekChapter(1);
    expect(engine.getIndex()).toBe(3);
  });

  it('emits a token event on every seek', () => {
    const { engine } = build();
    const seen: number[] = [];
    engine.subscribe((e) => {
      if (e.type === 'token') seen.push(e.index);
    });
    engine.seek(4);
    engine.seek(2);
    expect(seen).toEqual([4, 2]);
  });
});

describe('RsvpEngine events', () => {
  it('emits sentence and paragraph events at the right boundaries', () => {
    const { engine, clock } = build();
    const sentences: number[] = [];
    const paragraphs: number[] = [];
    engine.subscribe((e) => {
      if (e.type === 'sentence') sentences.push(e.sentenceIndex);
      if (e.type === 'paragraph') paragraphs.push(e.paragraphIndex);
    });
    engine.play();
    runFrames(engine, clock, 60_000);
    expect(sentences).toEqual([1, 2]);
    expect(paragraphs).toEqual([1, 2]);
  });

  it('stops notifying after unsubscribe', () => {
    const { engine } = build();
    const listener = vi.fn();
    const off = engine.subscribe(listener);
    engine.seek(3);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    engine.seek(5);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('RsvpEngine pauseOnParagraph', () => {
  it('stops at the paragraph end and continues on the next play', () => {
    const { engine, clock, tokens } = build({ pauseOnParagraph: true });
    engine.play();
    runFrames(engine, clock, 60_000);

    const firstParagraphEnd = tokens.findIndex((t) => t.endsParagraph);
    expect(engine.getStatus()).toBe('paused');
    expect(engine.getIndex()).toBe(firstParagraphEnd);

    engine.play();
    runFrames(engine, clock, 60_000);
    // Second paragraph end, not stuck on the first.
    const secondParagraphEnd = tokens.findIndex(
      (t, i) => t.endsParagraph && i > firstParagraphEnd,
    );
    expect(engine.getIndex()).toBe(secondParagraphEnd);
  });
});

describe('RsvpEngine warm-up ramp', () => {
  it('starts slower than the target pace and reaches it after the ramp', () => {
    const { engine } = build({ warmupTokens: 10 });
    engine.play();
    const first = engine.currentDurationMs();
    const nominal = engine.getTokens()[0]?.durationMs ?? 0;
    // 40 % of target WPM → 2.5× the dwell.
    expect(first).toBeCloseTo(nominal * 2.5, 5);
    expect(engine.getSnapshot().warmupFactor).toBeCloseTo(2.5, 5);
  });

  it('is disabled when warmupTokens is 0', () => {
    const { engine } = build({ warmupTokens: 0 });
    engine.play();
    expect(engine.getSnapshot().warmupFactor).toBe(1);
  });
});

describe('RsvpEngine settings changes', () => {
  it('setWpm repaces the stream and halves the total time when doubled', () => {
    const { engine } = build({ wpm: 300 });
    const before = engine.totalMs();
    engine.setWpm(600);
    expect(engine.totalMs()).toBeCloseTo(before / 2, 5);
  });

  it('clamps an out-of-range WPM instead of producing absurd timings', () => {
    const { engine } = build();
    engine.setWpm(99_999);
    expect(engine.getSettings().wpm).toBe(1200);
  });

  it('keeps the current index when the pace changes mid-document', () => {
    const { engine } = build();
    engine.seek(7);
    engine.setWpm(800);
    expect(engine.getIndex()).toBe(7);
  });

  it('setTokens swaps the document and resets to idle', () => {
    const { engine } = build();
    const next = tokenize('Ganz neuer Text hier.', { wpm: 300 }).tokens;
    engine.setTokens(next);
    expect(engine.getStatus()).toBe('idle');
    expect(engine.getIndex()).toBe(0);
    expect(engine.getSnapshot().token?.text).toBe('Ganz');
  });
});

describe('RsvpEngine snapshot', () => {
  it('reports percent, elapsed and remaining consistently', () => {
    const { engine, tokens } = build();
    engine.seek(0);
    expect(engine.getSnapshot().percent).toBe(0);
    expect(engine.getSnapshot().elapsedMs).toBe(0);

    engine.seek(tokens.length - 1);
    const snap = engine.getSnapshot();
    expect(snap.percent).toBe(1);
    expect(snap.elapsedMs + snap.remainingMs).toBeCloseTo(engine.totalMs(), 5);
  });

  it('survives an empty token stream', () => {
    const engine = new RsvpEngine({ tokens: [], settings: DEFAULT_SETTINGS });
    engine.play();
    engine.update(1);
    const snap = engine.getSnapshot();
    expect(snap.token).toBeNull();
    expect(snap.percent).toBe(0);
    expect(snap.status).toBe('idle');
  });
});

describe('formatDuration', () => {
  it('formats below and above an hour', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});
