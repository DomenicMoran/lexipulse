import { DEFAULT_PACING, clampWpm, estimateDurationMs, repaceTokens } from './pacing.js';
import type { PacingMatrix, RsvpSettings, RsvpToken } from './types.js';

export type EngineStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface EngineSnapshot {
  status: EngineStatus;
  /** Index of the token currently on screen. */
  index: number;
  token: RsvpToken | null;
  /** 0–1 across the whole document. */
  percent: number;
  /** Milliseconds of content left at the current pacing. */
  remainingMs: number;
  /** Milliseconds already consumed. */
  elapsedMs: number;
  chapterIndex: number;
  /** Live multiplier applied by the warm-up ramp (1 = full speed). */
  warmupFactor: number;
}

export type EngineEvent =
  | { type: 'token'; index: number; token: RsvpToken; previousIndex: number }
  | { type: 'status'; status: EngineStatus; previous: EngineStatus }
  | { type: 'sentence'; index: number; sentenceIndex: number }
  | { type: 'paragraph'; index: number; paragraphIndex: number }
  | { type: 'chapter'; index: number; chapterIndex: number }
  | { type: 'finish' };

export type EngineListener = (event: EngineEvent) => void;

export interface RsvpEngineOptions {
  tokens: RsvpToken[];
  settings: RsvpSettings;
  /** Start position. Clamped into range. */
  startIndex?: number;
  /** Injectable clock so tests stay deterministic. Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Deterministic, render-agnostic RSVP state machine.
 *
 * The engine owns *when* a word changes; the host owns *how* it is drawn. It is driven
 * by `update(now)` from a rAF loop on web and a timer on native, and it consumes an
 * absolute clock rather than deltas so a dropped frame cannot make the stream drift.
 */
export class RsvpEngine {
  private tokens: RsvpToken[];
  private settings: RsvpSettings;
  private status: EngineStatus = 'idle';
  private index = 0;
  private tokenStartedAt = 0;
  private carryMs = 0;
  private tokensSinceResume = 0;
  private elapsedMs = 0;
  /** Set when `pauseOnParagraph` fired, so resuming does not re-trigger on the same token. */
  private paragraphPauseArmed = true;
  private readonly listeners = new Set<EngineListener>();
  private readonly now: () => number;
  private prefixMs: number[] = [];

  constructor(options: RsvpEngineOptions) {
    this.tokens = options.tokens;
    this.settings = { ...options.settings, wpm: clampWpm(options.settings.wpm) };
    this.now = options.now ?? (() => Date.now());
    this.rebuildPrefix();
    this.index = this.clampIndex(options.startIndex ?? 0);
    this.elapsedMs = this.prefixMs[this.index] ?? 0;
  }

  // ---------------------------------------------------------------- lifecycle

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private setStatus(status: EngineStatus): void {
    if (this.status === status) return;
    const previous = this.status;
    this.status = status;
    this.emit({ type: 'status', status, previous });
  }

  // ------------------------------------------------------------------ control

  play(): void {
    if (this.tokens.length === 0) return;
    if (this.status === 'finished') this.seek(0);
    // Resuming keeps the partial dwell recorded by pause(); a fresh start discards it.
    const resuming = this.status === 'paused';
    this.tokenStartedAt = this.now();
    if (!resuming) this.carryMs = 0;
    this.tokensSinceResume = 0;
    this.setStatus('playing');
  }

  pause(): void {
    if (this.status !== 'playing') return;
    // Preserve how far into the current token we were, so resume is seamless.
    const spent = this.now() - this.tokenStartedAt + this.carryMs;
    this.carryMs = Math.min(Math.max(spent, 0), this.currentDurationMs());
    this.setStatus('paused');
  }

  toggle(): void {
    if (this.status === 'playing') this.pause();
    else this.play();
  }

  stop(): void {
    this.carryMs = 0;
    this.tokensSinceResume = 0;
    this.setStatus('idle');
  }

  /** Advance the stream to `now`. Safe to call at any frequency, including 0 Hz gaps. */
  update(now: number = this.now()): void {
    if (this.status !== 'playing' || this.tokens.length === 0) return;

    let guard = 0;
    for (;;) {
      const duration = this.currentDurationMs();
      const spent = now - this.tokenStartedAt + this.carryMs;
      if (spent < duration) break;

      const token = this.tokens[this.index] as RsvpToken;
      if (this.settings.pauseOnParagraph && token.endsParagraph && this.paragraphPauseArmed) {
        this.paragraphPauseArmed = false;
        this.carryMs = 0;
        this.setStatus('paused');
        return;
      }

      if (this.index >= this.tokens.length - 1) {
        this.elapsedMs = this.totalMs();
        this.setStatus('finished');
        this.emit({ type: 'finish' });
        return;
      }

      this.tokenStartedAt += duration - this.carryMs;
      this.carryMs = 0;
      this.advanceTo(this.index + 1);

      // Defensive: a pathological 0 ms duration must not spin forever.
      guard += 1;
      if (guard > 5000) break;
    }
  }

