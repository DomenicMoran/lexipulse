/**
 * Store screenshots, rendered with Playwright.
 *
 * Run: `pnpm --filter @lexipulse/assets screenshots`
 *      (needs a browser once: `pnpm exec playwright install chromium`)
 *
 * Where the device content comes from
 * -----------------------------------
 * Preferred path: the web app's dev server on `http://localhost:3210`. A route is captured
 * only when the page marks itself with `data-lexipulse-screen="<id>"` — a 200 alone proves
 * nothing, since `/reader` without an imported document renders the import empty state,
 * and that under the headline "one word, always in the same place" is a listing promising
 * something the picture does not show.
 *
 * Fallback: the screens in `templates/screens.ts`, built from the same design tokens and
 * the same `computeStageGeometry` / `computeOrp` the player uses. The script prints which
 * path each file took — a store asset that quietly drifts from the app is worse than no
 * asset.
 *
 * `LEXIPULSE_DEV_URL` overrides the server, `LEXIPULSE_CAPTURE_LIVE=1` skips the marker
 * check once the running app has been seeded by hand.
 */

import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';

import { REPO_ROOT } from './fonts.js';
import { SCREENS } from './templates/screens.js';
import type { Locale } from './templates/screens.js';
import { framePage, featureGraphicPage } from './templates/page.js';
import type { DeviceKind, FrameSpec } from './templates/page.js';

const DEV_URL = process.env.LEXIPULSE_DEV_URL ?? 'http://localhost:3210';
const OUT_ROOT = join(REPO_ROOT, 'store', 'screenshots');
const LOCALES: readonly Locale[] = ['de', 'en'];

interface Target {
  id: string;
  /** What the store calls this slot, for the report. */
  requirement: string;
  width: number;
  height: number;
  scale: number;
  kind: DeviceKind;
  /** `tablet` targets only take the screens flagged for tablets. */
  tabletOnly?: boolean;
}

const TARGETS: readonly Target[] = [
  {
    id: 'ios-6.9',
    requirement: 'App Store — iPhone 6.9" (required slot; 1290x2796 portrait)',
    width: 1290,
    height: 2796,
    scale: 3,
    kind: 'phone',
  },
  {
    id: 'ios-6.5',
    requirement: 'App Store — iPhone 6.5" (legacy required slot; 1242x2688 portrait)',
    width: 1242,
    height: 2688,
    scale: 3,
    kind: 'phone',
  },
  {
    id: 'ipad-13',
    requirement: 'App Store — iPad 13" (only when the build declares tablet support; 2064x2752)',
    width: 2064,
    height: 2752,
    scale: 2,
    kind: 'tablet',
    tabletOnly: true,
  },
  {
    id: 'android-phone',
    requirement: 'Play Store — phone screenshot (1080x1920, min 2, max 8)',
    width: 1080,
    height: 1920,
    scale: 3,
    kind: 'phone',
  },
];

interface Result {
  path: string;
  width: number;
  height: number;
  bytes: number;
  source: 'dev-server' | 'template';
}

const results: Result[] = [];

function outDir(locale: Locale, targetId: string): string {
  return locale === 'de' ? join(OUT_ROOT, targetId) : join(OUT_ROOT, 'en', targetId);
}

// ---------------------------------------------------------------------------
// Tablet support is a fact about the app, not a guess
// ---------------------------------------------------------------------------

interface TabletVerdict {
  supported: boolean;
  reason: string;
}

type MaybeExpo = { expo?: { ios?: { supportsTablet?: boolean } }; ios?: { supportsTablet?: boolean } };

function readTabletFlag(config: unknown): boolean | undefined {
  const c = config as MaybeExpo | undefined;
  return c?.expo?.ios?.supportsTablet ?? c?.ios?.supportsTablet;
}

