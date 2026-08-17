/**
 * The Play Store feature graphic, and nothing else.
 *
 * `store-screenshots.ts` also produces this image, but it rebuilds the whole screenshot
 * tree on the way and would overwrite the device captures in `store/screenshots` with
 * web-rendered ones. Those were replaced on purpose: a listing that shows the web app
 * instead of the app being sold is grounds for rejection under 2.3.3 and misleads buyers
 * either way. So the banner gets its own entry point.
 *
 * Run: `pnpm --filter @lexipulse/assets feature-graphic`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

import { REPO_ROOT } from './fonts.js';
import { featureGraphicPage } from './templates/page.js';
import type { Locale } from './templates/screens.js';

const OUT_ROOT = join(REPO_ROOT, 'store', 'screenshots');
const LOCALES: readonly Locale[] = ['de', 'en'];

/** Play wants exactly 1024x500; the page is rendered at half that and doubled. */
const WIDTH = 512;
const HEIGHT = 250;
const SCALE = 2;

const browser = await chromium.launch();
const written: string[] = [];

try {
  for (const locale of LOCALES) {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: SCALE,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.setContent(featureGraphicPage(locale, WIDTH, HEIGHT), { waitUntil: 'load' });
    // The lockup is set in a webfont; screenshotting before it lands gives a fallback face.
    await page.evaluate(() => document.fonts.ready);

    const dir = locale === 'de' ? OUT_ROOT : join(OUT_ROOT, 'en');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'play-feature-graphic.png');
    writeFileSync(file, await page.screenshot({ type: 'png' }));
    written.push(file);
    await context.close();
  }
} finally {
  await browser.close();
}

// Never trust the intended size: read it back off the encoded file.
const sharp = (await import('sharp')).default;
for (const file of written) {
  const meta = await sharp(file).metadata();
  const ok = meta.width === WIDTH * SCALE && meta.height === HEIGHT * SCALE;
  console.log(`${ok ? 'ok  ' : 'FALSCHE GROESSE'} ${file} ${meta.width}x${meta.height}`);
  if (!ok) process.exitCode = 1;
}
