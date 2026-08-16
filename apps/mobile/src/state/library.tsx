import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { LexiDocument, LibraryEntry } from '@lexipulse/core';

import { initStore, store } from '../lib/store';

interface LibraryValue {
  entries: LibraryEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Persist a freshly parsed document and put it at the top of the list. */
  add: (document: LexiDocument) => Promise<void>;
  remove: (documentId: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      await initStore();
      setEntries(await store.listLibrary());
    } catch (error) {
      // Same reasoning as in the settings provider: never leave a screen stuck on its
      // loading state because the database is unhappy.
      console.error('[LexiPulse] could not read the library', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (document: LexiDocument) => {
      await store.saveDocument(document);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (documentId: string) => {
      await store.deleteDocument(documentId);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<LibraryValue>(
    () => ({ entries, loading, refresh, add, remove }),
    [entries, loading, refresh, add, remove],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return value;
}
