/**
 * Generates every raster and vector brand asset LexiPulse ships.
 *
 * Run: `pnpm --filter @lexipulse/assets generate`
 *
 * The script is idempotent — same inputs, same bytes — so it can be re-run on every
 * build without churning the working tree. Each target carries a comment naming the
 * store rule it satisfies, because "1024 x 1024, no alpha" is not a design choice, it
 * is App Store Connect rejecting the binary otherwise.
 */

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import {
  appIconSvg,
  faviconSvg,
  logoSvg,
  ogImageSvg,
  safeAreaForCircle,
  splashSvg,
  wordmarkSvg,
  PALETTE,
} from './brand.js';
import { bootstrapFonts, PACKAGE_ROOT, REPO_ROOT } from './fonts.js';

// This may re-exec the process (see bootstrapFonts). Nothing that touches sharp may run
// before it, which is why sharp is imported dynamically on the line after.
const fontsReady = bootstrapFonts();
const sharp = (await import('sharp')).default;

const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const WEB_ICONS = join(WEB_PUBLIC, 'icons');
const MOBILE_ASSETS = join(REPO_ROOT, 'apps', 'mobile', 'assets');
const OUT_DIR = join(PACKAGE_ROOT, 'out');

interface Written {
  path: string;
  bytes: number;
  dimensions: string;
  note: string;
}

const written: Written[] = [];

function write(path: string, data: Buffer | string, dimensions: string, note: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  written.push({ path, bytes: statSync(path).size, dimensions, note });
}

/**
 * Rasterise an SVG at `size`. Small targets are drawn at 8x and downsampled with
 * lanczos: librsvg's own antialiasing at 16 px turns hairlines into grey mush, while a
 * supersampled downscale keeps the stem and the ORP block distinct.
 */
async function raster(
  makeSvg: (size: number) => string,
  size: number,
  opts: { flatten?: string } = {},
): Promise<Buffer> {
  const factor = size < 128 ? 8 : 1;
  const svg = makeSvg(size * factor);
  let pipe = sharp(Buffer.from(svg));
  if (factor !== 1) pipe = pipe.resize(size, size, { kernel: 'lanczos3', fit: 'fill' });
  if (opts.flatten) pipe = pipe.flatten({ background: opts.flatten });
  return pipe.png({ compressionLevel: 9, effort: 10 }).toBuffer();
}

async function rasterExact(svg: string, opts: { flatten?: string } = {}): Promise<Buffer> {
  let pipe = sharp(Buffer.from(svg));
  if (opts.flatten) pipe = pipe.flatten({ background: opts.flatten });
  return pipe.png({ compressionLevel: 9, effort: 10 }).toBuffer();
}

/**
 * Pack PNGs into an .ico. PNG-compressed entries are legal since Vista and understood
 * by every browser we care about, so no BMP/AND-mask encoding is needed.
 */
