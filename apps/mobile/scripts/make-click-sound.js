/**
 * Generates the sentence-end click.
 *
 * A 28 ms exponentially damped sine. Short and quiet on purpose: the sound marks a
 * boundary while the user is reading at 6-15 words a second, so anything with an audible
 * tail would still be ringing when the next sentence starts.
 *
 *   node scripts/make-click-sound.js
 */
const fs = require('node:fs');
const path = require('node:path');

const RATE = 44100;
const MS = 28;
const FREQ = 1180; // high enough to cut through, low enough not to be shrill
const PEAK = 0.22; // headroom: this plays under whatever else the user is listening to
const DECAY = 90; // 1/s

const samples = Math.round((RATE * MS) / 1000);
const data = Buffer.alloc(samples * 2);

for (let i = 0; i < samples; i += 1) {
  const t = i / RATE;
  const envelope = Math.exp(-DECAY * t);
  // A couple of milliseconds of fade-in kills the click-on-the-click that a hard start
  // produces on speakers with any DC offset.
  const attack = Math.min(1, t / 0.0015);
  const value = Math.sin(2 * Math.PI * FREQ * t) * envelope * attack * PEAK;
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value * 32767))), i * 2);
}

function chunk(id, payload) {
  const header = Buffer.alloc(8);
  header.write(id, 0, 'latin1');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

const fmt = Buffer.alloc(16);
fmt.writeUInt16LE(1, 0); // PCM
fmt.writeUInt16LE(1, 2); // mono
fmt.writeUInt32LE(RATE, 4);
fmt.writeUInt32LE(RATE * 2, 8); // byte rate
fmt.writeUInt16LE(2, 12); // block align
fmt.writeUInt16LE(16, 14); // bits per sample

const body = Buffer.concat([Buffer.from('WAVE', 'latin1'), chunk('fmt ', fmt), chunk('data', data)]);
const riff = Buffer.alloc(8);
riff.write('RIFF', 0, 'latin1');
riff.writeUInt32LE(body.length, 4);

const outDir = path.resolve(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'click.wav');
fs.writeFileSync(outFile, Buffer.concat([riff, body]));

process.stdout.write(`wrote assets/audio/click.wav — ${samples} samples, ${MS} ms\n`);