/**
 * Only ship iPad screenshots when the mobile build actually declares tablet support.
 * Apple reviews iPad shots against an iPad build; a phone layout letterboxed into an
 * iPad frame is a rejection, not a shortcut. Reads whichever config form the app uses —
 * `app.json` or a dynamic `app.config.*`.
 */
async function tabletSupport(): Promise<TabletVerdict> {
  const dir = join(REPO_ROOT, 'apps', 'mobile');

  const json = join(dir, 'app.json');
  if (existsSync(json)) {
    try {
      const flag = readTabletFlag(JSON.parse(readFileSync(json, 'utf8')));
      return {
        supported: flag === true,
        reason: `apps/mobile/app.json → ios.supportsTablet = ${String(flag)}`,
      };
    } catch (error) {
      return { supported: false, reason: `apps/mobile/app.json unreadable: ${(error as Error).message}` };
    }
  }

  for (const name of ['app.config.ts', 'app.config.js', 'app.config.mjs']) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    try {
      const module_ = (await import(pathToFileURL(file).href)) as { default?: unknown };
      const exported = module_.default ?? module_;
      const config =
        typeof exported === 'function' ? (exported as (context: unknown) => unknown)({}) : exported;
      const flag = readTabletFlag(config);
      return {
        supported: flag === true,
        reason: `apps/mobile/${name} → ios.supportsTablet = ${String(flag)}`,
      };
    } catch (error) {
      return { supported: false, reason: `apps/mobile/${name} unreadable: ${(error as Error).message}` };
    }
  }

  return { supported: false, reason: 'no Expo config found under apps/mobile' };
}

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

/**
 * The web app must *say* which screen it is rendering before we put it in front of the
 * App Store. A 200 is not enough: with no document imported, `/reader` renders the import
 * empty state, and a screenshot of an empty state under the headline "one word, always in
 * the same place" is a listing that promises something the image does not show.
 *
 * The contract is one attribute, `data-lexipulse-screen="<screen id>"`, on the screen
 * root. Set `LEXIPULSE_CAPTURE_LIVE=1` to capture regardless — useful once the app has
 * been seeded by hand.
 */
const FORCE_LIVE = process.env.LEXIPULSE_CAPTURE_LIVE === '1';

/** Next.js and friends paint dev-only overlays that must never reach a store asset. */
const HIDE_DEV_CHROME = `
  nextjs-portal, #__next-build-watcher, [data-nextjs-dev-tools-button],
  [data-nextjs-toast], #devtools-indicator { display: none !important; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
`;

async function reachable(url: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

async function openScreen(browser: Browser, url: string, locale: Locale) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    locale: locale === 'de' ? 'de-DE' : 'en-US',
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });
  await page.addStyleTag({ content: HIDE_DEV_CHROME });
  return { context, page };
}

/** Routes of the running web app that actually render the screen they claim to. */
async function probeDevServer(browser: Browser): Promise<Map<string, string>> {
  const available = new Map<string, string>();
  if (!(await reachable(DEV_URL))) return available;

  for (const screen of SCREENS) {
    const url = new URL(screen.devPath, DEV_URL).toString();
    if (!(await reachable(url))) continue;
    try {
      const { context, page } = await openScreen(browser, url, 'de');
      const marked =
        FORCE_LIVE || (await page.locator(`[data-lexipulse-screen="${screen.id}"]`).count()) > 0;
      await context.close();
      if (marked) available.set(screen.id, url);
    } catch {
      // A route that throws while loading is not a route we ship a screenshot of.
    }
  }
  return available;
}

const captureCache = new Map<string, string>();

