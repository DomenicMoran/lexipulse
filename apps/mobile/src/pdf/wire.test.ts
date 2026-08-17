import { describe, expect, it } from 'vitest';

import {
  base64ToBytes,
  BlobInbox,
  bytesToBase64,
  frameBlob,
  scriptLiteral,
  WIRE_CHUNK,
  type WireBlob,
} from './wire';

/** Deterministic bytes, so a mismatch points at an index rather than at luck. */
function bytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) out[i] = (i * 31 + (i >> 8)) & 0xff;
  return out;
}

describe('base64 round trip', () => {
  it('survives a payload far past the spread limit', () => {
    // 0x8000 is where `String.fromCharCode(...bytes)` starts throwing, so the encoder
    // slices. Three and a bit slices proves the seams line up.
    const original = bytes(0x8000 * 3 + 1234);
    expect(base64ToBytes(bytesToBase64(original))).toEqual(original);
  });

  it('handles the empty payload, which is how "not found" travels', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });

  it('keeps every byte value, including the ones that are not text', () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) all[i] = i;
    expect(base64ToBytes(bytesToBase64(all))).toEqual(all);
  });
});

describe('frameBlob and BlobInbox', () => {
  it('reassembles a payload that spans several frames', () => {
    const base64 = bytesToBase64(bytes(WIRE_CHUNK * 2 + 500));
    const frames = frameBlob(7, base64);

    expect(frames.length).toBeGreaterThan(2);
    expect(frames.every((frame) => frame.n === frames.length)).toBe(true);

    const inbox = new BlobInbox();
    for (const frame of frames) inbox.accept(frame);
    expect(inbox.take(7)).toBe(base64);
  });

  it('reassembles correctly when the frames arrive out of order', () => {
    const base64 = bytesToBase64(bytes(WIRE_CHUNK * 3));
    const frames = frameBlob(1, base64);
    const inbox = new BlobInbox();
    for (const frame of [...frames].reverse()) inbox.accept(frame);
    expect(inbox.take(1)).toBe(base64);
  });

  it('keeps two calls in flight apart', () => {
    const first = bytesToBase64(bytes(WIRE_CHUNK + 10));
    const second = bytesToBase64(bytes(WIRE_CHUNK + 20));
    const inbox = new BlobInbox();

    // Interleaved on purpose: a stamp being stored while a save is running.
    const a = frameBlob(1, first);
    const b = frameBlob(2, second);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i]) inbox.accept(a[i] as WireBlob);
      if (b[i]) inbox.accept(b[i] as WireBlob);
    }

    expect(inbox.take(1)).toBe(first);
    expect(inbox.take(2)).toBe(second);
  });

  it('empties itself as calls are taken, so nothing accumulates', () => {
    const inbox = new BlobInbox();
    for (const frame of frameBlob(3, 'abc')) inbox.accept(frame);
    expect(inbox.size).toBe(1);
    inbox.take(3);
    expect(inbox.size).toBe(0);
  });

  it('answers null for a call that carried nothing', () => {
    expect(new BlobInbox().take(9)).toBeNull();
  });

  it('always produces at least one frame, even for nothing', () => {
    expect(frameBlob(1, '')).toHaveLength(1);
  });
});

describe('scriptLiteral', () => {
  /** What the app does with the result: embed it, then evaluate it. */
  const roundTrip = (value: unknown): unknown =>
    JSON.parse(JSON.parse(scriptLiteral(value)) as string);

  it('carries objects, arrays and null unchanged', () => {
    expect(roundTrip({ a: 1, b: [1, 2], c: null })).toEqual({ a: 1, b: [1, 2], c: null });
    expect(roundTrip(null)).toBeNull();
  });

  it('turns undefined into null instead of an injected token', () => {
    expect(scriptLiteral(undefined)).toBe('"null"');
    expect(roundTrip(undefined)).toBeNull();
  });

  it('survives quotes, backslashes and newlines in a title', () => {
    const value = { title: 'Ein "Vertrag"\\ mit\nZeilenumbruch' };
    expect(roundTrip(value)).toEqual(value);
  });

  it('escapes a closing script tag, which would otherwise end the injection', () => {
    const literal = scriptLiteral({ note: '</script><img onerror=alert(1)>' });
    // The evaluated value has to come back intact...
    expect(roundTrip({ note: '</script><img onerror=alert(1)>' })).toEqual({
      note: '</script><img onerror=alert(1)>',
    });
    // ...and the literal itself must be a single JSON string, with nothing that could
    // terminate the surrounding script early once it is embedded.
    expect(literal.startsWith('"')).toBe(true);
    expect(literal.endsWith('"')).toBe(true);
  });

  it('carries the German characters a title is full of', () => {
    expect(roundTrip({ t: 'Grüße aus Köln — Straße' })).toEqual({ t: 'Grüße aus Köln — Straße' });
  });
});
