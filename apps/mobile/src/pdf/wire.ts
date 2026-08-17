/**
 * The message format between the app and the surface inside the WebView.
 *
 * One definition, imported by both halves — the React Native side in `surface-bridge.tsx`
 * and the page itself in `scripts/pdf-surface-entry.tsx`. Two copies of a wire format is
 * how a protocol drifts: one side starts chunking at a different size, or spells a field
 * differently, and the failure is a call that never resolves with nothing on screen to
 * say why.
 *
 * Everything crosses as text. A `postMessage` carries strings, `injectJavaScript` carries
 * source code, and neither can hold a `Uint8Array` — so a PDF travels as base64, in
 * slices small enough that Android does not drop the call.
 */

/** Slice size for base64 payloads. A multi-megabyte injection fails outright on Android. */
export const WIRE_CHUNK = 64 * 1024;

/** Surface → app: one request. `blob` says binary slices were sent ahead of it. */
export interface WireCall {
  t: 'call';
  id: number;
  method: string;
  args: unknown[];
  blob: boolean;
}

/** Surface → app: one slice of the binary argument belonging to call `id`. */
export interface WireBlob {
  t: 'blob';
  id: number;
  /** Index of this slice. */
  i: number;
  /** How many slices there are in total. */
  n: number;
  d: string;
}

/** Surface → app: the page has finished evaluating and can be started. */
export interface WireReady {
  t: 'ready';
}

export type WireMessage = WireCall | WireBlob | WireReady;

/** Split a base64 payload into the frames that carry it. */
export function frameBlob(id: number, base64: string): WireBlob[] {
  const parts = Math.max(1, Math.ceil(base64.length / WIRE_CHUNK));
  const frames: WireBlob[] = [];
  for (let i = 0; i < parts; i += 1) {
    frames.push({
      t: 'blob',
      id,
      i,
      n: parts,
      d: base64.slice(i * WIRE_CHUNK, (i + 1) * WIRE_CHUNK),
    });
  }
  return frames;
}

/**
 * Collects the slices of a call's binary argument until the call itself arrives.
 *
 * Keyed by call id rather than kept in one buffer: two calls can be in flight at once —
 * a stamp being stored while a save is running — and a shared buffer would splice one
 * file into the middle of the other.
 */
export class BlobInbox {
  private readonly buffers = new Map<number, string[]>();

  accept(frame: WireBlob): void {
    let buffer = this.buffers.get(frame.id);
    if (!buffer) {
      buffer = new Array<string>(frame.n).fill('');
      this.buffers.set(frame.id, buffer);
    }
    buffer[frame.i] = frame.d;
  }

  /** The assembled payload for a call, removing it from the inbox. */
  take(id: number): string | null {
    const buffer = this.buffers.get(id);
    this.buffers.delete(id);
    return buffer ? buffer.join('') : null;
  }

  get size(): number {
    return this.buffers.size;
  }
}

/** Bytes → base64, in slices: spreading a multi-megabyte array blows the argument limit. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * A value, encoded so it survives being embedded in injected source.
 *
 * Stringified twice: once to JSON, once so that JSON is a valid string literal inside the
 * script. `?? null` because `undefined` has no JSON form and would inject the bare token
 * `undefined` into the call.
 */
export function scriptLiteral(value: unknown): string {
  return JSON.stringify(JSON.stringify(value ?? null));
}
