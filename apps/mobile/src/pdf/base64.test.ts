import { describe, expect, it } from 'vitest';

import { bytesToBase64 } from './base64';

/**
 * Checked against Node's own encoder rather than against hand-written literals: the point
 * is that the output is real base64, not that it matches what the author expected.
 */
function reference(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

describe('bytesToBase64', () => {
  it('encodes an empty buffer', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });

  it('pads all three length classes correctly', () => {
    // The remainder of length % 3 decides the padding, and it is the single easiest
    // thing to get wrong in a hand-rolled encoder.
    for (const text of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef']) {
      const bytes = new Uint8Array(Buffer.from(text, 'utf8'));
      expect(bytesToBase64(bytes), text).toBe(reference(bytes));
    }
  });

  it('round-trips every possible byte value', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) bytes[i] = i;
    expect(bytesToBase64(bytes)).toBe(reference(bytes));
  });

  it('matches the reference encoder on a PDF-like binary blob', () => {
    // Deterministic pseudo-random bytes: a real PDF is high-entropy binary, which is
    // exactly where a sign or shift error would show up.
    const bytes = new Uint8Array(5000);
    let seed = 12345;
    for (let i = 0; i < bytes.length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      bytes[i] = seed & 0xff;
    }
    expect(bytesToBase64(bytes)).toBe(reference(bytes));
  });

  it('emits only base64 characters, so it needs no escaping when injected', () => {
    const bytes = new Uint8Array(1024);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 7) & 0xff;
    // The bridge injects this straight into a JS string literal in the WebView; a quote,
    // backslash or newline slipping through would be a script-injection bug.
    expect(bytesToBase64(bytes)).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
  });
});
