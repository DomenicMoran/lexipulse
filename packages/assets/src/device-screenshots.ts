/**
 * Store screenshots built from real device captures.
 *
 * The older path in `store-screenshots.ts` renders the *web* app into a phone frame,
 * which produced listings showing a tab bar along the top and a keyboard button — neither
 * of which exists in the app being sold. Apple treats a screenshot that is not the app as
 * grounds for rejection (2.3.3), and it misleads buyers either way.
 *
 * This takes captures made on a device (`adb exec-out screencap`), one set per language,
 * and drops them into the same frames and headlines. What the store shows is then exactly
 * what installs.
 *
 * Run: `pnpm --filter @lexipulse/assets device-screenshots`
 * Captures are expected as `<CAPTURE_DIR>/<locale>-<screen id>.png`.
 */

import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

import { REPO_ROOT } from './fonts.js';
import { SCREENS } from './templates/screens.js';
import type { Locale } from './templates/screens.js';
import { framePage } from './templates/page.js';
import type { DeviceKind } from './templates/page.js';

const CAPTURE_DIR =
  process.env.LEXIPULSE_CAPTURES ??
  'C:/Users/domen/AppData/Local/Temp/claude/C--Users-domen-Documents-LexiPulse/618279e2-be9e-4643-a3d6-2c9b276777b0/scratchpad/shots';
const OUT_ROOT = join(REPO_ROOT, 'store', 'screenshots');
const LOCALES: readonly Locale[] = ['de', 'en'];

interface Target {
  id: string;
  requirement: string;
  width: number;
  height: number;
  scale: number;
  kind: DeviceKind;
}

const TARGETS: readonly Target[] = [
  {
    id: 'ios-6.9',
    requirement: 'App Store — iPhone 6.9" (1290x2796)',
    width: 1290,
    height: 2796,
    scale: 3,
    kind: 'phone',
  },
  {
    id: 'ios-6.5',
    requirement: 'App Store — iPhone 6.5" (1242x2688)',
    width: 1242,
    height: 2688,
    scale: 3,
    kind: 'phone',
  },
  {
    id: 'android-phone',
    requirement: 'Play — phone (1080x1920)',
    width: 1080,
    height: 1920,
    scale: 2,
    kind: 'phone',
  },
];

function captureFor(locale: Locale, screenId: string): string | null {
  const direct = join(CAPTURE_DIR, `${locale}-${screenId}.png`);
  if (existsSync(direct)) return direct;
  // Tolerate a trailing suffix, e.g. `de-01-player-final.png`.
  const prefix = `${locale}-${screenId}`;
  const hit = readdirSync(CAPTURE_DIR).find((f) => f.startsWith(prefix) && f.endsWith('.png'));
  return hit ? join(CAPTURE_DIR, hit) : null;
}

const dataUri = (path: string) =>
  `data:image/png;base64,${readFileSync(path).toString('base64')}`;

const browser = await chromium.launch();
const report: string[] = [];
let written = 0;
let missing = 0;

for (const locale of LOCALES) {
  for (const target of TARGETS) {
    // German lives at the root of the tree, English one level down — the layout the
    // existing upload scripts already expect.
    const dir =
      locale === 'de'
        ? join(OUT_ROOT, target.id)
        : join(OUT_ROOT, 'en', target.id);
    mkdirSync(dir, { recursive: true });

    for (const screen of SCREENS) {
      const capture = captureFor(locale, screen.id);
      if (!capture) {
        report.push(`MISSING  ${locale} ${target.id} ${screen.id}`);
        missing += 1;
        continue;
      }

      const page = await browser.newPage({
        viewport: { width: target.width / target.scale, height: target.height / target.scale },
        deviceScaleFactor: target.scale,
      });
      await page.setContent(
        framePage({
          spec: { width: target.width, height: target.height, scale: target.scale, kind: target.kind },
          headline: screen.headline[locale],
          sub: screen.sub[locale],
          appHtml: '',
          screenImage: dataUri(capture),
          // The emulator is 1080x2400; without this the frame keeps its 19.5:9 default and
          // crops the tab bar off the bottom.
          screenRatio: 1080 / 2400,
        }),
        { waitUntil: 'load' },
      );
      // The capture is a data URI, so decoding is the only thing left to wait for.
      await page.evaluate(async () => {
        await Promise.all(
          Array.from(document.images, (img) =>
            img.complete ? null : img.decode().catch(() => null),
          ),
        );
      });
      const out = join(dir, `${screen.id}.png`);
      await page.screenshot({ path: out });
      await page.close();
      written += 1;
      report.push(`ok       ${locale} ${target.id} ${screen.id}`);
    }
  }
}

await browser.close();

writeFileSync(join(OUT_ROOT, 'REPORT-device.txt'), `${report.join('\n')}\n`);
console.log(report.join('\n'));
console.log(`\n${written} geschrieben, ${missing} fehlend`);
if (missing > 0) process.exitCode = 1;