  private advanceTo(next: number): void {
    const previousIndex = this.index;
    const previous = this.tokens[previousIndex] as RsvpToken | undefined;
    this.index = next;
    this.tokensSinceResume += 1;
    this.paragraphPauseArmed = true;
    this.elapsedMs = this.prefixMs[next] ?? this.elapsedMs;
    const token = this.tokens[next] as RsvpToken;

    this.emit({ type: 'token', index: next, token, previousIndex });
    if (previous) {
      if (previous.endsSentence) {
        this.emit({ type: 'sentence', index: next, sentenceIndex: token.sentenceIndex });
      }
      if (previous.endsParagraph) {
        this.emit({ type: 'paragraph', index: next, paragraphIndex: token.paragraphIndex });
      }
      if (previous.chapterIndex !== token.chapterIndex) {
        this.emit({ type: 'chapter', index: next, chapterIndex: token.chapterIndex });
      }
    }
  }

  // ----------------------------------------------------------------- seeking

  seek(index: number): void {
    const target = this.clampIndex(index);
    if (target === this.index) {
      this.resetTiming();
      return;
    }
    const previousIndex = this.index;
    this.index = target;
    this.elapsedMs = this.prefixMs[target] ?? 0;
    this.resetTiming();
    if (this.status === 'finished' && target < this.tokens.length - 1) this.setStatus('paused');
    const token = this.tokens[target];
    if (token) this.emit({ type: 'token', index: target, token, previousIndex });
  }

  /** Jump back `rewindTokens` words (default 10) — the "I lost the thread" gesture. */
  rewind(tokens?: number): void {
    this.seek(this.index - (tokens ?? this.settings.rewindTokens));
  }

  forward(tokens?: number): void {
    this.seek(this.index + (tokens ?? this.settings.rewindTokens));
  }

  /** Move to the first token of the previous / next sentence. */
  seekSentence(direction: -1 | 1): void {
    const current = this.tokens[this.index];
    if (!current) return;
    const targetSentence = current.sentenceIndex + direction;
    if (direction === 1) {
      for (let i = this.index; i < this.tokens.length; i += 1) {
        if ((this.tokens[i] as RsvpToken).sentenceIndex >= targetSentence) return this.seek(i);
      }
      return this.seek(this.tokens.length - 1);
    }
    // Backwards: if we are mid-sentence, restart the current one first.
    const startOfCurrent = this.startOfSentence(current.sentenceIndex);
    if (this.index > startOfCurrent) return this.seek(startOfCurrent);
    return this.seek(this.startOfSentence(current.sentenceIndex - 1));
  }

  seekParagraph(direction: -1 | 1): void {
    const current = this.tokens[this.index];
    if (!current) return;
    if (direction === 1) {
      for (let i = this.index; i < this.tokens.length; i += 1) {
        if ((this.tokens[i] as RsvpToken).paragraphIndex > current.paragraphIndex) {
          return this.seek(i);
        }
      }
      return this.seek(this.tokens.length - 1);
    }
    const startOfCurrent = this.startOfParagraph(current.paragraphIndex);
    if (this.index > startOfCurrent) return this.seek(startOfCurrent);
    return this.seek(this.startOfParagraph(current.paragraphIndex - 1));
  }

  seekChapter(chapterIndex: number): void {
    for (let i = 0; i < this.tokens.length; i += 1) {
      if ((this.tokens[i] as RsvpToken).chapterIndex === chapterIndex) return this.seek(i);
    }
  }

  /** Seek by fraction of the document — the scrubber's contract. */
  seekPercent(percent: number): void {
    const clamped = Math.min(Math.max(percent, 0), 1);
    this.seek(Math.round(clamped * Math.max(this.tokens.length - 1, 0)));
  }

  private startOfSentence(sentenceIndex: number): number {
    if (sentenceIndex < 0) return 0;
    for (let i = 0; i < this.tokens.length; i += 1) {
      if ((this.tokens[i] as RsvpToken).sentenceIndex === sentenceIndex) return i;
    }
    return 0;
  }

