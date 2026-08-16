'use client';

import { DEFAULT_SETTINGS, normalizeSettings, type RsvpSettings } from '@lexipulse/core';
import { THEMES } from '@lexipulse/ui';
import * as React from 'react';
import { getStore } from '@/lib/store';
import { UI_CACHE_KEY, applyThemeVars, themeStyleText } from '@/lib/theme';

interface SettingsContextValue {
  settings: RsvpSettings;
  /** Merge a patch, apply it immediately and persist it. */
  update: (patch: Partial<RsvpSettings>) => void;
  /** Replace the whole object — used after a data import. */
  replace: (next: RsvpSettings) => void;
  /** False until the persisted settings have been read back. */
  hydrated: boolean;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

interface CachedUi {
  css: string;
  scheme: string;
  reduceMotion: boolean;
  settings: RsvpSettings;
}

function writeCache(settings: RsvpSettings): void {
  try {
    const payload: CachedUi = {
      css: themeStyleText(settings.theme, settings.accent, settings.fontFamily),
      scheme: THEMES[settings.theme].scheme,
      reduceMotion: settings.reduceMotion,
      settings,
    };
    localStorage.setItem(UI_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A blocked localStorage costs the pre-paint theme, nothing else.
  }
}

function readCache(): RsvpSettings | null {
  try {
    const raw = localStorage.getItem(UI_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedUi>;
    return parsed.settings ? normalizeSettings(parsed.settings) : null;
  } catch {
    return null;
  }
}

/**
 * Owns the one settings object the whole app reads.
 *
 * localStorage is the fast path — it is synchronous, so the pre-paint script can replay
 * the theme before the first frame. IndexedDB is the canonical copy, because the data
 * export under Art. 20 DSGVO has to contain the settings as well.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<RsvpSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = React.useState(false);
  const saveTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached) setSettings(cached);

    void (async () => {
      try {
        const store = await getStore();
        const stored = await store.getSettings();
        if (cancelled) return;
        // The cache wins when it exists: `persist` writes it on every change, before the
        // debounced database write, so it is never the older copy. Restoring a backup
        // goes through `replace`, which refreshes the cache too. Only a first visit, or a
        // browser that cleared localStorage, falls through to the database here.
        if (!cached) {
          setSettings(stored);
          writeCache(stored);
        }
      } catch {
        // Storage unavailable: defaults stay in effect for this session.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Theme, accent, player face and the motion opt-out all live on <html>.
  React.useEffect(() => {
    applyThemeVars(document.documentElement, settings.theme, settings.accent, settings.fontFamily);
    document.documentElement.dataset.lxReduceMotion = settings.reduceMotion ? 'true' : 'false';
  }, [settings.theme, settings.accent, settings.fontFamily, settings.reduceMotion]);

  const persist = React.useCallback((next: RsvpSettings) => {
    writeCache(next);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void getStore()
        .then((store) => store.saveSettings(next))
        .catch(() => undefined);
    }, 400);
  }, []);

  const update = React.useCallback(
    (patch: Partial<RsvpSettings>) => {
      setSettings((current) => {
        const next = normalizeSettings({ ...current, ...patch });
        // `normalizeSettings` rebuilds the pacing matrix on every call. Reusing the old
        // object when nothing inside it changed keeps its identity stable, so the player
        // does not re-pace the whole token stream because someone switched the theme.
        if (JSON.stringify(next.pacing) === JSON.stringify(current.pacing)) {
          next.pacing = current.pacing;
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const replace = React.useCallback(
    (next: RsvpSettings) => {
      const normalized = normalizeSettings(next);
      setSettings(normalized);
      persist(normalized);
    },
    [persist],
  );

  const value = React.useMemo<SettingsContextValue>(
    () => ({ settings, update, replace, hydrated }),
    [settings, update, replace, hydrated],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = React.useContext(SettingsContext);
  if (!context) throw new Error('useSettings muss innerhalb von SettingsProvider genutzt werden.');
  return context;
}
