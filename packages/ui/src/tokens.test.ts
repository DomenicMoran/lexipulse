import { describe, expect, it } from 'vitest';
import {
  AA_LARGE,
  AA_NORMAL,
  ACCENTS,
  ACCENTS_LIGHT,
  THEMES,
  accentsFor,
  contrastRatio,
  relativeLuminance,
  resolveTheme,
  themeCssVars,
  type AccentName,
  type ThemeName,
} from './tokens.js';

const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[];

describe('contrast helpers', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 4);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 4);
    // #767676 is the lightest grey that still passes AA on white; #777777 does not.
    // Getting that boundary right is the whole point of the helper.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#FF4D4D', '#000000')).toBeCloseTo(
      contrastRatio('#000000', '#FF4D4D'),
      10,
    );
  });

  it('accepts short hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#FFFFFF'), 10);
  });
});

describe('theme text contrast', () => {
  /**
   * Text has to survive on the page background and on a raised surface — a card sits on
   * `surface`, and that is where most muted labels actually live.
   */
  for (const theme of THEME_NAMES) {
    const colors = THEMES[theme];

    it(`${theme}: primary text clears AA on bg and surface`, () => {
      expect(contrastRatio(colors.text, colors.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(colors.text, colors.surfaceHover)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it(`${theme}: muted text clears AA on bg and surface`, () => {
      expect(contrastRatio(colors.textMuted, colors.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(colors.textMuted, colors.surfaceHover)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it(`${theme}: faint text clears AA too — there is no unreadable tier`, () => {
      expect(contrastRatio(colors.textFaint, colors.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(colors.textFaint, colors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it(`${theme}: the three text tiers stay visually distinct`, () => {
      const l = (hex: string) => relativeLuminance(hex);
      const order =
        colors.scheme === 'dark'
          ? l(colors.text) > l(colors.textMuted) && l(colors.textMuted) > l(colors.textFaint)
          : l(colors.text) < l(colors.textMuted) && l(colors.textMuted) < l(colors.textFaint);
      expect(order, `${theme} text tiers are out of order`).toBe(true);
    });

    it(`${theme}: destructive actions are readable`, () => {
      expect(contrastRatio(colors.danger, colors.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(colors.danger, colors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it(`${theme}: the focus rails are visible without competing with the word`, () => {
      // Large enough to see, quiet enough not to pull the eye off the pivot.
      const ratio = contrastRatio(colors.rail, colors.stage);
      expect(ratio).toBeGreaterThan(1.3);
      expect(ratio).toBeLessThan(AA_NORMAL);
    });
  }
});

describe('accent contrast', () => {
  for (const theme of THEME_NAMES) {
    const colors = THEMES[theme];
    for (const accentName of ACCENT_NAMES) {
      const accent = accentsFor(theme)[accentName];

      it(`${theme}/${accentName}: the ORP character is readable on the stage`, () => {
        // The pivot renders at 20 px and up, so AA-large is the applicable threshold —
        // but every pair here clears the stricter one anyway.
        expect(contrastRatio(accent.base, colors.stage)).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it(`${theme}/${accentName}: accent text on a surface clears AA`, () => {
        // Badges, eyebrows and links use the accent at 11-13 px.
        expect(contrastRatio(accent.base, colors.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      });

      it(`${theme}/${accentName}: a filled accent button has readable label text`, () => {
        expect(contrastRatio(accent.on, accent.base)).toBeGreaterThanOrEqual(AA_NORMAL);
        expect(contrastRatio(accent.on, accent.strong)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }

  it('light themes get their own accent set', () => {
    expect(accentsFor('sepia')).toBe(ACCENTS_LIGHT);
    expect(accentsFor('minimal')).toBe(ACCENTS_LIGHT);
    expect(accentsFor('oled')).toBe(ACCENTS);
    expect(accentsFor('graphite')).toBe(ACCENTS);
  });

  it('resolveTheme hands out the scheme-appropriate accent', () => {
    expect(resolveTheme('minimal', 'coral').accent.base).toBe(ACCENTS_LIGHT.coral.base);
    expect(resolveTheme('oled', 'coral').accent.base).toBe(ACCENTS.coral.base);
  });
});

describe('themeCssVars', () => {
  it('emits every variable the apps consume', () => {
    const required = [
      '--lx-bg',
      '--lx-surface',
      '--lx-surface-hover',
      '--lx-border',
      '--lx-border-strong',
      '--lx-text',
      '--lx-text-muted',
      '--lx-text-faint',
      '--lx-stage',
      '--lx-rail',
      '--lx-overlay',
      '--lx-danger',
      '--lx-danger-soft',
      '--lx-accent',
      '--lx-accent-strong',
      '--lx-accent-soft',
      '--lx-accent-on',
      '--lx-accent-glow',
    ];
    for (const theme of THEME_NAMES) {
      const vars = themeCssVars(theme, 'coral');
      for (const key of required) {
        expect(vars[key], `${theme} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it('switches the accent with the scheme', () => {
    expect(themeCssVars('minimal', 'cyber')['--lx-accent']).toBe(ACCENTS_LIGHT.cyber.base);
    expect(themeCssVars('oled', 'cyber')['--lx-accent']).toBe(ACCENTS.cyber.base);
  });
});