  private startOfParagraph(paragraphIndex: number): number {
    if (paragraphIndex < 0) return 0;
    for (let i = 0; i < this.tokens.length; i += 1) {
      if ((this.tokens[i] as RsvpToken).paragraphIndex === paragraphIndex) return i;
    }
    return 0;
  }

  // ---------------------------------------------------------------- settings

  setWpm(wpm: number): void {
    this.settings = { ...this.settings, wpm: clampWpm(wpm) };
    repaceTokens(this.tokens, this.settings.wpm, this.settings.pacing);
    this.rebuildPrefix();
    this.resetTiming();
  }

  setPacing(pacing: PacingMatrix): void {
    this.settings = { ...this.settings, pacing };
    repaceTokens(this.tokens, this.settings.wpm, pacing);
    this.rebuildPrefix();
    this.resetTiming();
  }

  updateSettings(patch: Partial<RsvpSettings>): void {
    const next = { ...this.settings, ...patch };
    const repace =
      (patch.wpm !== undefined && patch.wpm !== this.settings.wpm) || patch.pacing !== undefined;
    next.wpm = clampWpm(next.wpm);
    this.settings = next;
    if (repace) {
      repaceTokens(this.tokens, next.wpm, next.pacing ?? DEFAULT_PACING);
      this.rebuildPrefix();
      this.resetTiming();
    }
  }

  getSettings(): RsvpSettings {
    return this.settings;
  }

  /** Swap the token stream (new document / new chapter) and reset to `startIndex`. */
  setTokens(tokens: RsvpToken[], startIndex = 0): void {
    this.tokens = tokens;
    repaceTokens(this.tokens, this.settings.wpm, this.settings.pacing);
    this.rebuildPrefix();
    this.index = this.clampIndex(startIndex);
    this.elapsedMs = this.prefixMs[this.index] ?? 0;
    this.resetTiming();
    this.setStatus('idle');
  }

  // ------------------------------------------------------------------- state

  getSnapshot(): EngineSnapshot {
    const token = this.tokens[this.index] ?? null;
    const total = this.totalMs();
    return {
      status: this.status,
      index: this.index,
      token,
      percent: this.tokens.length > 1 ? this.index / (this.tokens.length - 1) : 0,
      remainingMs: Math.max(total - this.elapsedMs, 0),
      elapsedMs: this.elapsedMs,
      chapterIndex: token?.chapterIndex ?? 0,
      warmupFactor: this.warmupFactor(),
    };
  }

  getTokens(): readonly RsvpToken[] {
    return this.tokens;
  }

  getIndex(): number {
    return this.index;
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  /** Milliseconds the current token still has on screen — drives the tick indicator. */
  currentDurationMs(): number {
    const token = this.tokens[this.index];
    if (!token) return 0;
    return token.durationMs * this.warmupFactor();
  }

  totalMs(): number {
    return this.prefixMs[this.prefixMs.length - 1] ?? 0;
  }

  // ----------------------------------------------------------------- internal

  /**
   * Warm-up ramp: after every resume the first `warmupTokens` words run slower and
   * accelerate to the target WPM. Dropping straight into 900 WPM from a standstill is
   * the single biggest cause of "I read nothing" in RSVP apps.
   */
  private warmupFactor(): number {
    const warmup = this.settings.warmupTokens;
    if (warmup <= 0 || this.tokensSinceResume >= warmup) return 1;
    const progress = this.tokensSinceResume / warmup;
    const wpmFraction = 0.4 + 0.6 * progress;
    return 1 / wpmFraction;
  }

  private resetTiming(): void {
    this.tokenStartedAt = this.now();
    this.carryMs = 0;
    this.tokensSinceResume = 0;
    this.paragraphPauseArmed = true;
  }

  private clampIndex(index: number): number {
    if (this.tokens.length === 0) return 0;
    return Math.min(Math.max(Math.round(index), 0), this.tokens.length - 1);
  }

  /** prefixMs[i] = milliseconds of content before token i. Makes seeking O(1). */
  private rebuildPrefix(): void {
    const prefix = new Array<number>(this.tokens.length + 1);
    prefix[0] = 0;
    for (let i = 0; i < this.tokens.length; i += 1) {
      prefix[i + 1] = (prefix[i] as number) + (this.tokens[i] as RsvpToken).durationMs;
    }
    this.prefixMs = prefix;
  }
}

/** Milliseconds needed to read `tokens` at the given settings — for "8 min" badges. */
export function readingTimeMs(tokens: readonly RsvpToken[]): number {
  return estimateDurationMs(tokens);
}

/** `mm:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
