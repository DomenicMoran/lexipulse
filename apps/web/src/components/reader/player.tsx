'use client';

import {
  RsvpEngine,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  contextAround,
  effectiveWpmFor,
  formatDuration,
  sentenceText,
  sentenceTextAt,
  type EngineStatus,
  type LexiDocument,
  type RsvpToken,
} from '@lexipulse/core';
import { IconButton, RsvpStage } from '@lexipulse/ui';
import * as React from 'react';
import {
  BookmarkIcon,
  ForwardIcon,
  KeyboardIcon,
  PageIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  SettingsIcon,
} from '@/components/icons';
import { useSettings } from '@/components/settings-provider';
import { formatNumber } from '@/lib/format';
import { playTick } from '@/lib/sound';
import { getStore } from '@/lib/store';
import { cancelSpeech, speak } from '@/lib/tts';
import { useFittedFontSize } from '@/lib/use-fitted-font-size';

const PROGRESS_INTERVAL_MS = 5000;

export interface PlayerProps {
  document: LexiDocument;
  tokens: RsvpToken[];
  startIndex: number;
  /** Milliseconds already spent in this document, carried over from stored progress. */
  initialMsRead: number;
  /** True when this document had no stored progress yet. */
  firstOpen: boolean;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onBookmarked: (preview: string) => void;
}

/**
 * The reading surface.
 *
 * The engine owns time, this component owns pixels and side effects: rendering, input,
 * speech, the click, the wake lock and persistence. Re-renders are driven by engine
 * events, never by the animation frame — at 900 WPM that is fifteen renders a second
 * instead of sixty.
 */