function buildIco(entries: readonly { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach((entry, i) => {
    const at = i * 16;
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 0);
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    directory.writeUInt8(0, at + 2); // palette colours
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(entry.data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });

  return Buffer.concat([header, directory, ...entries.map((e) => e.data)]);
}

// ---------------------------------------------------------------------------
// Safe areas
// ---------------------------------------------------------------------------

/**
 * Android maskable icons are cropped to an arbitrary shape; only the inner circle at
 * 80 % of the edge is guaranteed to survive. `safeAreaForCircle` solves for the largest
 * scale whose farthest corner still sits inside that circle, and we keep a margin below
 * it so the mark is not flush against the crop line.
 */
const MASKABLE_LIMIT = safeAreaForCircle(0.8);
const MASKABLE_SAFE = MASKABLE_LIMIT * 0.85;

/** Adaptive icon layers: 108 dp canvas, 66 dp guaranteed-visible circle. */
const ADAPTIVE_LIMIT = safeAreaForCircle(66 / 108);
const ADAPTIVE_SAFE = ADAPTIVE_LIMIT * 0.9;

const MONO_ADAPTIVE_SAFE = safeAreaForCircle(66 / 108, true) * 0.9;

// ---------------------------------------------------------------------------

async function generateWeb(): Promise<void> {
  // Browsers scale the SVG favicon themselves, so it ships the reduced construction too.
  write(
    join(WEB_PUBLIC, 'favicon.svg'),
    faviconSvg(64),
    '64x64 (scalable)',
    'Modern browsers; reduced mark so it survives the tab strip.',
  );

  const icoSizes = [16, 32, 48];
  const icoEntries = await Promise.all(
    icoSizes.map(async (size) => ({ size, data: await raster(faviconSvg, size) })),
  );
  write(
    join(WEB_PUBLIC, 'favicon.ico'),
    buildIco(icoEntries),
    icoSizes.map((s) => `${s}x${s}`).join(', '),
    'Legacy /favicon.ico probe, Windows pinned sites, RSS readers.',
  );

  // PWA "any" icons: not masked by the launcher, so they carry their own squircle.
  for (const size of [192, 512]) {
    const svg = appIconSvg(size, { radius: 0.225, safeArea: 0.86, background: PALETTE.black, border: true });
    write(
      join(WEB_ICONS, `icon-${size}.png`),
      await rasterExact(svg),
      `${size}x${size}`,
      'Web app manifest purpose="any"; 192 is the install minimum, 512 the splash source.',
    );
  }

  // PWA maskable icons: full bleed, content inside the 80 % safe circle.
  for (const size of [192, 512]) {
    const svg = appIconSvg(size, { radius: 0, safeArea: MASKABLE_SAFE, background: PALETTE.black });
    write(
      join(WEB_ICONS, `icon-maskable-${size}.png`),
      await rasterExact(svg),
      `${size}x${size}`,
      `Manifest purpose="maskable"; content within the 80 % circle (scale ${MASKABLE_SAFE.toFixed(3)} of ${MASKABLE_LIMIT.toFixed(3)} allowed).`,
    );
  }

  // iOS home screen: iOS applies its own mask and rejects transparency, so flatten.
  write(
    join(WEB_ICONS, 'apple-touch-icon.png'),
    await rasterExact(appIconSvg(180, { radius: 0, safeArea: 0.78, background: PALETTE.black }), {
      flatten: PALETTE.black,
    }),
    '180x180',
    'apple-touch-icon; opaque, square, iOS rounds it itself.',
  );

  write(
    join(WEB_PUBLIC, 'og-image.png'),
    await rasterExact(ogImageSvg()),
    '1200x630',
    'Open Graph / Twitter summary_large_image; 1.91:1.',
  );
}

async function generateMobile(): Promise<void> {
  // App Store Connect rejects an icon with an alpha channel — flatten, never trim.
  write(
    join(MOBILE_ASSETS, 'icon.png'),
    await rasterExact(appIconSvg(1024, { radius: 0, safeArea: 0.78, background: PALETTE.black }), {
      flatten: PALETTE.black,
    }),
    '1024x1024',
    'expo.icon; iOS + fallback Android. Square, opaque, no alpha (ASC rule).',
  );

  const foreground = appIconSvg(1024, { background: null, safeArea: ADAPTIVE_SAFE });
  write(
    join(MOBILE_ASSETS, 'adaptive-icon.png'),
    await rasterExact(foreground),
    '1024x1024',
    `Android adaptive foreground; content inside the 66/108 dp circle (scale ${ADAPTIVE_SAFE.toFixed(3)} of ${ADAPTIVE_LIMIT.toFixed(3)} allowed).`,
  );

  write(
    join(MOBILE_ASSETS, 'adaptive-icon-monochrome.png'),
    await rasterExact(
      appIconSvg(1024, {
        background: null,
        safeArea: MONO_ADAPTIVE_SAFE,
        simple: true,
        monochrome: '#FFFFFF',
      }),
    ),
    '1024x1024',
    'Android 13 themed-icon layer; single-colour silhouette, the system tints it.',
  );

  // Expo's splash plugin takes a square logo and scales it to `imageWidth` dp on a solid
  // colour — verified against expo-splash-screen's plugin defaults (imageWidth 100).
  // A phone-sized 1284x2778 canvas would be scaled down to a smear.
  write(
    join(MOBILE_ASSETS, 'splash-icon.png'),
    await rasterExact(splashSvg(1024, 1024, { background: null, markScale: 0.86 })),
    '1024x1024',
    'expo-splash-screen image; square, transparent, plugin scales it to imageWidth dp.',
  );

  // Android strips colour from notification icons and keeps only the alpha channel.
  write(
    join(MOBILE_ASSETS, 'notification-icon.png'),
    await raster(
      (size) => appIconSvg(size, { background: null, safeArea: 0.9, simple: true, monochrome: '#FFFFFF' }),
      96,
    ),
    '96x96',
    'Android notification small icon (24 dp @ xxxhdpi); white on transparent, alpha only.',
  );

  write(
    join(MOBILE_ASSETS, 'favicon.png'),
    await raster(faviconSvg, 48),
    '48x48',
    'expo.web.favicon.',
  );
}

function generateVector(): void {
  write(
    join(OUT_DIR, 'logo-dark.svg'),
    logoSvg({ variant: 'dark', withWordmark: true }),
    '362x96 (scalable)',
    'Lockup for dark backgrounds; transparent.',
  );
  write(
    join(OUT_DIR, 'logo-light.svg'),
    logoSvg({ variant: 'light', withWordmark: true }),
    '362x96 (scalable)',
    'Lockup for light backgrounds; transparent.',
  );
  write(
    join(OUT_DIR, 'logo-mark.svg'),
    appIconSvg(512, { background: null, safeArea: 0.86 }),
    '512x512 (scalable)',
    'Mark only, no plate — favicon source, app-store press kit, watermark.',
  );
  write(
    join(OUT_DIR, 'wordmark.svg'),
    wordmarkSvg({ variant: 'dark' }),
    '456x112 (scalable)',
    'Wordmark alone. Uses JetBrains Mono as live text; convert to outlines before handing it to a third party.',
  );
}

async function main(): Promise<void> {
  if (!fontsReady) {
    console.warn('! packages/assets/fonts is missing — text assets fall back to system faces.');
  }

  await generateWeb();
  await generateMobile();
  generateVector();

  console.log(`\nLexiPulse assets — ${written.length} files\n`);
  const pad = Math.max(...written.map((w) => relative(REPO_ROOT, w.path).length));
  for (const item of written) {
    const rel = relative(REPO_ROOT, item.path).replace(/\\/g, '/');
    const kb = `${(item.bytes / 1024).toFixed(1)} kB`;
    console.log(`  ${rel.padEnd(pad)}  ${item.dimensions.padEnd(20)}  ${kb.padStart(9)}`);
    console.log(`  ${''.padEnd(pad)}  ${item.note}`);
  }
  const total = written.reduce((sum, w) => sum + w.bytes, 0);
  console.log(`\n  total ${(total / 1024).toFixed(1)} kB`);
}

await main();
