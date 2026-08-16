import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  RsvpEngine,
  joinTokens,
  tokenizeChapters,
  type Bookmark,
  type EngineEvent,
  type EngineListener,
  type EngineSnapshot,
  type LexiDocument,
  type RsvpToken,
} from '@lexipulse/core';

import { initStore, store } from '../lib/store';
import { useSettings } from './settings';

interface ReaderValue {
  document: LexiDocument | null;
  tokens: readonly RsvpToken[];
  snapshot: EngineSnapshot;
  bookmarks: Bookmark[];
  loading: boolean;
  /** Load a document and resume where the user left off. */
  open: (documentId: string) => Promise<void>;
  close: () => void;
  /** Close without saving — for a document that is being deleted. */
  discard: () => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seek: (index: number) => void;
  seekPercent: (percent: number) => void;
  rewind: () => void;
  forward: () => void;
  seekSentence: (direction: -1 | 1) => void;
  seekChapter: (chapterIndex: number) => void;
  nudgeWpm: (delta: number) => void;
  addBookmark: () => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  /** Persist position and fold the elapsed playing time into the statistics. */
  flush: () => Promise<void>;
  /**
   * Raw engine events. TTS and the sentence click need `sentence` events at the exact
   * moment they fire, not once React has re-rendered.
   */
  subscribe: (listener: EngineListener) => () => void;
}

const EMPTY_SNAPSHOT: EngineSnapshot = {
  status: 'idle',
  index: 0,
  token: null,
  percent: 0,
  remainingMs: 0,
  elapsedMs: 0,
  chapterIndex: 0,
  warmupFactor: 1,
};

