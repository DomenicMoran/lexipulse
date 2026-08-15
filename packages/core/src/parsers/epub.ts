import JSZip from 'jszip';
import type { DocumentChapter, ImportReport, LexiDocument } from '../types.js';
import { cleanFlowText, emptyReport } from './clean.js';
import { decodeEntities, htmlToText } from './html-text.js';
import { createDocumentId, finalizeDocument } from './shared.js';

/** Minimal XML attribute reader — EPUB OPF/NCX are well-formed by spec. */
function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i');
  return re.exec(tag)?.[1] ?? null;
}

function tags(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b[^>]*/?>`, 'gi');
  return xml.match(re) ?? [];
}

function textOf(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = re.exec(xml);
  return m?.[1] ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : null;
}

/** Resolve an EPUB-relative href against the directory of the OPF. */
export function resolveHref(base: string, href: string): string {
  const cleaned = href.split('#')[0] ?? href;
  const decoded = decodeURIComponent(cleaned);
  if (base.length === 0) return normalizePath(decoded);
  return normalizePath(`${base}/${decoded}`);
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function dirOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export interface EpubParseOptions {
  /** Merge spine items shorter than this into the previous chapter. */
  minChapterChars?: number;
  /** Extract the cover image as a data URL (default true). */
  includeCover?: boolean;
  origin?: string | null;
}

/** Titles taken from the NCX / nav document, keyed by resolved content path. */
async function readTocTitles(zip: JSZip, opfPath: string, opf: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const base = dirOf(opfPath);

  // EPUB 2: toc.ncx referenced from the spine's `toc` attribute.
  const spineTag = /<spine\b[^>]*>/i.exec(opf)?.[0] ?? '';
  const tocId = attr(spineTag, 'toc');
  const manifestItems = tags(opf, 'item');

  const findHrefById = (id: string): string | null => {
    for (const item of manifestItems) {
      if (attr(item, 'id') === id) return attr(item, 'href');
    }
    return null;
  };

  if (tocId) {
    const ncxHref = findHrefById(tocId);
    if (ncxHref) {
      const ncx = await zip.file(resolveHref(base, ncxHref))?.async('string');
      if (ncx) {
        const navPoints = ncx.match(/<navPoint\b[\s\S]*?<\/navPoint>/gi) ?? [];
        for (const point of navPoints) {
          const label = textOf(point, 'text');
          const contentTag = /<content\b[^>]*>/i.exec(point)?.[0] ?? '';
          const src = attr(contentTag, 'src');
          if (label && src) map.set(resolveHref(dirOf(resolveHref(base, ncxHref)), src), label);
        }
      }
    }
  }

  // EPUB 3: nav document with epub:type="toc".
  for (const item of manifestItems) {
    const props = attr(item, 'properties') ?? '';
    if (!props.includes('nav')) continue;
    const href = attr(item, 'href');
    if (!href) continue;
    const navPath = resolveHref(base, href);
    const nav = await zip.file(navPath)?.async('string');
    if (!nav) continue;
    const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(nav)) !== null) {
      const label = htmlToText(m[2] ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      if (label && m[1]) map.set(resolveHref(dirOf(navPath), m[1]), label);
    }
  }

  return map;
}

async function readCover(zip: JSZip, opfPath: string, opf: string): Promise<string | null> {
  const base = dirOf(opfPath);
  const items = tags(opf, 'item');
  let coverHref: string | null = null;

  for (const item of items) {
    if ((attr(item, 'properties') ?? '').includes('cover-image')) {
      coverHref = attr(item, 'href');
      break;
    }
  }
  if (!coverHref) {
    const metaTag = tags(opf, 'meta').find((t) => (attr(t, 'name') ?? '') === 'cover');
    const coverId = metaTag ? attr(metaTag, 'content') : null;
    if (coverId) {
      for (const item of items) {
        if (attr(item, 'id') === coverId) {
          coverHref = attr(item, 'href');
          break;
        }
      }
    }
  }
  if (!coverHref) return null;

  const path = resolveHref(base, coverHref);
  const file = zip.file(path);
  if (!file) return null;
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? 'image/jpeg';
  const b64 = await file.async('base64');
  return `data:${mime};base64,${b64}`;
}

/**
 * Parse an EPUB 2 or EPUB 3 file into a reader-ready document.
 * `data` may be an ArrayBuffer, Uint8Array or base64 string.
 */
export async function parseEpub(
  data: ArrayBuffer | Uint8Array | string,
  options: EpubParseOptions = {},
): Promise<LexiDocument> {
  const started = Date.now();
  const { minChapterChars = 240, includeCover = true, origin = null } = options;

  const zip = await JSZip.loadAsync(data as ArrayBuffer, {
    base64: typeof data === 'string',
  });

  const container = await zip.file('META-INF/container.xml')?.async('string');
  if (!container) throw new Error('Not a valid EPUB: META-INF/container.xml is missing.');

  const rootfileTag = /<rootfile\b[^>]*>/i.exec(container)?.[0] ?? '';
  const opfPath = attr(rootfileTag, 'full-path');
  if (!opfPath) throw new Error('Not a valid EPUB: container.xml has no rootfile path.');

  const opf = await zip.file(opfPath)?.async('string');
  if (!opf) throw new Error(`Not a valid EPUB: ${opfPath} is missing.`);

  const base = dirOf(opfPath);
  const metadataBlock = /<metadata\b[\s\S]*?<\/metadata>/i.exec(opf)?.[0] ?? opf;
  const title = textOf(metadataBlock, 'dc:title') ?? textOf(metadataBlock, 'title') ?? 'Untitled';
  const author = textOf(metadataBlock, 'dc:creator') ?? textOf(metadataBlock, 'creator');
  const language = textOf(metadataBlock, 'dc:language') ?? textOf(metadataBlock, 'language');

  // Manifest: id → { href, mediaType }
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const item of tags(opf, 'item')) {
    const id = attr(item, 'id');
    const href = attr(item, 'href');
    if (!id || !href) continue;
    manifest.set(id, { href, mediaType: attr(item, 'media-type') ?? '' });
  }

  const spineIds: string[] = [];
  const spineBlock = /<spine\b[\s\S]*?<\/spine>/i.exec(opf)?.[0] ?? '';
  for (const ref of tags(spineBlock, 'itemref')) {
    const idref = attr(ref, 'idref');
    if (!idref) continue;
    if ((attr(ref, 'linear') ?? 'yes').toLowerCase() === 'no') continue;
    spineIds.push(idref);
  }

  const tocTitles = await readTocTitles(zip, opfPath, opf);
  const removed: ImportReport['removed'] = emptyReport();
  let dehyphenated = 0;
  const chapters: DocumentChapter[] = [];
  let rawSections = 0;
  /** Leading fragments held back until a real chapter exists to attach them to. */
  let pendingPrefix = '';

  for (const id of spineIds) {
    const entry = manifest.get(id);
    if (!entry) continue;
    if (entry.mediaType && !/xhtml|html|xml/i.test(entry.mediaType)) continue;

    const path = resolveHref(base, entry.href);
    const file = zip.file(path);
    if (!file) continue;
    rawSections += 1;

    const html = await file.async('string');
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    const raw = htmlToText(bodyMatch?.[1] ?? html);
    if (raw.trim().length === 0) continue;

    const cleaned = cleanFlowText(raw);
    removed.artifacts += cleaned.removed.artifacts;
    dehyphenated += cleaned.dehyphenated;

    const heading =
      tocTitles.get(path) ??
      /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i
        .exec(html)?.[1]
        ?.replace(/<[^>]+>/g, '')
        .trim() ??
      null;

    const hasTitle = heading !== null && heading.length > 0;
    const previous = chapters[chapters.length - 1];
    if (!hasTitle && cleaned.text.length < minChapterChars) {
      // Untitled fragments — section breaks, stray front matter, a single epigraph —
      // belong to a neighbouring chapter. A section with a real title is never merged,
      // however short it is, because the outline would lose an entry.
      if (previous) {
        previous.text = `${previous.text}\n\n${cleaned.text}`.trim();
      } else {
        // Nothing to attach to yet (cover, copyright page): hold it for the next chapter.
        pendingPrefix = `${pendingPrefix}\n\n${cleaned.text}`.trim();
      }
      continue;
    }

    chapters.push({
      id: `${id}`,
      title: (hasTitle ? (heading as string) : `Chapter ${chapters.length + 1}`).slice(0, 160),
      text: pendingPrefix.length > 0 ? `${pendingPrefix}\n\n${cleaned.text}` : cleaned.text,
      startToken: 0,
      tokenCount: 0,
    });
    pendingPrefix = '';
  }

  if (chapters.length === 0) {
    throw new Error('EPUB contained no readable text.');
  }

  const cover = includeCover ? await readCover(zip, opfPath, opf) : null;

  return finalizeDocument({
    id: createDocumentId('epub', title),
    title,
    author,
    source: 'epub',
    origin,
    language,
    chapters,
    coverDataUrl: cover,
    importReport: {
      source: 'epub',
      rawSections,
      removed,
      dehyphenated,
      notes: [
        `${chapters.length} chapters from ${rawSections} spine items`,
        dehyphenated > 0 ? `${dehyphenated} hyphenated line breaks rejoined` : '',
      ].filter((n) => n.length > 0),
      durationMs: Date.now() - started,
    },
  });
}
