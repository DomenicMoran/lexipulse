/**
 * A very small Markdown renderer for the three legal documents in `store/legal`.
 *
 * It runs at build time over files this repository owns, so it only has to cover what
 * those files actually use: front matter, ATX headings, paragraphs, bullet lists,
 * pipe tables, horizontal rules, bold, inline code, Markdown links and bare URLs.
 * Everything is HTML-escaped before any tag is emitted, so a stray `<script>` in a
 * source file would be printed, not executed.
 */

export interface MarkdownDocument {
  title: string;
  description: string;
  updated: string;
  html: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline formatting. Input is escaped first, so the regexes only see safe text. */
function inline(raw: string): string {
  let out = escapeHtml(raw);

  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // [label](target)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) =>
    `<a href="${href}"${externalAttributes(href)}>${label}</a>`,
  );

  // Bare URLs and e-mail addresses that were not already turned into links.
  out = out.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+[^\s<).,;:])/g, (_m, lead: string, url: string) =>
    `${lead}<a href="${url}"${externalAttributes(url)}>${url}</a>`,
  );
  out = out.replace(
    /(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    (_m, lead: string, mail: string) => `${lead}<a href="mailto:${mail}">${mail}</a>`,
  );

  return out;
}

function externalAttributes(href: string): string {
  return /^https?:\/\//i.test(href) ? ' rel="noopener noreferrer" target="_blank"' : '';
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseFrontMatter(source: string): { meta: Record<string, string>; body: string } {
  if (!source.startsWith('---')) return { meta: {}, body: source };
  const end = source.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: source };
  const block = source.slice(3, end);
  const meta: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const match = /^([a-zA-Z_]+):\s*(.*)$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) meta[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: source.slice(end + 4) };
}

export function renderMarkdown(source: string): MarkdownDocument {
  const { meta, body } = parseFrontMatter(source);
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];

  /**
   * Address and contact blocks are written one item per line. Markdown would fold them
   * into a single run-on line, which is wrong for an Impressum. A block counts as such
   * when every one of its lines is short and none of them ends in sentence punctuation —
   * a condition ordinary prose, wrapped near 88 characters, never meets.
   */
  const isLineBlock = (lines: string[]): boolean =>
    lines.length > 1 && lines.every((line) => line.length < 60 && !/[.,;:!?]$/.test(line));

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const separator = isLineBlock(paragraph) ? '<br />' : ' ';
    html.push(`<p>${paragraph.map((line) => inline(line)).join(separator)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push(`<ul>${listItems.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').replace(/\s+$/, '');
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading?.[1] && heading[2]) {
      flushAll();
      const level = Math.min(heading[1].length, 4);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      html.push('<hr />');
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet?.[1]) {
      flushParagraph();
      listItems.push(bullet[1]);
      continue;
    }

    // Continuation line of the previous bullet.
    if (listItems.length > 0 && /^\s{2,}\S/.test(line)) {
      listItems[listItems.length - 1] = `${listItems[listItems.length - 1]} ${trimmed}`;
      continue;
    }

    if (trimmed.startsWith('|') && isTableSeparator(lines[i + 1]?.trim() ?? '')) {
      flushAll();
      const head = splitRow(trimmed);
      const rows: string[][] = [];
      let cursor = i + 2;
      while (cursor < lines.length && (lines[cursor] ?? '').trim().startsWith('|')) {
        rows.push(splitRow((lines[cursor] ?? '').trim()));
        cursor += 1;
      }
      i = cursor - 1;
      const thead = head.map((cell) => `<th>${inline(cell)}</th>`).join('');
      const tbody = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
        .join('');
      html.push(`<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushAll();

  // The title and the revision date come from front matter and are rendered by the page,
  // so the body's own H1 and "Stand:" line are dropped — otherwise both appear twice.
  const rendered = html
    .join('\n')
    .replace(/^<h1>[\s\S]*?<\/h1>\n?/, '')
    .replace(/^<p>Stand:[^<]*<\/p>\n?/, '');

  return {
    title: meta.title ?? 'Dokument',
    description: meta.description ?? '',
    updated: meta.updated ?? '',
    html: rendered,
  };
}
