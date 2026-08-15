import type { LexiDocument } from '../types.js';
import { cleanFlowText } from './clean.js';
import { extractArticle, extractAuthor, extractLanguage, extractTitle } from './html-text.js';
import { chunkIntoChapters, createDocumentId, finalizeDocument } from './shared.js';

export interface ArticleParseOptions {
  /** Canonical URL, stored as the document origin. */
  url?: string | null;
  fallbackTitle?: string;
  chapterWords?: number;
}

/** Parse a fetched HTML page into a reader-ready document. */
export function parseArticleHtml(
  html: string,
  options: ArticleParseOptions = {},
): LexiDocument {
  const started = Date.now();
  const { url = null, fallbackTitle = 'Web Article', chapterWords = 1200 } = options;

  const body = extractArticle(html);
  const cleaned = cleanFlowText(body);

  if (cleaned.text.trim().length === 0) {
    throw new Error('No article text found on this page.');
  }

  const title = extractTitle(html) ?? fallbackTitle;
  const author = extractAuthor(html);
  const language = extractLanguage(html);
  const chapters = chunkIntoChapters(cleaned.text, chapterWords, 'Section');

  return finalizeDocument({
    id: createDocumentId('html', title),
    title: stripSiteSuffix(title),
    author,
    source: 'html',
    origin: url,
    language,
    chapters,
    coverDataUrl: extractOgImage(html),
    importReport: {
      source: 'html',
      rawSections: chapters.length,
      removed: cleaned.removed,
      dehyphenated: cleaned.dehyphenated,
      notes: [`${chapters.length} sections extracted`, url ? `Source: ${url}` : ''].filter(
        (n) => n.length > 0,
      ),
      durationMs: Date.now() - started,
    },
  });
}

/** `Great Article — Some Magazine` → `Great Article`. */
export function stripSiteSuffix(title: string): string {
  const parts = title.split(/\s+[|–—·]\s+/);
  if (parts.length < 2) return title.trim();
  const head = (parts[0] as string).trim();
  return head.length >= 15 ? head : title.trim();
}

function extractOgImage(html: string): string | null {
  const m =
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html);
  const url = m?.[1]?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; redirect?: 'follow' },
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; url?: string }>;

/**
 * Fetch a URL and parse it. Must run server-side (or in the native app) — browsers
 * block cross-origin reads, which is why the web app routes this through `/api/extract`.
 */
export async function fetchArticle(
  url: string,
  fetchImpl: FetchLike,
  options: ArticleParseOptions = {},
): Promise<LexiDocument> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be imported.');
  }

  const response = await fetchImpl(parsed.toString(), {
    headers: {
      'user-agent': 'LexiPulse/1.0 (+https://lexipulse.de) article-extractor',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'de,en;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Could not fetch the page (HTTP ${response.status}).`);
  }

  const html = await response.text();
  return parseArticleHtml(html, { ...options, url: response.url ?? parsed.toString() });
}
