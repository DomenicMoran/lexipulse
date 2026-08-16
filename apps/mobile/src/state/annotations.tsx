/**
 * Highlights and notes for the open document.
 *
 * Kept apart from the reader state on purpose: the reader owns time and position, this
 * owns what the reader marked. Mixing them would mean every highlight re-renders the
 * player, which at 900 words per minute is not free.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { textOfRange, type Annotation, type HighlightColor, type RsvpToken } from '@lexipulse/core';

import { initStore, store } from '../lib/store';

interface AnnotationsValue {
  annotations: Annotation[];
  add: (input: {
    documentId: string;
    startToken: number;
    endToken: number;
    chapterIndex: number;
    color: HighlightColor;
    tokens: readonly RsvpToken[];
  }) => Promise<void>;
  update: (annotation: Annotation) => Promise<void>;
  remove: (documentId: string, id: string) => Promise<void>;
  load: (documentId: string | null) => Promise<void>;
}

const AnnotationsContext = createContext<AnnotationsValue | null>(null);

/** One frozen instance, so "no document" does not hand out a fresh array every render. */
const EMPTY: Annotation[] = [];

export function AnnotationsProvider({
  documentId,
  children,
}: {
  documentId: string | null;
  children: React.ReactNode;
}) {
  /**
   * The loaded set carries the id it belongs to, and the empty case is derived rather
   * than stored. Clearing the list in the effect would be a synchronous setState there —
   * a cascading render, and one the React compiler rightly refuses.
   */
  const [loaded, setLoaded] = useState<{ id: string | null; items: Annotation[] }>({
    id: null,
    items: [],
  });
  const annotations = loaded.id === documentId && documentId !== null ? loaded.items : EMPTY;

  const load = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await initStore();
      setLoaded({ id, items: await store.listAnnotations(id) });
    } catch (error) {
      // Same rule as the library: a database that will not answer must not leave the
      // reader staring at a screen that never finishes loading.
      console.error('[LexiPulse] could not read highlights', error);
      setLoaded({ id, items: [] });
    }
  }, []);

  /**
   * Loading is a subscription to an external system, so the write happens in the
   * callback rather than in the effect body. The cancel flag matters beyond the linter:
   * flicking between two documents would otherwise let the slower read land last and
   * show one document's highlights over the other's text.
   */
  useEffect(() => {
    if (documentId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        await initStore();
        const items = await store.listAnnotations(documentId);
        if (!cancelled) setLoaded({ id: documentId, items });
      } catch (error) {
        console.error('[LexiPulse] could not read highlights', error);
        if (!cancelled) setLoaded({ id: documentId, items: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const add = useCallback<AnnotationsValue['add']>(
    async (input) => {
      const now = Date.now();
      const annotation: Annotation = {
        id: `hl_${now.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
        documentId: input.documentId,
        startToken: Math.min(input.startToken, input.endToken),
        endToken: Math.max(input.startToken, input.endToken),
        chapterIndex: input.chapterIndex,
        color: input.color,
        text: textOfRange(
          input.tokens,
          Math.min(input.startToken, input.endToken),
          Math.max(input.startToken, input.endToken),
        ),
        note: null,
        createdAt: now,
        updatedAt: now,
      };
      await initStore();
      await store.saveAnnotation(annotation);
      await load(input.documentId);
    },
    [load],
  );

  const update = useCallback<AnnotationsValue['update']>(
    async (annotation) => {
      await initStore();
      await store.saveAnnotation({ ...annotation, updatedAt: Date.now() });
      await load(annotation.documentId);
    },
    [load],
  );

  const remove = useCallback<AnnotationsValue['remove']>(
    async (docId, id) => {
      await initStore();
      await store.deleteAnnotation(docId, id);
      await load(docId);
    },
    [load],
  );

  const value = useMemo<AnnotationsValue>(
    () => ({ annotations, add, update, remove, load }),
    [annotations, add, update, remove, load],
  );

  return <AnnotationsContext.Provider value={value}>{children}</AnnotationsContext.Provider>;
}

export function useAnnotations(): AnnotationsValue {
  const value = useContext(AnnotationsContext);
  if (!value) throw new Error('useAnnotations must be used inside <AnnotationsProvider>.');
  return value;
}
