import { fetchArticle, type FetchLike } from '@lexipulse/core';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';

/**
 * Server-side article extraction for the URL import.
 *
 * The browser cannot read a cross-origin page, so this endpoint does it instead. That
 * makes it a classic SSRF surface: whatever address a visitor types, our server dials.
 * Everything below is written fail-closed — anything not explicitly permitted is refused.
 *
 * PRIVACY: the requested URL is never written to a log, a metric or a store. That is not
 * an oversight to be "fixed" later; section 5 of `store/legal/datenschutz.de.md` promises
 * exactly this to every visitor. Error responses therefore describe the failure without
 * echoing the address, and nothing here calls `console.log`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const ALLOWED_PORTS = new Set(['', '80', '443']);

/* ------------------------------------------------------------------ rate limiting */

const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS = 20;

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * One in-memory bucket per address. A serverless instance may hold only part of the
 * traffic, which is fine: this exists to stop one browser from using the endpoint as a
 * crawler, not to be a distributed quota system.
 */
const buckets = new Map<string, Bucket>();

function rateLimited(key: string, now: number): boolean {
  // Opportunistic sweep so the map cannot grow without bound on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [id, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(id);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : (request.headers.get('x-real-ip') ?? 'unknown');
}

/* ---------------------------------------------------------------- address filtering */

function ipv4Blocked(address: string): boolean {
  const parts = address.split('.').map(Number);
  const [a = 0, b = 0] = parts;
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  if (a === 0) return true; // 0.0.0.0/8, includes the "this host" address
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, and the cloud metadata endpoint
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast and reserved
  return false;
}

function ipv6Blocked(address: string): boolean {
  const value = address.toLowerCase().split('%')[0] ?? '';
  if (value === '::' || value === '::1') return true; // unspecified, loopback
  // IPv4-mapped (::ffff:10.0.0.1) has to be judged by its embedded v4 address.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped?.[1]) return ipv4Blocked(mapped[1]);
  if (/^f[cd]/.test(value)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(value)) return true; // fe80::/10 link-local
  if (/^ff/.test(value)) return true; // multicast
  if (/^(2001:db8|64:ff9b|100:)/.test(value)) return true; // documentation, NAT64, discard
  return false;
}

function addressBlocked(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return ipv4Blocked(address);
  if (family === 6) return ipv6Blocked(address);
  return true;
}

/**
 * Validate one hop.
 *
 * Scheme, port and hostname first, then every address the name resolves to. A name that
 * resolves to even one blocked address is refused outright — picking the "good" one
 * would just hand the attacker a retry.
 */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Das ist keine gültige Internetadresse.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Es lassen sich nur http- und https-Adressen importieren.');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new Error('Nur die Standard-Ports 80 und 443 sind zugelassen.');
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('Adressen mit Zugangsdaten werden nicht abgerufen.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname.length === 0 || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Diese Adresse verweist auf das lokale Netz.');
  }

  if (isIP(hostname) !== 0) {
    if (addressBlocked(hostname)) throw new Error('Diese Adresse verweist auf ein internes Netz.');
    return url;
  }

  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new Error('Der Name dieser Seite konnte nicht aufgelöst werden.');
  }
  if (records.length === 0) throw new Error('Der Name dieser Seite konnte nicht aufgelöst werden.');
  if (records.some((record) => addressBlocked(record.address))) {
    throw new Error('Diese Adresse verweist auf ein internes Netz.');
  }

  return url;
}

/* ------------------------------------------------------------------------- fetching */

interface FetchedPage {
  html: string;
  finalUrl: string;
}

/**
 * Follow redirects by hand.
 *
 * `redirect: 'follow'` would let the first hop point anywhere — including back at our own
 * network — without a second check. Each `Location` is therefore re-validated before it
 * is dialled.
 */
async function fetchHtml(startUrl: URL, signal: AbortSignal): Promise<FetchedPage> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal,
      headers: {
        'user-agent': 'LexiPulse/1.0 (+https://lexipulse.de) article-extractor',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'de,en;q=0.8',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      void response.body?.cancel();
      if (!location) throw new Error('Die Seite hat eine unvollständige Weiterleitung geschickt.');
      if (hop === MAX_REDIRECTS) throw new Error('Die Seite leitet zu oft weiter.');
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      void response.body?.cancel();
      throw new Error(`Die Seite hat mit HTTP ${response.status} geantwortet.`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!/^\s*(text\/html|application\/xhtml\+xml)\s*(;|$)/i.test(contentType)) {
      void response.body?.cancel();
      throw new Error('Diese Adresse liefert keine HTML-Seite.');
    }

    const declared = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      void response.body?.cancel();
      throw new Error('Die Seite ist größer als 5 MB.');
    }

    return { html: await readCapped(response), finalUrl: current.toString() };
  }

  throw new Error('Die Seite leitet zu oft weiter.');
}

/** Read the body but stop hard at the cap — a declared length can lie. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error('Die Seite ist größer als 5 MB.');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

/* --------------------------------------------------------------------------- route */

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(clientKey(request), Date.now())) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte in einigen Minuten erneut versuchen.' },
      { status: 429, headers: { 'retry-after': '600' } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const url = (raw as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
    return NextResponse.json({ error: 'Es wurde keine Adresse übergeben.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const safe = await assertSafeUrl(url);
    const page = await fetchHtml(safe, controller.signal);

    // `fetchArticle` expects to do the fetching itself. It is handed the page we already
    // fetched under the rules above, so no unchecked request can slip out from here.
    const fetchImpl: FetchLike = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        url: page.finalUrl,
        text: () => Promise.resolve(page.html),
      });

    const document = await fetchArticle(page.finalUrl, fetchImpl);
    return NextResponse.json(
      { document },
      { headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } },
    );
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    const message = aborted
      ? 'Die Seite hat nicht innerhalb von 10 Sekunden geantwortet.'
      : cause instanceof Error
        ? cause.message
        : 'Die Seite konnte nicht gelesen werden.';
    return NextResponse.json({ error: message }, { status: aborted ? 504 : 400 });
  } finally {
    clearTimeout(timer);
  }
}

export function GET(): Response {
  return NextResponse.json({ error: 'Nur POST.' }, { status: 405, headers: { allow: 'POST' } });
}
