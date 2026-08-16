import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance } from 'react-native';

import { DEFAULT_SETTINGS, normalizeSettings, type RsvpSettings } from '@lexipulse/core';

import { hasPersistedSettings, initStore, store } from '../lib/store';
import { buildTheme, type Theme } from '../theme';

interface SettingsValue {
  settings: RsvpSettings;
  theme: Theme;
  /** True until the persisted settings have been read — the splash stays up until then. */
  loading: boolean;
  update: (patch: Partial<RsvpSettings>) => void;
  replace: (next: RsvpSettings) => void;
  /** Drop everything back to defaults, used after "delete all data". */
  reset: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/** First launch has no stored theme, so the system colour scheme decides. */
function initialSettings(): RsvpSettings {
  return {
    ...DEFAULT_SETTINGS,
    theme: Appearance.getColorScheme() === 'light' ? 'minimal' : 'oled',
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<RsvpSettings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initStore();
        const [stored, everSaved] = await Promise.all([
          store.getSettings(),
          hasPersistedSettings(),
        ]);
        if (cancelled) return;
        const next = everSaved ? stored : latest.current;
        latest.current = next;
        setSettings(next);
      } catch (error) {
        // A broken database must not brick the app into a blank screen: the reader still
        // works with in-memory defaults, and the library screen will surface the failure
        // when it cannot list anything.
        console.error('[LexiPulse] could not load settings', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Writes are debounced: the WPM slider fires on every frame of a drag and each write is
   * a SQLite transaction. The in-memory value updates immediately, so nothing feels lagged.
   */
  const persist = useCallback((next: RsvpSettings) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      void store.saveSettings(next);
    }, 400);
  }, []);

  const replace = useCallback(
    (next: RsvpSettings) => {
      const normalized = normalizeSettings(next);
      latest.current = normalized;
      setSettings(normalized);
      persist(normalized);
    },
    [persist],
  );

  const update = useCallback(
    (patch: Partial<RsvpSettings>) => {
      replace({ ...latest.current, ...patch });
    },
    [replace],
  );

  const reset = useCallback(() => {
    const fresh = initialSettings();
    latest.current = fresh;
    setSettings(fresh);
  }, []);

  // A pending debounce must not be lost when the provider goes away.
  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current);
        void store.saveSettings(latest.current);
      }
    },
    [],
  );

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      theme: buildTheme(settings.theme, settings.accent),
      loading,
      update,
      replace,
      reset,
    }),
    [settings, loading, update, replace, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}

export function useTheme(): Theme {
  return useSettings().theme;
}