const ReaderContext = createContext<ReaderValue | null>(null);

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const { settings, update } = useSettings();

  const engineRef = useRef<RsvpEngine | null>(null);
  const documentRef = useRef<LexiDocument | null>(null);
  const listeners = useRef(new Set<EngineListener>());

  const [document, setDocument] = useState<LexiDocument | null>(null);
  const [tokens, setTokens] = useState<readonly RsvpToken[]>([]);
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(EMPTY_SNAPSHOT);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);

  /** Playing time and words since the last `recordSession`. */
  const session = useRef({ startedAt: 0, msRead: 0, startIndex: 0 });
  /** True while the current document has never been opened before. */
  const firstOpen = useRef(false);

  const sync = useCallback(() => {
    const engine = engineRef.current;
    setSnapshot(engine ? engine.getSnapshot() : EMPTY_SNAPSHOT);
  }, []);

  const subscribe = useCallback((listener: EngineListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  // ------------------------------------------------------------- session bookkeeping

  /** Stop the stopwatch and bank what it measured. Idempotent. */
  const closeSession = useCallback(() => {
    const s = session.current;
    if (s.startedAt === 0) return;
    s.msRead += Date.now() - s.startedAt;
    s.startedAt = 0;
  }, []);

  /**
   * Pending debounced position write, see `saveSoon`.
   *
   * Declared here rather than beside `saveSoon` because `teardown` has to be able to
   * cancel it: a timer that fires after the document was closed — or deleted — would
   * write a progress row for a document that is no longer there.
   */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSave = useCallback(() => {
    if (saveTimer.current === null) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
  }, []);

  const flush = useCallback(async () => {
    const engine = engineRef.current;
    const doc = documentRef.current;
    if (!engine || !doc) return;

    closeSession();
    const snap = engine.getSnapshot();
    const s = session.current;
    const tokensRead = Math.max(0, snap.index - s.startIndex);

    await store.saveProgress({
      documentId: doc.id,
      tokenIndex: snap.index,
      chapterIndex: snap.chapterIndex,
      percent: snap.percent,
      updatedAt: Date.now(),
      msRead: snap.elapsedMs,
    });

    // Opening a document and closing it again is not a reading session. Recording it
    // would drag the rolling average WPM down and light up the activity heatmap for a
    // day on which nothing was read.
    if (s.msRead < 500 || tokensRead <= 0) {
      s.msRead = 0;
      s.startIndex = snap.index;
      return;
    }

    await store.recordSession({
      tokensRead,
      msRead: s.msRead,
      started: firstOpen.current,
      finished: snap.status === 'finished',
    });
    firstOpen.current = false;
    s.msRead = 0;
    s.startIndex = snap.index;
  }, [closeSession]);

  // `open` and the engine subscription need the current `flush` without being rebuilt
  // every time it changes — a rebuilt `open` would tear the engine down mid-sentence.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // ------------------------------------------------------------------------ the clock

  /**
   * The engine is driven by `requestAnimationFrame` only while it is actually playing.
   * React state changes once per word, from the engine's own events — re-rendering at
   * 60 Hz to show a word that changes six times a second would burn battery for nothing.
   * The engine reads an absolute clock, so a dropped frame cannot shift the stream.
   */
  useEffect(() => {
    if (snapshot.status !== 'playing') return;
    let handle = 0;
    let running = true;
    const tick = () => {
      if (!running) return;
      engineRef.current?.update(Date.now());
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(handle);
    };
  }, [snapshot.status]);

  // Leaving the app must not lose the position — Android can kill the process outright.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active' && engineRef.current) {
        engineRef.current.pause();
        void flushRef.current();
      }
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  // ------------------------------------------------------------------- open / close

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const open = useCallback(
    async (documentId: string) => {
      if (documentRef.current?.id === documentId) return;
      setLoading(true);
      try {
        await initStore();
        const doc = await store.getDocument(documentId);
        if (!doc) return;

        const [progress, marks] = await Promise.all([
          store.getProgress(documentId),
          store.listBookmarks(documentId),
        ]);

        const current = settingsRef.current;
        const stream = tokenizeChapters(doc.chapters, {
          wpm: current.wpm,
          pacing: current.pacing,
        });
        const startIndex = Math.min(progress?.tokenIndex ?? 0, Math.max(stream.length - 1, 0));

        const engine = new RsvpEngine({ tokens: stream, settings: current, startIndex });
        engine.subscribe((event: EngineEvent) => {
          if (event.type === 'status') {
            if (event.status === 'playing') {
              if (session.current.startedAt === 0) session.current.startedAt = Date.now();
            } else {
              closeSession();
            }
          }
          if (event.type === 'token' || event.type === 'status' || event.type === 'finish') {
            setSnapshot(engine.getSnapshot());
          }
          if (event.type === 'finish') void flushRef.current();
          for (const listener of listeners.current) listener(event);
        });

        engineRef.current = engine;
        documentRef.current = doc;
        session.current = { startedAt: 0, msRead: 0, startIndex };
        firstOpen.current = progress === null;

        setDocument(doc);
        setTokens(stream);
        setBookmarks(marks);
        setSnapshot(engine.getSnapshot());
      } finally {
        setLoading(false);
      }
    },
    [closeSession],
  );

  /** Tear down the player. `save: false` is for a document that is about to be deleted. */
  const teardown = useCallback((save: boolean) => {
    cancelSave();
    engineRef.current?.pause();
    // `flush` reads both refs synchronously before its first `await`, so clearing them on
    // the next line cannot cut the save short — and clearing them immediately is what
    // lets the same document be reopened right away instead of hitting the identity
    // check in `open` and silently doing nothing.
    if (save) void flushRef.current();
    engineRef.current = null;
    documentRef.current = null;
    session.current = { startedAt: 0, msRead: 0, startIndex: 0 };
    setDocument(null);
    setTokens([]);
    setBookmarks([]);
    setSnapshot(EMPTY_SNAPSHOT);
  }, [cancelSave]);

  const close = useCallback(() => teardown(true), [teardown]);

  /**
   * Close without writing anything back.
   *
   * Deleting the open document has to skip the progress save outright — writing a
   * progress row for a document that is being removed in the same breath would leave an
   * orphan behind, and the order of the two writes is not something to rely on.
   */
  const discard = useCallback(() => teardown(false), [teardown]);

  // ----------------------------------------------------------------------- controls

  /**
   * Write the position after a jump, debounced.
   *
   * `flush` is the wrong tool here: it also banks a reading session, and jumping around
   * a document is not reading — doing both would split one session into a dozen records
   * and light up the activity heatmap for a day nobody read on. This writes the progress
   * row and nothing else.
   *
   * Debounced because page mode reports a new position for every paragraph that scrolls
   * past, and a database write per paragraph is a write per flick of the thumb.
   */
  const saveSoon = useCallback(() => {
    cancelSave();
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const engine = engineRef.current;
      const doc = documentRef.current;
      if (!engine || !doc) return;
      const snap = engine.getSnapshot();
      void store.saveProgress({
        documentId: doc.id,
        tokenIndex: snap.index,
        chapterIndex: snap.chapterIndex,
        percent: snap.percent,
        updatedAt: Date.now(),
        msRead: snap.elapsedMs,
      });
    }, 900);
  }, [cancelSave]);

  useEffect(() => cancelSave, [cancelSave]);

  const play = useCallback(() => {
    engineRef.current?.play();
    sync();
  }, [sync]);

  const pause = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.pause();
    void flushRef.current();
    sync();
  }, [sync]);

  const toggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.getStatus() === 'playing') pause();
    else play();
  }, [pause, play]);

  const seek = useCallback(
    (index: number) => {
      engineRef.current?.seek(index);
      sync();
      saveSoon();
    },
    [saveSoon, sync],
  );

  const seekPercent = useCallback(
    (percent: number) => {
      engineRef.current?.seekPercent(percent);
      sync();
      saveSoon();
    },
    [saveSoon, sync],
  );

  const rewind = useCallback(() => {
    engineRef.current?.rewind();
    sync();
    saveSoon();
  }, [saveSoon, sync]);

  const forward = useCallback(() => {
    engineRef.current?.forward();
    sync();
    saveSoon();
  }, [saveSoon, sync]);

  const seekSentence = useCallback(
    (direction: -1 | 1) => {
      engineRef.current?.seekSentence(direction);
      sync();
      saveSoon();
    },
    [saveSoon, sync],
  );

  const seekChapter = useCallback(
    (chapterIndex: number) => {
      engineRef.current?.seekChapter(chapterIndex);
      sync();
      saveSoon();
    },
    [saveSoon, sync],
  );

  /** Swipe up/down. Routed through settings so the change is persisted, not just applied. */
  const nudgeWpm = useCallback(
    (delta: number) => {
      update({ wpm: settingsRef.current.wpm + delta });
    },
    [update],
  );

  // The engine holds its own copy of the settings, so every change has to be pushed into
  // it. `updateSettings` re-paces the token stream only when the pacing actually changed.
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.updateSettings(settings);
    sync();
  }, [settings, sync]);

  // ---------------------------------------------------------------------- bookmarks

  const addBookmark = useCallback(async () => {
    const engine = engineRef.current;
    const doc = documentRef.current;
    if (!engine || !doc) return;
    const snap = engine.getSnapshot();
    const stream = engine.getTokens();
    // `joinTokens` rather than a manual join: the tokenizer splits words over 22
    // characters and adds a hyphen, and only it knows which hyphens it invented.
    const preview = joinTokens(
      stream.slice(Math.max(0, snap.index - 6), Math.min(stream.length, snap.index + 7)),
    );

    const bookmark: Bookmark = {
      id: `bm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      documentId: doc.id,
      tokenIndex: snap.index,
      chapterIndex: snap.chapterIndex,
      preview: preview || (snap.token?.text ?? ''),
      note: null,
      createdAt: Date.now(),
    };
    await store.addBookmark(bookmark);
    setBookmarks(await store.listBookmarks(doc.id));
  }, []);

  const removeBookmark = useCallback(async (id: string) => {
    const doc = documentRef.current;
    if (!doc) return;
    await store.deleteBookmark(doc.id, id);
    setBookmarks(await store.listBookmarks(doc.id));
  }, []);

  const value = useMemo<ReaderValue>(
    () => ({
      document,
      tokens,
      snapshot,
      bookmarks,
      loading,
      open,
      close,
      discard,
      toggle,
      play,
      pause,
      seek,
      seekPercent,
      rewind,
      forward,
      seekSentence,
      seekChapter,
      nudgeWpm,
      addBookmark,
      removeBookmark,
      flush,
      subscribe,
    }),
    [
      document,
      tokens,
      snapshot,
      bookmarks,
      loading,
      open,
      close,
      discard,
      toggle,
      play,
      pause,
      seek,
      seekPercent,
      rewind,
      forward,
      seekSentence,
      seekChapter,
      nudgeWpm,
      addBookmark,
      removeBookmark,
      flush,
      subscribe,
    ],
  );

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReader(): ReaderValue {
  const value = useContext(ReaderContext);
  if (!value) throw new Error('useReader must be used inside <ReaderProvider>');
  return value;
}