async function captureRoute(browser: Browser, url: string, locale: Locale): Promise<string> {
  const key = `${url}|${locale}`;
  const cached = captureCache.get(key);
  if (cached) return cached;

  const { context, page } = await openScreen(browser, url, locale);
  try {
    const shot = await page.screenshot({ type: 'png' });
    const uri = `data:image/png;base64,${shot.toString('base64')}`;
    captureCache.set(key, uri);
    return uri;
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tablet = await tabletSupport();
  const browser = await chromium.launch();
  const dev = await probeDevServer(browser);

  console.log(
    `dev server  ${DEV_URL} — ${
      dev.size > 0
        ? `${dev.size} route(s) verified, captured live`
        : 'no route identified itself via data-lexipulse-screen; using templates'
    }`,
  );
  console.log(`tablet      ${tablet.supported ? 'yes' : 'skipped'} — ${tablet.reason}\n`);

  try {
    for (const target of TARGETS) {
      if (target.tabletOnly && !tablet.supported) continue;

      const spec: FrameSpec = {
        width: target.width,
        height: target.height,
        scale: target.scale,
        kind: target.kind,
      };
      const screens = target.tabletOnly ? SCREENS.filter((s) => s.tablet) : SCREENS;

      const context = await browser.newContext({
        viewport: { width: target.width / target.scale, height: target.height / target.scale },
        deviceScaleFactor: target.scale,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();

      for (const locale of LOCALES) {
        const dir = outDir(locale, target.id);
        mkdirSync(dir, { recursive: true });

        for (const [index, screen] of screens.entries()) {
          const devRoute = dev.get(screen.id);
          let screenImage: string | undefined;
          if (devRoute) {
            screenImage = await captureRoute(browser, devRoute, locale);
          }

          const html = framePage({
            spec,
            headline: screen.headline[locale],
            sub: screen.sub[locale],
            appHtml: screen.body(locale),
            ...(screenImage ? { screenImage } : {}),
          });

          await page.setContent(html, { waitUntil: 'load' });
          await page.evaluate(() => document.fonts.ready);

          const name = `${String(index + 1).padStart(2, '0')}-${screen.id.replace(/^\d+-/, '')}.png`;
          const file = join(dir, name);
          const buffer = await page.screenshot({ type: 'png' });
          writeFileSync(file, buffer);
          results.push({
            path: file,
            width: target.width,
            height: target.height,
            bytes: buffer.length,
            source: devRoute ? 'dev-server' : 'template',
          });
        }
      }

      await context.close();
    }

    // Play Store feature graphic — one per locale, no device, just the lockup.
    for (const locale of LOCALES) {
      const context = await browser.newContext({
        viewport: { width: 512, height: 250 },
        deviceScaleFactor: 2,
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      await page.setContent(featureGraphicPage(locale, 512, 250), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      const dir = locale === 'de' ? OUT_ROOT : join(OUT_ROOT, 'en');
      mkdirSync(dir, { recursive: true });
      const file = join(dir, 'play-feature-graphic.png');
      const buffer = await page.screenshot({ type: 'png' });
      writeFileSync(file, buffer);
      results.push({ path: file, width: 1024, height: 500, bytes: buffer.length, source: 'template' });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Never trust the intended size — read it back off the encoded file.
  const sharp = (await import('sharp')).default;
  let mismatches = 0;
  console.log(`LexiPulse store screenshots — ${results.length} files\n`);
  for (const item of results) {
    const meta = await sharp(item.path).metadata();
    const ok = meta.width === item.width && meta.height === item.height;
    if (!ok) mismatches += 1;
    const rel = relative(REPO_ROOT, item.path).replace(/\\/g, '/');
    console.log(
      `  ${ok ? 'ok  ' : 'BAD '}${rel.padEnd(48)} ${String(meta.width)}x${String(meta.height)}`.padEnd(80) +
        `${(item.bytes / 1024).toFixed(0)} kB  [${item.source}]`,
    );
  }

  const total = results.reduce((sum, r) => sum + r.bytes, 0);
  console.log(`\n  total ${(total / 1024 / 1024).toFixed(2)} MB`);
  if (mismatches > 0) {
    console.error(`\n${mismatches} file(s) did not match the required resolution.`);
    process.exitCode = 1;
  }
}

await main();
