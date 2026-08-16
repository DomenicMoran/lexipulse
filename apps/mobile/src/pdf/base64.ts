const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Bytes to base64, without `btoa`.
 *
 * Hermes does expose `btoa`, but it only accepts a Latin-1 *string* — so a PDF would have
 * to be turned into a giant intermediate string first, doubling peak memory on a file that
 * can easily be 50 MB. Encoding straight from the buffer avoids that.
 *
 * This is the format the WebView bridge speaks, so a bug here corrupts every imported PDF
 * rather than failing loudly. Hence the tests.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const length = bytes.length;
  for (let i = 0; i < length; i += 3) {
    const a = bytes[i] as number;
    const b = i + 1 < length ? (bytes[i + 1] as number) : 0;
    const c = i + 2 < length ? (bytes[i + 2] as number) : 0;
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < length ? ALPHABET[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < length ? ALPHABET[c & 63] : '=';
  }
  return out;
}
