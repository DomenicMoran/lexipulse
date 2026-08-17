'use client';

import {
  RsvpEngine,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  annotationsAt,
  bionicPrefix,
  contextAround,
  effectiveWpmFor,
  formatDuration,
  paragraphsOf,
  sentenceText,
  sentenceTextAt,
  textOfRange,
  type Annotation,
  type EngineStatus,
  type HighlightColor,
  type LexiDocument,
  type OverlayKey,
  type ReaderFontKey,
  type RsvpToken,
} from '@lexipulse/core';
import { Button, IconButton, RsvpStage } from '@lexipulse/ui';
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
import {
  AnnotationList,
  HIGHLIGHT_WASHES,
  HighlightBar,
  HighlightIcon,
} from '@/components/reader/highlights';
import { SearchDialog, SearchIcon } from '@/components/reader/search-dialog';
import {
  clearSelection,
  hasTextSelection,
  selectedTokenRange,
  type TokenRange,
} from '@/components/reader/text-selection';
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
  const [showSearch, setShowSearch] = React.useState(false);
  const [showMarks, setShowMarks] = React.useState(false);
  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);

  // Stable identity, or the memo on each paragraph never holds and the whole chapter
  // re-renders on every word.
  const seekFromPage = React.useCallback(
    (target: number) => {
      // A click that ends a drag over the text is a marking gesture, not a jump — moving
      // the stream there would throw away the selection the reader just made.
      if (hasTextSelection()) return;
      cancelSpeech();
      engine.seek(target);
    },
    [engine],
  );

  /** Jumping in from search or the mark list: pause, so the reader lands on a still page. */
  const seekAndPause = React.useCallback(
    (target: number) => {
      cancelSpeech();
      if (engine.getStatus() === 'playing') engine.pause();
      engine.seek(target);
    },
    [engine],
  );

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

  /* ----------------------------------------------------------------- annotations */

  /*
   * Reading the marks is a subscription to an external system, so the state is written
   * from the promise callback rather than from the effect body — a synchronous setState
   * in an effect is a cascading render, and the compiler rightly refuses it.
   */
  const loadAnnotations = React.useCallback(
    () =>
      getStore()
        .then((store) => store.listAnnotations(lexiDocument.id))
        .then(setAnnotations)
        .catch(() => undefined),
    [lexiDocument.id],
  );

  React.useEffect(() => {
    void loadAnnotations();
  }, [loadAnnotations]);

  const addHighlight = React.useCallback(
    (range: TokenRange, color: HighlightColor) => {
      const now = Date.now();
      const annotation: Annotation = {
        id: `hl_${now.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
        documentId: lexiDocument.id,
        startToken: range.start,
        endToken: range.end,
        chapterIndex: tokens[range.start]?.chapterIndex ?? 0,
        color,
        text: textOfRange(tokens, range.start, range.end),
        note: null,
        createdAt: now,
        updatedAt: now,
      };
      void getStore()
        .then((store) => store.saveAnnotation(annotation))
        .then(loadAnnotations)
        .catch(() => undefined);
    },
    [lexiDocument.id, tokens, loadAnnotations],
  );

  const saveAnnotation = React.useCallback(
    (annotation: Annotation) => {
      void getStore()
        .then((store) => store.saveAnnotation({ ...annotation, updatedAt: Date.now() }))
        .then(loadAnnotations)
        .catch(() => undefined);
    },
    [loadAnnotations],
  );

  const recolorAnnotation = React.useCallback(
    (annotation: Annotation, color: HighlightColor) => saveAnnotation({ ...annotation, color }),
    [saveAnnotation],
  );

  const noteAnnotation = React.useCallback(
    (annotation: Annotation, note: string) =>
      saveAnnotation({ ...annotation, note: note.length > 0 ? note : null }),
    [saveAnnotation],
  );

  const removeAnnotation = React.useCallback(
    (annotation: Annotation) => {
      void getStore()
        .then((store) => store.deleteAnnotation(lexiDocument.id, annotation.id))
        .then(loadAnnotations)
        .catch(() => undefined);
    },
    [lexiDocument.id, loadAnnotations],
  );

  const chapterTitles = React.useMemo(
    () => lexiDocument.chapters.map((chapter) => chapter.title),
    [lexiDocument.chapters],
  );

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
        <IconButton
          label="Im Dokument suchen"
          variant="secondary"
          aria-expanded={showSearch}
          onClick={() => setShowSearch(true)}
        >
          <SearchIcon />
        </IconButton>
        <IconButton
          label={
            showMarks
              ? 'Markierungen schließen'
              : `Markierungen anzeigen (${formatNumber(annotations.length)})`
          }
          variant="secondary"
          aria-expanded={showMarks}
          onClick={() => setShowMarks((open) => !open)}
        >
          <HighlightIcon />
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
          annotations={annotations}
          onSelect={seekFromPage}
          onHighlight={addHighlight}
        />
      ) : null}

      {showMarks ? (
        <AnnotationList
          annotations={annotations}
          chapterTitles={chapterTitles}
          onJump={seekAndPause}
          onColor={recolorAnnotation}
          onNote={noteAnnotation}
          onDelete={removeAnnotation}
        />
      ) : null}

      {showSearch ? (
        <SearchDialog
          tokens={tokens}
          chapters={lexiDocument.chapters}
          onSelect={(target) => {
            seekAndPause(target);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
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
 * Page-mode typefaces, resolved to the faces this app actually ships.
 *
 * The RSVP stage wants a monospace face — the fixation column only holds still if every
 * character is the same width. Running prose wants the opposite, so page mode carries its
 * own font setting instead of borrowing the player's.
 */
const READER_FONT_STACKS: Record<ReaderFontKey, string> = {
  literata: "var(--lx-font-literata), Georgia, 'Times New Roman', serif",
  inter: 'var(--lx-font-inter), -apple-system, BlinkMacSystemFont, sans-serif',
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  // Self-hosted via @font-face in globals.css rather than next/font, so the file is only
  // fetched once a reader actually selects it. A locally installed copy still wins.
  'open-dyslexic':
    "'OpenDyslexic', 'Open Dyslexic', -apple-system, BlinkMacSystemFont, sans-serif",
};

/**
 * Irlen-style tints, laid over the page at low alpha.
 *
 * They help some readers with visual stress and do nothing for others, which is why they
 * are a choice and not a default. The layer covers the text as well as the page, so the
 * alpha decides whether the feature stays usable: measured across all four themes and all
 * six tints at 0.10, the worst case is Sepia with cream at 7.93:1, against 4.5:1 for AA
 * and 7:1 for AAA body text. A tint that makes the page prettier and the text unreadable
 * helps nobody.
 */
const OVERLAY_TINTS: Record<OverlayKey, string | null> = {
  none: null,
  cream: 'rgba(255, 246, 214, 0.10)',
  peach: 'rgba(255, 214, 186, 0.10)',
  rose: 'rgba(255, 200, 214, 0.10)',
  mint: 'rgba(196, 245, 220, 0.10)',
  sky: 'rgba(196, 226, 255, 0.10)',
  lilac: 'rgba(222, 208, 255, 0.10)',
};

/**
 * Auto-scroll step, in milliseconds.
 *
 * A reader scrolls at twenty to sixty pixels a second. Driving that from the animation
 * frame would ask for sixty repaints to move a single pixel, which is battery spent on
 * something nobody can see. One step every eighth of a second moves a visible amount and
 * costs the compositor almost nothing.
 */
const AUTO_SCROLL_STEP_MS = 120;

/** Pixels the ruler grows on each side per step above the first. */
const RULER_GROWTH = 2;

/**
 * The document as a page, with the current word marked.
 *
 * RSVP takes the page away, which is what makes it fast and also what makes losing the
 * thread expensive: there is nothing to look back at, only a rewind and another pass. This
 * gives the page back — the whole document, not just the chapter — and every word in it is
 * a way into the stream.
 *
 * Typography is set once on the scroll container and inherited. That is not only less
 * markup: it keeps the per-paragraph memo out of the settings' reach, so moving the
 * line-height slider does not have to re-render a book's worth of buttons.
 */
function PageView({
  tokens,
  activeIndex,
  annotations,
  onSelect,
  onHighlight,
}: {
  tokens: RsvpToken[];
  activeIndex: number;
  annotations: Annotation[];
  onSelect: (index: number) => void;
  onHighlight: (range: TokenRange, color: HighlightColor) => void;
}) {
  const { settings } = useSettings();
  const active = React.useRef<HTMLButtonElement | null>(null);
  const page = React.useRef<HTMLDivElement>(null);
  const band = React.useRef<HTMLDivElement>(null);
  const [selection, setSelection] = React.useState<TokenRange | null>(null);
  const [paging, setPaging] = React.useState({ index: 0, count: 1 });

  const paged = settings.readerPaged;
  const margin = settings.readerMargin;
  const ruler = settings.readerRuler;

  // Grouping depends on the token stream, nothing else. Keying this on `activeIndex`
  // walked the whole array again for every word the stream advanced.
  const paragraphs = React.useMemo(() => paragraphsOf(tokens), [tokens]);

  /*
   * One array per marked paragraph, and the same frozen empty array for all the others.
   * Adding a highlight rebuilds this map, but only the paragraphs that actually carry a
   * mark get a new array — everyone else keeps an identical prop and memo skips them.
   */
  const marksByParagraph = React.useMemo(() => {
    const map = new Map<number, Annotation[]>();
    if (annotations.length === 0) return map;
    for (const paragraph of paragraphs) {
      const covering = annotations.filter(
        (mark) => mark.startToken <= paragraph.lastToken && mark.endToken >= paragraph.firstToken,
      );
      if (covering.length > 0) map.set(paragraph.key, covering);
    }
    return map;
  }, [paragraphs, annotations]);

  /**
   * Bring the marked word into view.
   *
   * `block: 'nearest'` keeps the page still while the stream is paused on a word that is
   * already visible; without it every re-render would yank the scroll position. Paged mode
   * moves in whole pages instead, never to a spot halfway across one, and it moves without
   * animation: a smooth scroll would run the reader past every page in between.
   */
  const showActive = React.useCallback(() => {
    const container = page.current;
    const word = active.current;
    if (container === null || word === null) return;
    if (!paged) {
      word.scrollIntoView({ block: 'nearest' });
      return;
    }
    const width = container.clientWidth;
    if (width === 0) return;
    const target = Math.floor(offsetInScroller(container, word).left / width) * width;
    if (Math.abs(container.scrollLeft - target) > 1) container.scrollLeft = target;
  }, [paged]);

  /**
   * Put the ruler on the line the reading position falls on.
   *
   * The band is an absolutely positioned child of the scroll container, so it belongs to
   * the scrolled content and follows the text without a scroll listener. Its place is
   * measured off the marked word rather than off the paragraph: a paragraph wraps where
   * the browser decides, and its top edge is the start of the paragraph, not of the line
   * being read. The word's own box is exactly one line tall, because an inline-block takes
   * the line height of its content.
   */
  const drawRuler = React.useCallback(() => {
    const layer = band.current;
    if (layer === null) return;
    const container = page.current;
    const word = active.current;
    const width = container?.clientWidth ?? 0;
    if (ruler === 0 || container === null || word === null || width === 0) {
      layer.style.display = 'none';
      return;
    }
    const { top, left } = offsetInScroller(container, word);
    // Grown symmetrically around the line, so a stronger setting gives a wider band
    // without shifting it off the words it is meant to mark.
    const grow = (ruler - 1) * RULER_GROWTH;
    const height = word.getBoundingClientRect().height;
    layer.style.display = 'block';
    layer.style.top = `${top - grow}px`;
    layer.style.height = `${height + grow * 2}px`;
    // Every page is exactly one container width wide, so the page a word sits on is that
    // division and nothing else. While scrolling there is no horizontal overflow and the
    // term is always zero, which is why both modes share the line.
    layer.style.left = `${Math.floor(left / width) * width}px`;
    layer.style.width = `${width}px`;
  }, [ruler]);

  /**
   * Read the page number off the scroll offset.
   *
   * Pagination is the browser's: the text is laid out as a single column with a definite
   * height, so everything that does not fit spills into further columns beside it. That is
   * one CSS declaration against a reimplementation of line breaking in JavaScript, it
   * never splits a line, and it leaves selection and highlights working because the words
   * are still ordinary elements in ordinary paragraphs. The container's own padding
   * supplies the margin on both sides of every page, which makes each page boundary a
   * whole multiple of the container width.
   */
  const measurePages = React.useCallback(() => {
    const container = page.current;
    if (container === null) return;
    const width = container.clientWidth;
    if (width === 0) return;
    const count = Math.max(1, Math.round(container.scrollWidth / width));
    const index = Math.min(count - 1, Math.max(0, Math.round(container.scrollLeft / width)));
    setPaging((previous) =>
      previous.index === index && previous.count === count ? previous : { index, count },
    );
  }, []);

  const turnPage = React.useCallback(
    (delta: number) => {
      const container = page.current;
      if (container === null) return;
      const width = container.clientWidth;
      if (width === 0) return;
      const count = Math.max(1, Math.round(container.scrollWidth / width));
      const next = Math.min(count - 1, Math.max(0, Math.round(container.scrollLeft / width) + delta));
      // The scroll event that follows updates the counter, so the offset stays the one
      // source of truth for which page is on screen.
      container.scrollLeft = next * width;
    },
    [],
  );

  React.useEffect(() => {
    showActive();
    drawRuler();
    // A paragraph that was off screen a moment ago has no laid-out lines yet, so the first
    // measurement can land on a box that does not exist. One frame later it does.
    const frame = requestAnimationFrame(drawRuler);
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, showActive, drawRuler]);

  /*
   * Typography decides where the lines break, so a change to it invalidates both the band
   * and the page count. Taken one frame later, because the new metrics only exist once the
   * browser has laid the text out again.
   */
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      measurePages();
      drawRuler();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    drawRuler,
    measurePages,
    paragraphs,
    paged,
    margin,
    settings.readerFont,
    settings.readerFontSize,
    settings.readerLineHeight,
    settings.readerJustify,
  ]);

  React.useEffect(() => {
    const container = page.current;
    if (container === null) return;
    // Fires once when the observation starts, which is also how the first page count is
    // taken without writing state from an effect body.
    const observer = new ResizeObserver(() => {
      measurePages();
      drawRuler();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [measurePages, drawRuler]);

  /*
   * Auto-scroll, in pixels per second.
   *
   * Page turning is the opposite of scrolling, which is what its own setting says:
   * "Blättern statt Scrollen". Letting both run would drift the page out from under the
   * reader while a page number counts along, so paged mode wins here as well as in the
   * settings sheet, where the slider is hidden outright.
   */
  React.useEffect(() => {
    const speed = settings.readerAutoScroll;
    if (speed === 0 || paged) return;
    const container = page.current;
    if (container === null) return;
    const timer = window.setInterval(() => {
      const remaining = container.scrollHeight - container.clientHeight - container.scrollTop;
      if (remaining <= 0.5) {
        window.clearInterval(timer);
        return;
      }
      container.scrollTop += (speed * AUTO_SCROLL_STEP_MS) / 1000;
    }, AUTO_SCROLL_STEP_MS);
    return () => window.clearInterval(timer);
  }, [paged, settings.readerAutoScroll]);

  // Stable, because the paragraphs below must not see a new handler on every render.
  const readSelection = React.useCallback(() => {
    const container = page.current;
    setSelection(container ? selectedTokenRange(container) : null);
  }, []);

  const mark = React.useCallback(
    (color: HighlightColor) => {
      if (selection === null) return;
      onHighlight(selection, color);
      clearSelection();
      setSelection(null);
    },
    [selection, onHighlight],
  );

  const dropSelection = React.useCallback(() => {
    clearSelection();
    setSelection(null);
  }, []);

  const preview = React.useMemo(
    () =>
      selection === null ? '' : textOfRange(tokens, selection.start, selection.end).slice(0, 160),
    [selection, tokens],
  );

  const tint = OVERLAY_TINTS[settings.readerOverlay];

  return (
    <div>
      <div className="relative">
        <div
          ref={page}
          role="region"
          aria-label="Fließtext"
          onMouseUp={readSelection}
          onKeyUp={readSelection}
          onTouchEnd={readSelection}
          onScroll={paged ? measurePages : undefined}
          className={
            'relative select-text rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] py-4 text-[var(--lx-text)] ' +
            (paged ? 'h-[46vh] overflow-x-auto overflow-y-hidden' : 'max-h-[46vh] overflow-y-auto')
          }
          style={{
            fontFamily: READER_FONT_STACKS[settings.readerFont],
            fontSize: `${settings.readerFontSize}px`,
            lineHeight: settings.readerLineHeight,
            paddingInline: `${margin}px`,
            textAlign: settings.readerJustify ? 'justify' : 'left',
          }}
        >
          {/* Positioned and drawn before the text, which is the only way it stays under it:
              two positioned siblings paint in tree order, an unpositioned one always
              below both. Sized from the measurement, so it carries no layout of its own. */}
          <div
            ref={band}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[3px] bg-[var(--lx-accent-soft)]"
            style={{ display: 'none' }}
          />
          <div
            className="relative"
            style={
              paged
                ? {
                    // One column of exactly the container's inner width, with a definite
                    // height: everything that does not fit spills into the next column
                    // beside it, and the gap becomes the facing margins of two pages.
                    height: '100%',
                    columnCount: 1,
                    columnGap: `${margin * 2}px`,
                  }
                : undefined
            }
          >
            <p className="mb-3 text-left text-[12px] leading-normal text-[var(--lx-text-muted)]">
              Ein Wort anklicken, um dort weiterzulesen. Eine Passage mit der Maus auswählen, um
              sie zu markieren.
            </p>
            {paragraphs.map((paragraph) => (
              <PageParagraph
                key={paragraph.key}
                tokens={paragraph.tokens}
                // Every other paragraph gets the same `-1` on every word the stream
                // advances, so memo sees no change and skips it. Without this the whole
                // document re-rendered several times a second — thousands of buttons at
                // 350 words per minute, which froze the tab outright.
                activeIndex={
                  activeIndex >= paragraph.firstToken && activeIndex <= paragraph.lastToken
                    ? activeIndex
                    : -1
                }
                activeRef={active}
                bionic={settings.readerBionic}
                marks={marksByParagraph.get(paragraph.key) ?? NO_MARKS}
                paged={paged}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
        {tint !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[14px]"
            style={{ backgroundColor: tint }}
          />
        )}
      </div>

      {paged && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <Button size="sm" variant="ghost" disabled={paging.index === 0} onClick={() => turnPage(-1)}>
            Seite zurück
          </Button>
          {/* Announced politely: a page turn is worth hearing, but not over the reader. */}
          <span
            aria-live="polite"
            className="font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]"
          >
            Seite {formatNumber(paging.index + 1)} von {formatNumber(paging.count)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={paging.index >= paging.count - 1}
            onClick={() => turnPage(1)}
          >
            Seite vor
          </Button>
        </div>
      )}

      {selection !== null && (
        <HighlightBar preview={preview} onColor={mark} onCancel={dropSelection} />
      )}
    </div>
  );
}

/** A descendant's top-left corner in the scroll container's own coordinates. */
function offsetInScroller(
  container: HTMLElement,
  element: HTMLElement,
): { top: number; left: number } {
  const box = container.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  // `clientTop`/`clientLeft` are the border widths: the rectangle is measured from the
  // border edge, the scroll offset from the padding edge.
  return {
    top: target.top - box.top - container.clientTop + container.scrollTop,
    left: target.left - box.left - container.clientLeft + container.scrollLeft,
  };
}

/** One frozen instance: an unmarked paragraph must keep the prop it had last render. */
const NO_MARKS: Annotation[] = [];

const PageParagraph = React.memo(function PageParagraph({
  tokens,
  activeIndex,
  activeRef,
  bionic,
  marks,
  paged,
  onSelect,
}: {
  tokens: RsvpToken[];
  activeIndex: number;
  activeRef: React.RefObject<HTMLButtonElement | null>;
  /** 0 is off, 1–5 how much of each word opening is emboldened. */
  bionic: number;
  /** Only the highlights that reach into this paragraph, empty for almost all of them. */
  marks: Annotation[];
  /** True while the page is broken into columns, which changes what may be skipped. */
  paged: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    // Size and spacing come from the container, so `em` here rather than a fixed step:
    // the gap between paragraphs has to grow with the type or the page loses its rhythm.
    // `content-visibility` lets the browser skip layout and paint for the paragraphs that
    // are off screen, which is what makes a whole book affordable instead of a chapter.
    // Paged mode cannot have it: the column break needs every paragraph's real height, and
    // a placeholder height would put the page breaks in the wrong places.
    <p
      className={
        paged
          ? 'mb-[0.9em]'
          : 'mb-[0.9em] [contain-intrinsic-size:auto_6em] [content-visibility:auto]'
      }
    >
      {tokens.map((token, position) => {
        const isActive = token.index === activeIndex;
        // Bionic reading fixes the eye on word openings; core decides how far in the
        // bold runs, this only draws it.
        const cut = bionic > 0 ? bionicPrefix(token.text, bionic) : 0;
        // Innermost last, so the mark made most recently is the one that shows.
        const covering = marks.length > 0 ? annotationsAt(marks, token.index) : marks;
        const mark = covering.length > 0 ? covering[covering.length - 1] : undefined;
        return (
          <React.Fragment key={token.index}>
            {position === 0 ? '' : ' '}
            <button
              ref={isActive ? activeRef : undefined}
              type="button"
              data-token={token.index}
              onClick={() => onSelect(token.index)}
              aria-current={isActive ? 'true' : undefined}
              title={mark?.note ?? undefined}
              style={
                mark && !isActive ? { backgroundColor: HIGHLIGHT_WASHES[mark.color] } : undefined
              }
              // `select-text`: the browsers' own stylesheet switches selection off inside
              // form controls, which would make marking impossible on the one surface it
              // is meant for.
              className={
                isActive
                  ? 'select-text rounded-[3px] bg-[var(--lx-accent)] px-[2px] text-[var(--lx-accent-on)]'
                  : 'select-text rounded-[3px] px-[2px] hover:bg-[var(--lx-accent-soft)]'
              }
            >
              {cut > 0 ? (
                <>
                  {/* `b`, not `strong`: this is weight, not importance — screen readers
                      should read the word, not stress every one of them. */}
                  <b className="font-semibold">{token.text.slice(0, cut)}</b>
                  {token.text.slice(cut)}
                </>
              ) : (
                token.text
              )}
            </button>
          </React.Fragment>
        );
      })}
    </p>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--lx-border)] px-3 py-2">
      <dt className="text-[12px] text-[var(--lx-text-muted)]">{label}</dt>
      <dd className="font-mono text-[15px] tabular-nums text-[var(--lx-text)]">{value}</dd>
    </div>
  );
}
