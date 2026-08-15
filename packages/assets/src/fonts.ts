/**
 * Font plumbing.
 *
 * Two renderers need the brand faces and neither picks them up on its own:
 *
 * - sharp rasterises SVG through libvips/Pango, which only sees fonts fontconfig knows
 *   about. On Windows that is the system font directory and nothing else, so we point
 *   `FONTCONFIG_PATH` at a generated config that adds `packages/assets/fonts`. Without
 *   this the OG image silently falls back to Consolas and looks off-brand.
 * - Chromium (store screenshots) has no network under our CSP-free but offline render,
 *   so the web faces are inlined as base64 `@font-face` sources.
 *
 * The fonts are vendored under `fonts/` (JetBrains Mono and Inter, both SIL OFL).
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = join(here, '..');
export const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
export const FONT_DIR = join(PACKAGE_ROOT, 'fonts');

const CONFIG_DIR = join(PACKAGE_ROOT, '.fontconfig');

const toPosix = (p: string): string => p.replace(/\\/g, '/');

const READY_FLAG = 'LEXIPULSE_FONTCONFIG_READY';

/** Write `.fontconfig/fonts.conf`. Returns the directory `FONTCONFIG_PATH` must point at. */
function writeFontconfig(): string {
  mkdirSync(join(CONFIG_DIR, 'cache'), { recursive: true });
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${toPosix(FONT_DIR)}</dir>
  <cachedir>${toPosix(join(CONFIG_DIR, 'cache'))}</cachedir>
</fontconfig>
`;
  writeFileSync(join(CONFIG_DIR, 'fonts.conf'), conf, 'utf8');
  return toPosix(CONFIG_DIR);
}

/**
 * Make the vendored faces visible to sharp, re-executing this process if necessary.
 *
 * Measured, not assumed: assigning `process.env.FONTCONFIG_PATH` and only then importing
 * sharp does **not** work — fontconfig reads the variable out of the real process
 * environment when the native library initialises, and a render started that way silently
 * falls back to a system face. The variable has to be present before Node starts, so the
 * first invocation re-runs itself once with the environment fixed up. `process.execArgv`
 * carries the tsx loader flags, so the child is the same interpreter setup.
 *
 * Returns `true` when the brand faces are available.
 */
export function bootstrapFonts(): boolean {
  if (!existsSync(FONT_DIR)) return false;
  const dir = writeFontconfig();

  if (process.env[READY_FLAG] === '1' && process.env.FONTCONFIG_PATH === dir) return true;

  const result = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, FONTCONFIG_PATH: dir, [READY_FLAG]: '1' },
  });
  process.exit(result.status ?? 1);
}

interface WebFont {
  family: string;
  weight: number;
  file: string;
}

const WEB_FONTS: readonly WebFont[] = [
  { family: 'JetBrains Mono', weight: 400, file: 'JetBrainsMono-Regular.woff2' },
  { family: 'JetBrains Mono', weight: 500, file: 'JetBrainsMono-Medium.woff2' },
  { family: 'JetBrains Mono', weight: 700, file: 'JetBrainsMono-Bold.woff2' },
  { family: 'Inter', weight: 400, file: 'Inter-Regular.woff2' },
  { family: 'Inter', weight: 500, file: 'Inter-Medium.woff2' },
  { family: 'Inter', weight: 600, file: 'Inter-SemiBold.woff2' },
];

let cachedCss: string | null = null;

/** `@font-face` block with the faces inlined, for the Playwright templates. */
export function fontFaceCss(): string {
  if (cachedCss !== null) return cachedCss;
  const blocks: string[] = [];
  for (const font of WEB_FONTS) {
    const path = join(FONT_DIR, font.file);
    if (!existsSync(path)) continue;
    const data = readFileSync(path).toString('base64');
    blocks.push(
      `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');}`,
    );
  }
  cachedCss = blocks.join('\n');
  return cachedCss;
}
