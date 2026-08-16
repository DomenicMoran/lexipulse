import { computeOrp } from '@lexipulse/core';
import { describe, expect, it } from 'vitest';
import {
  MAX_ORP_INDEX,
  charWidthPx,
  computeStageGeometry,
  fitFontSize,
  pivotOffsetColumns,
  pivotOffsetPx,
  pivotTransformCss,
} from './player-geometry.js';
import { ACCENTS, THEMES, themeCssVars, resolveTheme } from './tokens.js';

describe('computeStageGeometry', () => {
  it('reserves enough columns left and right for the worst-case word', () => {
    const g = computeStageGeometry({ maxWordLength: 22, maxOrp: 4, padding: 2 });
    expect(g.leftColumns).toBe(6);
    expect(g.rightColumns).toBe(19);
    expect(g.columns).toBe(26);
    expect(g.focusColumn).toBe(6);
  });

  it('never produces a stage narrower than the longest word', () => {
    for (const maxWordLength of [4, 10, 22, 40]) {
      const g = computeStageGeometry({ maxWordLength });
      expect(g.columns).toBeGreaterThanOrEqual(maxWordLength);
    }
  });
});

describe('pivot alignment', () => {
  const geometry = computeStageGeometry();

  it('lands every word on the same focus column', () => {
    const words = ['a', 'im', 'Hallo', 'Entwicklung', 'Verantwortungsbereich'];
    for (const word of words) {
      const orp = computeOrp(word);
      expect(orp + pivotOffsetColumns(orp, geometry.focusColumn)).toBe(geometry.focusColumn);
    }
  });

  it('never needs a pivot index above the tokenizer ceiling', () => {
    for (const word of ['Donaudampfschifffahrt', 'x', 'Übermut']) {
      expect(computeOrp(word)).toBeLessThanOrEqual(MAX_ORP_INDEX);
    }
  });

  it('emits a ch-based transform for the web player', () => {
    expect(pivotTransformCss(1, 6)).toBe('translateX(5ch)');
    expect(pivotTransformCss(6, 6)).toBe('translateX(0ch)');
  });

  it('converts to pixels for the native player', () => {
    expect(pivotOffsetPx(2, 6, 20)).toBe(80);
    expect(charWidthPx(50)).toBe(30);
  });
});

describe('fitFontSize', () => {
  const geometry = computeStageGeometry();

  it('scales the type to the available width', () => {
    const small = fitFontSize(360, geometry);
    const large = fitFontSize(1200, geometry);
    expect(large).toBeGreaterThan(small);
  });

  it('clamps into a readable range', () => {
    expect(fitFontSize(50, geometry)).toBe(20);
    expect(fitFontSize(100_000, geometry)).toBe(120);
  });

  it('produces a size whose stage actually fits the container', () => {
    const width = 800;
    const size = fitFontSize(width, geometry);
    expect(size * 0.6 * geometry.columns).toBeLessThanOrEqual(width);
  });
});

describe('tokens', () => {
  it('defines every theme and accent as a valid colour', () => {
    const hexOrRgba = /^(#[0-9A-Fa-f]{6}|rgba?\()/;
    for (const theme of Object.values(THEMES)) {
      for (const [key, value] of Object.entries(theme)) {
        if (key === 'scheme') continue;
        expect(value, `${key}=${value}`).toMatch(hexOrRgba);
      }
    }
    for (const accent of Object.values(ACCENTS)) {
      for (const value of Object.values(accent)) expect(value).toMatch(hexOrRgba);
    }
  });

  it('keeps OLED black at true black so the panel can switch pixels off', () => {
    expect(THEMES.oled.bg).toBe('#000000');
    expect(THEMES.oled.stage).toBe('#000000');
  });

  it('emits CSS custom properties for a theme and accent pair', () => {
    const vars = themeCssVars('oled', 'coral');
    expect(vars['--lx-bg']).toBe('#000000');
    expect(vars['--lx-accent']).toBe('#FF4D4D');
  });

  it('resolves a theme into colours and the scheme-appropriate accent', () => {
    expect(resolveTheme('oled', 'cyber').accent.base).toBe(ACCENTS.cyber.base);
    // Sepia is a light theme, so it gets the darkened accent, not the neon one.
    const sepia = resolveTheme('sepia', 'cyber');
    expect(sepia.colors.scheme).toBe('light');
    expect(sepia.accent.base).not.toBe(ACCENTS.cyber.base);
  });
});
