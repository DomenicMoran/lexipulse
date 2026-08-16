import type { AccentName, FontKey, ThemeName } from '@lexipulse/core';
import { THEMES, themeCssVars } from '@lexipulse/ui';

const MONO_UI = "var(--lx-font-jetbrains), ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** Player font stacks, keyed by the font names the core settings model already knows. */
export const PLAYER_FONT_STACKS: Record<FontKey, string> = {
  'jetbrains-mono': MONO_UI,
  'ibm-plex-mono': "var(--lx-font-plex), ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  'system-mono': "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
  inter: 'var(--lx-font-inter), -apple-system, BlinkMacSystemFont, sans-serif',
  literata: "var(--lx-font-literata), Georgia, 'Times New Roman', serif",
};

/**
 * Every custom property the app writes onto `<html>`: the shared theme tokens plus the
 * resolved player face.
 *
 * The accents used to be re-mixed here, because the shared set was tuned for near-black
 * surfaces and coral only reached 3.3:1 on white. `@lexipulse/ui` now ships a light-theme
 * accent set and picks it by scheme, with the contrast asserted in its own tests, so this
 * layer no longer second-guesses it — one place to change a colour, not two.
 */
export function themeVars(
  theme: ThemeName,
  accent: AccentName,
  fontFamily: FontKey,
): Record<string, string> {
  const base = themeCssVars(theme, accent);

  return {
    ...base,
    // Alias so a component can ask for "accent, safe for small text" without knowing
    // which theme is active. Since the tokens became scheme-aware this is the accent.
    '--lx-accent-text': base['--lx-accent'] ?? '#ff4d4d',
    '--lx-font-mono': PLAYER_FONT_STACKS[fontFamily],
  };
}

/** Serialised declaration list — what the pre-paint script replays verbatim. */
export function themeStyleText(
  theme: ThemeName,
  accent: AccentName,
  fontFamily: FontKey,
): string {
  return Object.entries(themeVars(theme, accent, fontFamily))
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

export function applyThemeVars(
  element: HTMLElement,
  theme: ThemeName,
  accent: AccentName,
  fontFamily: FontKey,
): void {
  for (const [key, value] of Object.entries(themeVars(theme, accent, fontFamily))) {
    element.style.setProperty(key, value);
  }
  element.style.colorScheme = THEMES[theme].scheme;
}

export const UI_CACHE_KEY = 'lexi:ui';

/**
 * Applied before first paint so a non-default theme never flashes black.
 * Kept deliberately tiny and dependency-free; it replays the declarations the settings
 * provider cached on the previous visit instead of carrying its own colour table.
 */
export const BOOT_THEME_SCRIPT = `(function(){try{var r=localStorage.getItem('${UI_CACHE_KEY}');if(!r)return;var s=JSON.parse(r);if(s&&typeof s.css==='string'&&s.css.length<4000){document.documentElement.setAttribute('style',s.css)}if(s&&s.scheme){document.documentElement.style.colorScheme=s.scheme}if(s&&s.reduceMotion){document.documentElement.setAttribute('data-lx-reduce-motion','true')}}catch(e){}})();`;