export function Player({
  document: lexiDocument,
  tokens,
  startIndex,
  initialMsRead,
  firstOpen,
  onOpenSettings,
  onOpenHelp,
  onBookmarked,
}: PlayerProps) {
  const { settings, update } = useSettings();

  // Lazy state initialiser rather than a ref assigned during render: it runs exactly once
  // and hands back a stable instance, without writing to anything mid-render.
  const [engine] = React.useState(() => new RsvpEngine({ tokens, settings, startIndex }));

  const [index, setIndex] = React.useState(startIndex);
  const [status, setStatus] = React.useState<EngineStatus>('idle');
  const [showPage, setShowPage] = React.useState(false);
  // Derived, not stored: `effectiveWpmFor` computes the rate the stream would run at
  // without touching the tokens, so there is no effect-then-setState round trip and no
  // window in which the number on screen belongs to the previous speed.
  const effective = React.useMemo(
    () => Math.round(effectiveWpmFor(tokens, settings.wpm, settings.pacing)),
    [tokens, settings.wpm, settings.pacing],
  );

  const stageRef = React.useRef<HTMLDivElement>(null);
  const fittedSize = useFittedFontSize(stageRef, { maxWordLength: 22, min: 20, max: 120, initial: 48 });
  const fontSize = Math.min(settings.fontSize, fittedSize);

  /* ------------------------------------------------------------------ persistence */

  // Wall-clock time actually spent playing, plus the tokens covered, for the session log.
  const session = React.useRef({ ms: 0, tokens: 0, since: 0, fromIndex: startIndex });
  const totalMsRead = React.useRef(initialMsRead);
  const lastSaved = React.useRef(0);
  const startCounted = React.useRef(false);

  /*
   * The engine subscription reads the current settings without being torn down and
   * rebuilt every time one of them changes — resubscribing mid-sentence would restart
   * the synthesiser.
   *
   * The write happens in an effect, not in the render body. Assigning to `ref.current`
   * while rendering is a rules-of-React violation: React may render a component twice or
   * discard the result, and the ref would then hold a value from a render that never
   * reached the screen.
   */
  const settingsRef = React.useRef(settings);
  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const closeSession = React.useCallback((finished: boolean) => {
    const state = session.current;
    if (state.since > 0) {
      state.ms += Date.now() - state.since;
      state.tokens += Math.max(0, engine.getIndex() - state.fromIndex);
      state.since = 0;
    }
    if (state.ms <= 0 && state.tokens <= 0 && !finished) return;
    const payload = { tokensRead: state.tokens, msRead: state.ms, finished };
    totalMsRead.current += state.ms;
    state.ms = 0;
    state.tokens = 0;
    void getStore()
      .then((store) => store.recordSession(payload))
      .catch(() => undefined);
  }, [engine]);

  /*
   * "Document started" is counted when a document is opened without stored progress —
   * not when a session ends. Tying it to the session close made the counter disagree
   * with "documents finished" whenever the very first session ended without a play.
   */
  React.useEffect(() => {
    if (!firstOpen || startCounted.current) return;
    startCounted.current = true;
    void getStore()
      .then((store) => store.recordSession({ tokensRead: 0, msRead: 0, started: true }))
      .catch(() => undefined);
  }, [firstOpen]);

  const persistProgress = React.useCallback(() => {
    const currentIndex = engine.getIndex();
    const token = tokens[currentIndex];
    lastSaved.current = Date.now();
    const carry = session.current.since > 0 ? Date.now() - session.current.since : 0;
    void getStore()
      .then((store) =>
        store.saveProgress({
          documentId: lexiDocument.id,
          tokenIndex: currentIndex,
          chapterIndex: token?.chapterIndex ?? 0,
          percent: tokens.length > 1 ? currentIndex / (tokens.length - 1) : 0,
          updatedAt: Date.now(),
          msRead: totalMsRead.current + session.current.ms + carry,
        }),
      )
      .catch(() => undefined);
  }, [engine, lexiDocument.id, tokens]);

  /* ---------------------------------------------------------------- engine wiring */

  React.useEffect(() => {
    return engine.subscribe((event) => {
      if (event.type === 'token') {
        setIndex(event.index);
        if (Date.now() - lastSaved.current > PROGRESS_INTERVAL_MS) persistProgress();
        return;
      }

      if (event.type === 'status') {
        setStatus(event.status);
        if (event.status === 'playing') {
          session.current.since = Date.now();
          session.current.fromIndex = engine.getIndex();
        } else {
          cancelSpeech();
          closeSession(event.status === 'finished');
          persistProgress();
        }
        if (event.status === 'playing' && settingsRef.current.ttsEnabled) {
          speak(sentenceTextAt(tokens, engine.getIndex()), {
            voiceUri: settingsRef.current.ttsVoice,
            wpm: settingsRef.current.wpm,
          });
        }
        return;
      }

      if (event.type === 'sentence') {
        if (settingsRef.current.soundEnabled) playTick();
        if (settingsRef.current.ttsEnabled) {
          speak(sentenceText(tokens, event.sentenceIndex), {
            voiceUri: settingsRef.current.ttsVoice,
            wpm: settingsRef.current.wpm,
          });
        }
      }
    });
  }, [engine, tokens, closeSession, persistProgress]);

  React.useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0;
    const loop = () => {
      engine.update();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine, status]);

  // Only the settings the engine actually consumes; theme changes must not re-pace.
  React.useEffect(() => {
    engine.updateSettings({
      wpm: settings.wpm,
      pacing: settings.pacing,
      warmupTokens: settings.warmupTokens,
      pauseOnParagraph: settings.pauseOnParagraph,
      rewindTokens: settings.rewindTokens,
    });
  }, [
    engine,
    settings.wpm,
    settings.pacing,
    settings.warmupTokens,
    settings.pauseOnParagraph,
    settings.rewindTokens,
  ]);

  React.useEffect(() => {
    if (!settings.ttsEnabled) cancelSpeech();
  }, [settings.ttsEnabled]);

  /* -------------------------------------------------------------------- wake lock */

  React.useEffect(() => {
    if (!settings.keepAwake || status !== 'playing') return;
    // Typed as always present, but Firefox and older Safari do not ship it.
    const wakeLock: WakeLock | undefined = navigator.wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    void wakeLock
      .request('screen')
      .then((lock) => {
        if (cancelled) void lock.release().catch(() => undefined);
        else sentinel = lock;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      void sentinel?.release().catch(() => undefined);
    };
  }, [settings.keepAwake, status]);

  /* ------------------------------------------------------------ leaving the page */

  const flush = React.useCallback(() => {
    // `closeSession` and `persistProgress` are idempotent, so calling them next to the
    // pause is safe — and necessary, because on unmount the event subscription is torn
    // down before this effect's cleanup runs and the pause would reach no listener.
    if (engine.getStatus() === 'playing') engine.pause();
    closeSession(false);
    persistProgress();
    cancelSpeech();
  }, [engine, closeSession, persistProgress]);

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush();
    };
  }, [flush]);

  /* -------------------------------------------------------------------- keyboard */

  const bookmark = React.useCallback(() => {
    const currentIndex = engine.getIndex();
    const token = tokens[currentIndex];
    const preview = sentenceTextAt(tokens, currentIndex).slice(0, 180);
    void getStore()
      .then((store) =>
        store.addBookmark({
          id: `${Date.now().toString(36)}-${currentIndex}`,
          documentId: lexiDocument.id,
          tokenIndex: currentIndex,
          chapterIndex: token?.chapterIndex ?? 0,
          preview,
          note: null,
          createdAt: Date.now(),
        }),
      )
      .then(() => onBookmarked(preview))
      .catch(() => undefined);
  }, [engine, tokens, lexiDocument.id, onBookmarked]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // `instanceof HTMLElement` rather than a cast: a key event can be dispatched at
      // `document` or `window`, and those have no `closest`, so a plain cast would throw
      // out of the handler and take the shortcut with it.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.closest('[role="dialog"]') !== null)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          engine.toggle();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          cancelSpeech();
          if (event.shiftKey) engine.seekSentence(-1);
          else engine.rewind();
          break;
        case 'ArrowRight':
          event.preventDefault();
          cancelSpeech();
          if (event.shiftKey) engine.seekSentence(1);
          else engine.forward();
          break;
        case 'ArrowUp':
          event.preventDefault();
          update({ wpm: Math.min(settingsRef.current.wpm + WPM_STEP, WPM_MAX) });
          break;
        case 'ArrowDown':
          event.preventDefault();
          update({ wpm: Math.max(settingsRef.current.wpm - WPM_STEP, WPM_MIN) });
          break;
        case '[': {
          event.preventDefault();
          cancelSpeech();
          const current = tokens[engine.getIndex()]?.chapterIndex ?? 0;
          engine.seekChapter(Math.max(0, current - 1));
          break;
        }
        case ']': {
          event.preventDefault();
          cancelSpeech();
          const current = tokens[engine.getIndex()]?.chapterIndex ?? 0;
          engine.seekChapter(Math.min(lexiDocument.chapters.length - 1, current + 1));
          break;
        }
        case 'b':
        case 'B':
          event.preventDefault();
          bookmark();
          break;
        case '?':
          event.preventDefault();
          onOpenHelp();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine, tokens, lexiDocument.chapters.length, bookmark, onOpenHelp, update]);

  /* ----------------------------------------------------------------------- render */

  const token = tokens[index];
  const snapshot = engine.getSnapshot();
  const chapter = lexiDocument.chapters[token?.chapterIndex ?? 0];
  const playing = status === 'playing';

  const context =
    settings.contextWords > 0 ? contextAround(tokens, index, settings.contextWords) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-[17px] font-semibold tracking-[-0.015em]">{lexiDocument.title}</h1>
        <p className="text-[13px] text-[var(--lx-text-muted)]">
          {chapter ? chapter.title : 'Kapitel 1'}
          {lexiDocument.chapters.length > 1 && (
            <span className="font-mono tabular-nums">
              {' '}
              ({(token?.chapterIndex ?? 0) + 1}/{lexiDocument.chapters.length})
            </span>
          )}
        </p>
      </div>

      <div
        ref={stageRef}
        role="button"
        tabIndex={0}
        aria-label={playing ? 'Pausieren' : 'Abspielen'}
        onClick={() => engine.toggle()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            engine.toggle();
          }
        }}
        className="flex min-h-[220px] cursor-pointer items-center justify-center rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-stage)] px-4 py-16 sm:min-h-[320px] sm:py-24"
      >
        <RsvpStage
          text={token?.text ?? ''}
          orp={token?.orp ?? 0}
          fontSize={fontSize}
          showFocusGuides={settings.showFocusGuides}
          contextBefore={context ? context.before.join(' ') : undefined}
          contextAfter={context ? context.after.join(' ') : undefined}
        />
      </div>

      {settings.showProgress && (
        <div className="flex flex-col gap-2">
          <label htmlFor="lx-scrub" className="sr-only">
            Position im Dokument
          </label>
          <input
            id="lx-scrub"
            type="range"
            className="lx-slider h-5 w-full cursor-pointer appearance-none bg-transparent"
            min={0}
            max={Math.max(tokens.length - 1, 0)}
            step={1}
            value={index}
            aria-valuetext={`Wort ${formatNumber(index + 1)} von ${formatNumber(tokens.length)}`}
            style={{
              ['--lx-slider-fill' as string]: `${
                tokens.length > 1 ? (index / (tokens.length - 1)) * 100 : 0
              }%`,
            }}
            onChange={(event) => {
              cancelSpeech();
              engine.seek(Number(event.target.value));
            }}
          />
          <div className="flex items-center justify-between font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]">
            <span>{formatDuration(snapshot.elapsedMs)}</span>
            <span>−{formatDuration(snapshot.remainingMs)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <IconButton
          label={`${settings.rewindTokens} Wörter zurück`}
          variant="secondary"
          onClick={() => {
            cancelSpeech();
            engine.rewind();
          }}
        >
          <RewindIcon />
        </IconButton>

        <button
          type="button"
          onClick={() => engine.toggle()}
          aria-label={playing ? 'Pausieren' : 'Abspielen'}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--lx-accent)] text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
        >
          {playing ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />}
        </button>

        <IconButton
          label={`${settings.rewindTokens} Wörter vor`}
          variant="secondary"
          onClick={() => {
            cancelSpeech();
            engine.forward();
          }}
        >
          <ForwardIcon />
        </IconButton>

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-[var(--lx-border)]" />

        <IconButton label="Lesezeichen setzen" variant="secondary" onClick={bookmark}>
          <BookmarkIcon />
        </IconButton>
        <IconButton
          label={showPage ? 'Fließtext schließen' : 'Fließtext anzeigen'}
          variant="secondary"
          aria-expanded={showPage}
          onClick={() => {
            // Reading the page and running the stream at once means the highlight walks
            // away while you are still finding your line, so opening it pauses.
            if (!showPage && playing) engine.pause();
            setShowPage((open) => !open);
          }}
        >
          <PageIcon />
        </IconButton>
        <IconButton label="Einstellungen" variant="secondary" onClick={onOpenSettings}>
          <SettingsIcon />
        </IconButton>
        <IconButton label="Tastatursteuerung" variant="secondary" onClick={onOpenHelp}>
          <KeyboardIcon />
        </IconButton>
      </div>

      {showPage ? (
        <PageView
          tokens={tokens}
          activeIndex={index}
          onSelect={(target) => {
            cancelSpeech();
            engine.seek(target);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <label htmlFor="lx-wpm" className="sr-only">
          Wörter pro Minute
        </label>
        <input
          id="lx-wpm"
          type="range"
          className="lx-slider h-5 w-full cursor-pointer appearance-none bg-transparent"
          min={WPM_MIN}
          max={WPM_MAX}
          step={WPM_STEP}
          value={settings.wpm}
          onChange={(event) => update({ wpm: Number(event.target.value) })}
          style={{
            ['--lx-slider-fill' as string]: `${
              ((settings.wpm - WPM_MIN) / (WPM_MAX - WPM_MIN)) * 100
            }%`,
          }}
        />

        {settings.showStats && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Eingestellt" value={`${formatNumber(settings.wpm)} WPM`} />
            <Stat label="Effektiv" value={`${formatNumber(effective)} WPM`} />
            <Stat
              label="Position"
              value={`${formatNumber(index + 1)} / ${formatNumber(tokens.length)}`}
            />
            <Stat label="Restzeit" value={formatDuration(snapshot.remainingMs)} />
          </dl>
        )}
      </div>
    </div>
  );
}

/**
 * The chapter as a page, with the current word marked.
 *
 * RSVP takes the page away, which is what makes it fast and also what makes losing the
 * thread expensive: there is nothing to look back at, only a rewind and another pass. This
 * gives the page back — and every word in it is a way into the stream.
 *
 * Only the chapter the reader is in gets rendered. A whole book of clickable words would
 * cost more than it buys, and chapters are one control away.
 */
function PageView({
  tokens,
  activeIndex,
  onSelect,
}: {
  tokens: RsvpToken[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const active = React.useRef<HTMLButtonElement | null>(null);

  const paragraphs = React.useMemo(() => {
    const chapter = tokens[activeIndex]?.chapterIndex ?? 0;
    const groups: { key: number; tokens: RsvpToken[] }[] = [];
    for (const token of tokens) {
      if (token.chapterIndex !== chapter) continue;
      const last = groups[groups.length - 1];
      if (last && last.key === token.paragraphIndex) last.tokens.push(token);
      else groups.push({ key: token.paragraphIndex, tokens: [token] });
    }
    return groups;
  }, [tokens, activeIndex]);

  // `block: 'nearest'` keeps the page still while the stream is paused on a word that is
  // already visible; without it every re-render would yank the scroll position.
  React.useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div
      className="max-h-[46vh] overflow-y-auto rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-4 py-4 sm:px-6"
      aria-label="Fließtext"
    >
      <p className="mb-3 text-[12px] text-[var(--lx-text-muted)]">
        Ein Wort anklicken, um dort weiterzulesen.
      </p>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.key} className="mb-4 text-[16px] leading-[1.75] text-[var(--lx-text)]">
          {paragraph.tokens.map((token, position) => {
            const isActive = token.index === activeIndex;
            return (
              <React.Fragment key={token.index}>
                {position === 0 ? '' : ' '}
                <button
                  ref={isActive ? active : undefined}
                  type="button"
                  onClick={() => onSelect(token.index)}
                  aria-current={isActive ? 'true' : undefined}
                  className={
                    isActive
                      ? 'rounded-[3px] bg-[var(--lx-accent)] px-[2px] text-[var(--lx-accent-on)]'
                      : 'rounded-[3px] px-[2px] hover:bg-[var(--lx-accent-soft)]'
                  }
                >
                  {token.text}
                </button>
              </React.Fragment>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--lx-border)] px-3 py-2">
      <dt className="text-[12px] text-[var(--lx-text-muted)]">{label}</dt>
      <dd className="font-mono text-[15px] tabular-nums text-[var(--lx-text)]">{value}</dd>
    </div>
  );
}
