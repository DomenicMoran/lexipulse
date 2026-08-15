/**
 * HTML → structured plain text, without a DOM.
 *
 * EPUB chapters and web articles both arrive as XHTML/HTML, and both have to work in
 * Node, in the browser and in React Native. A dependency-free scanner is the only thing
 * that behaves identically in all three.
 */

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'div',
  'dd',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

/** Elements whose entire subtree is chrome, never content. */
const DROP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'form',
  'button',
  'select',
  'textarea',
  'nav',
  'aside',
  'footer',
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '­',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  deg: '°',
  middot: '·',
  bull: '•',
  times: '×',
  minus: '−',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

export interface HtmlTextOptions {
  /** Keep heading text on its own paragraph (default true). */
  keepHeadings?: boolean;
  /** Drop nav/aside/footer subtrees (default true). */
  dropChrome?: boolean;
}

/**
 * Convert HTML to paragraph-separated plain text.
 * Block-level boundaries become blank lines; inline markup collapses to spaces.
 */
export function htmlToText(html: string, options: HtmlTextOptions = {}): string {
  const { dropChrome = true } = options;
  const out: string[] = [];
  let i = 0;

  // Strip comments, CDATA and doctypes up front — they never contain content.
  const src = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<!DOCTYPE[^>]*>/gi, '');
  const srcLength = src.length;

  while (i < srcLength) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      out.push(src.slice(i));
      break;
    }
    if (lt > i) out.push(src.slice(i, lt));

    const gt = src.indexOf('>', lt);
    if (gt === -1) {
      out.push(src.slice(lt));
      break;
    }

    const tagBody = src.slice(lt + 1, gt);
    const closing = tagBody.startsWith('/');
    const nameMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)/.exec(tagBody);
    const name = (nameMatch?.[1] ?? '').toLowerCase();

    if (!closing && dropChrome && DROP_TAGS.has(name) && !tagBody.endsWith('/')) {
      // Skip the whole subtree.
      const closeRe = new RegExp(`</\\s*${name}\\s*>`, 'i');
      const rest = src.slice(gt + 1);
      const closeMatch = closeRe.exec(rest);
      i = closeMatch ? gt + 1 + closeMatch.index + closeMatch[0].length : srcLength;
      out.push('\n\n');
      continue;
    }

    if (BLOCK_TAGS.has(name)) out.push('\n\n');
    else out.push(' ');

    i = gt + 1;
  }

  const text = decodeEntities(out.join(''))
    .replace(/­/g, '') // soft hyphens
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/** Text of the first `<title>` / `<h1>`, used when metadata is missing. */
export function extractTitle(html: string): string | null {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) {
    const t = decodeEntities(title[1]).replace(/\s+/g, ' ').trim();
    if (t.length > 0) return t;
  }
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1?.[1]) {
    const t = htmlToText(h1[1]).replace(/\s+/g, ' ').trim();
    if (t.length > 0) return t;
  }
  return null;
}

/** `<meta name="author">` / `<meta property="article:author">`. */
export function extractAuthor(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']author["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']author["']/i,
    /<meta[^>]+property=["']article:author["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:creator["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return null;
}

/** `<html lang>` or `<meta http-equiv="content-language">`. */
export function extractLanguage(html: string): string | null {
  const m =
    /<html[^>]+lang=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+http-equiv=["']content-language["'][^>]*content=["']([^"']+)["']/i.exec(html);
  return m?.[1]?.trim() ?? null;
}

/**
 * Article extraction: pick the densest content container instead of the whole page.
 *
 * Scores every `<article>`/`<main>`/`<div>` block by text length minus link-heavy
 * penalty, the same signal Readability uses, without needing a DOM.
 */
export function extractArticle(html: string): string {
  const semantic = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  if (semantic?.[1]) {
    const text = htmlToText(semantic[1]);
    if (text.length > 400) return text;
  }
  const main = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (main?.[1]) {
    const text = htmlToText(main[1]);
    if (text.length > 400) return text;
  }

  // Fall back to the best-scoring block-level container.
  const candidates: { text: string; score: number }[] = [];
  const blockRe =
    /<(div|section)[^>]*(?:class|id)=["'][^"']*(content|article|post|entry|story|body|text|main)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html)) !== null) {
    const inner = match[3] ?? '';
    const text = htmlToText(inner);
    const links = (inner.match(/<a\b/gi) ?? []).length;
    const paragraphs = (inner.match(/<p\b/gi) ?? []).length;
    const score = text.length + paragraphs * 120 - links * 60;
    if (text.length > 200) candidates.push({ text, score });
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return (candidates[0] as { text: string }).text;
  }

  // Last resort: strip <head> and take the body.
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return htmlToText(body?.[1] ?? html);
}
