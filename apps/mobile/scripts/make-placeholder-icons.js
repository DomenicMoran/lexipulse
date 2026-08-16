/**
 * Placeholder app artwork.
 *
 * The real icons come from `packages/assets`. Until they land, Expo still has to find a
 * file at every path app.config.ts references or the build aborts before it starts — so
 * this writes stand-ins with the right dimensions and the right two colours.
 *
 * Deliberately dependency-free: a raw RGBA buffer through zlib is a valid PNG, and
 * pulling sharp into the mobile app just to draw a rectangle would be worse.
 *
 *   node scripts/make-placeholder-icons.js
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BLACK = [0x00, 0x00, 0x00, 0xff];
const CORAL = [0xff, 0x4d, 0x4d, 0xff];
const TRANSPARENT = [0x00, 0x00, 0x00, 0x00];
const WHITE = [0xff, 0xff, 0xff, 0xff];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA pixel buffer as a PNG (colour type 6, 8 bit, no filtering). */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function canvas(size, background) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    buf[i * 4] = background[0];
    buf[i * 4 + 1] = background[1];
    buf[i * 4 + 2] = background[2];
    buf[i * 4 + 3] = background[3];
  }
  return buf;
}

function rect(buf, size, x0, y0, w, h, color) {
  for (let y = Math.max(0, y0); y < Math.min(size, y0 + h); y += 1) {
    for (let x = Math.max(0, x0); x < Math.min(size, x0 + w); x += 1) {
      const i = (y * size + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = color[3];
    }
  }
}

/**
 * The mark: a slab "L" with the ORP dot sitting where the pivot character would be.
 * `scale` shrinks it into the adaptive-icon safe zone (the outer 33 % gets masked away).
 */
function drawMark(buf, size, glyphColor, dotColor, scale = 1) {
  const u = size / 24;
  const cx = size / 2;
  const cy = size / 2;
  const s = (n) => n * u * scale;
  const left = cx - s(6);
  const top = cy - s(7);
  rect(buf, size, Math.round(left), Math.round(top), Math.round(s(3)), Math.round(s(14)), glyphColor);
  rect(
    buf,
    size,
    Math.round(left),
    Math.round(top + s(11)),
    Math.round(s(10)),
    Math.round(s(3)),
    glyphColor,
  );
  const d = Math.round(s(3.2));
  rect(buf, size, Math.round(cx + s(3)), Math.round(cy - s(6)), d, d, dotColor);
}

const outDir = path.resolve(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon.png', size: 1024, bg: BLACK, glyph: WHITE, dot: CORAL, scale: 1 },
  { file: 'adaptive-icon.png', size: 1024, bg: TRANSPARENT, glyph: WHITE, dot: CORAL, scale: 0.62 },
  {
    file: 'adaptive-icon-monochrome.png',
    size: 1024,
    bg: TRANSPARENT,
    glyph: WHITE,
    dot: WHITE,
    scale: 0.62,
  },
  { file: 'splash-icon.png', size: 512, bg: TRANSPARENT, glyph: WHITE, dot: CORAL, scale: 0.9 },
  { file: 'favicon.png', size: 64, bg: BLACK, glyph: WHITE, dot: CORAL, scale: 1 },
  { file: 'notification-icon.png', size: 96, bg: TRANSPARENT, glyph: WHITE, dot: WHITE, scale: 1 },
];

for (const t of targets) {
  const file = path.join(outDir, t.file);
  // Never overwrite: once `packages/assets` has delivered the real artwork, running this
  // again must not quietly replace it with a stand-in.
  if (fs.existsSync(file)) {
    process.stdout.write(`skipped assets/${t.file} — already present\n`);
    continue;
  }
  const buf = canvas(t.size, t.bg);
  drawMark(buf, t.size, t.glyph, t.dot, t.scale);
  fs.writeFileSync(file, encodePng(t.size, t.size, buf));
  process.stdout.write(`wrote assets/${t.file} (${t.size}x${t.size})\n`);
}
