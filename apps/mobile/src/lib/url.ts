/**
 * URL handling for the article importer.
 *
 * Kept apart from `import.ts` because that module pulls in the document picker and the
 * file system, neither of which exists outside the app — these two functions are pure and
 * therefore the part worth testing.
 */

/** Treat a bare host as https, which is what someone pasting `spiegel.de` means. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Whether the input plausibly addresses a web page.
 *
 * `new URL()` alone is not enough: after normalisation even a single word parses fine as
 * `https://word`. Requiring a dotted host of some length is what separates an address
 * from a sentence the user meant to read as text.
 */
export function isProbablyUrl(input: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(input));
    return parsed.hostname.includes('.') && parsed.hostname.length > 3;
  } catch {
    return false;
  }
}
