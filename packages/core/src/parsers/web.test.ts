import { describe, expect, it, vi } from 'vitest';
import { decodeEntities, extractArticle, htmlToText } from './html-text.js';
import { fetchArticle, parseArticleHtml, stripSiteSuffix } from './web.js';

const ARTICLE_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <title>Warum RSVP funktioniert | Lesemagazin</title>
  <meta name="author" content="Anna Berg">
  <meta property="og:image" content="https://example.com/cover.jpg">
  <script>window.tracking = true;</script>
  <style>.ad { display: none }</style>
</head>
<body>
  <nav><a href="/">Start</a><a href="/impressum">Impressum</a></nav>
  <article>
    <h1>Warum RSVP funktioniert</h1>
    <p>Beim klassischen Lesen springt das Auge in Sakkaden ueber die Zeile und verliert dabei Zeit.</p>
    <p>RSVP zeigt jedes Wort an derselben Stelle, sodass die Sakkade entfaellt und der Blick ruht.</p>
    <p>Der Erkennungspunkt liegt dabei nicht in der Wortmitte, sondern leicht links davon.</p>
  </article>
  <footer><p>Alle Rechte vorbehalten.</p></footer>
</body>
</html>`;

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a &amp; b')).toBe('a & b');
    expect(decodeEntities('Stra&szlig;e')).toBe('Straße');
    expect(decodeEntities('&#8212;')).toBe('—');
    expect(decodeEntities('&#x2014;')).toBe('—');
  });

  it('leaves unknown entities untouched instead of mangling the text', () => {
    expect(decodeEntities('&nichtsdergleichen;')).toBe('&nichtsdergleichen;');
  });
});

describe('htmlToText', () => {
  it('drops script and style content entirely', () => {
    const text = htmlToText(ARTICLE_HTML);
    expect(text).not.toContain('window.tracking');
    expect(text).not.toContain('display: none');
  });

  it('turns block elements into paragraph breaks and inline ones into spaces', () => {
    const text = htmlToText('<p>Eins</p><p>Zwei <em>drei</em></p>');
    expect(text.split('\n\n')).toEqual(['Eins', 'Zwei drei']);
  });

  it('survives unclosed tags', () => {
    expect(htmlToText('<p>Text ohne Ende')).toBe('Text ohne Ende');
    expect(htmlToText('Text mit <b kaputt')).toContain('Text mit');
  });

  it('skips a whole chrome subtree even when the element nests inside itself', () => {
    // Wikipedia nests the language menu's <nav> inside the sidebar <nav>. Stopping at
    // the first closing tag let everything after it through as article text.
    const text = htmlToText(
      '<nav><div><nav><a>Menü</a></nav><a>Español</a><a>한국어</a></div></nav><p>Echter Text.</p>',
    );
    expect(text).toBe('Echter Text.');
  });

  it('treats <header> as chrome, not as content', () => {
    const text = htmlToText('<header><a>Sprache wählen</a></header><p>Der Artikel.</p>');
    expect(text).toBe('Der Artikel.');
  });

  it('does not leave a space in front of punctuation', () => {
    // `<a>Fähigkeit</a>,` used to arrive as "Fähigkeit ," because every inline tag
    // becomes a space — and the tokenizer then shows the comma as its own word.
    expect(htmlToText('<p>die <a href="#">Fähigkeit</a>, schnell zu lesen.</p>')).toBe(
      'die Fähigkeit, schnell zu lesen.',
    );
    expect(htmlToText('<p>Klammern <b>(</b>so<b>)</b> bleiben eng.</p>')).toBe(
      'Klammern (so) bleiben eng.',
    );
  });

  it('leaves quotation marks alone, because an apostrophe looks the same', () => {
    expect(htmlToText("<p>Annas <i>Buch</i> ’s Titel</p>")).toContain('’s');
  });
});

describe('extractArticle', () => {
  it('prefers the <article> element over page chrome', () => {
    const text = extractArticle(ARTICLE_HTML);
    expect(text).toContain('Sakkaden');
    expect(text).not.toContain('Impressum');
    expect(text).not.toContain('Alle Rechte vorbehalten');
  });

  it('falls back to the densest content container', () => {
    const html = `<body><div class="sidebar"><a href="#">Link</a></div>
      <div class="post-content"><p>${'Ein wirklich langer Absatz mit viel Inhalt. '.repeat(10)}</p></div></body>`;
    expect(extractArticle(html)).toContain('wirklich langer Absatz');
  });
});

describe('stripSiteSuffix', () => {
  it('removes the site name behind a separator', () => {
    expect(stripSiteSuffix('Warum RSVP funktioniert | Lesemagazin')).toBe(
      'Warum RSVP funktioniert',
    );
  });

  it('keeps short titles intact rather than truncating them', () => {
    expect(stripSiteSuffix('RSVP | Blog')).toBe('RSVP | Blog');
  });

  it('leaves titles without a separator alone', () => {
    expect(stripSiteSuffix('Ein einfacher Titel')).toBe('Ein einfacher Titel');
  });
});

describe('parseArticleHtml', () => {
  const doc = parseArticleHtml(ARTICLE_HTML, { url: 'https://example.com/rsvp' });

  it('extracts title, author, language and origin', () => {
    expect(doc.title).toBe('Warum RSVP funktioniert');
    expect(doc.author).toBe('Anna Berg');
    expect(doc.language).toBe('de');
    expect(doc.origin).toBe('https://example.com/rsvp');
    expect(doc.source).toBe('html');
  });

  it('keeps the body text and drops navigation and footer', () => {
    const text = doc.chapters.map((c) => c.text).join('\n');
    expect(text).toContain('Erkennungspunkt');
    expect(text).not.toContain('Impressum');
  });

  it('takes the og:image as the cover', () => {
    expect(doc.coverDataUrl).toBe('https://example.com/cover.jpg');
  });

  it('rejects a page with no article text', () => {
    expect(() => parseArticleHtml('<html><body></body></html>')).toThrow(/no article text/i);
  });
});

describe('fetchArticle', () => {
  it('sends a descriptive user agent and parses the response', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        url: 'https://example.com/rsvp',
        text: () => Promise.resolve(ARTICLE_HTML),
      }),
    );
    const doc = await fetchArticle('https://example.com/rsvp', fetchImpl);
    expect(doc.title).toBe('Warum RSVP funktioniert');
    const init = fetchImpl.mock.calls[0]?.[1] as { headers: Record<string, string> };
    expect(init.headers['user-agent']).toMatch(/LexiPulse/);
  });

  it('refuses non-http protocols', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchArticle('file:///etc/passwd', fetchImpl)).rejects.toThrow(/http/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces the HTTP status when the page cannot be fetched', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') }),
    );
    await expect(fetchArticle('https://example.com/missing', fetchImpl)).rejects.toThrow(/404/);
  });
});
