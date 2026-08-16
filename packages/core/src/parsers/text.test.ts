import { describe, expect, it } from 'vitest';
import { detectKind, importDocument, stripExtension } from './index.js';
import { chunkIntoChapters, countWords } from './shared.js';
import { inferTitle, markdownToText, parseText } from './text.js';

const encode = (s: string) => new TextEncoder().encode(s);

describe('markdownToText', () => {
  it('removes headings, emphasis, links and code fences', () => {
    const md = [
      '# Titel',
      '',
      'Ein **fetter** und *kursiver* Satz mit [Link](https://example.com).',
      '',
      '```js',
      'const x = 1;',
      '```',
      '',
      '- Punkt eins',
      '- Punkt zwei',
    ].join('\n');
    const text = markdownToText(md);
    expect(text).toContain('Titel');
    expect(text).toContain('Ein fetter und kursiver Satz mit Link.');
    expect(text).not.toContain('const x');
    expect(text).not.toContain('**');
    expect(text).not.toContain('](');
  });

  it('drops images but keeps the surrounding prose', () => {
    expect(markdownToText('Vorher ![alt](bild.png) nachher').trim()).toBe('Vorher  nachher');
  });

  it('removes table rows', () => {
    expect(markdownToText('| a | b |\n| - | - |\nText')).toContain('Text');
    expect(markdownToText('| a | b |\nText')).not.toContain('| a |');
  });
});

describe('inferTitle', () => {
  it('uses the first Markdown heading', () => {
    expect(inferTitle('# Der Titel\n\nText')).toBe('Der Titel');
  });

  it('uses a short first line that is not a sentence', () => {
    expect(inferTitle('Kurzer Kopf\n\nDann der Text.')).toBe('Kurzer Kopf');
  });

  it('falls back when the first line is a full sentence', () => {
    expect(inferTitle('Das ist bereits ein ganzer Satz.', 'Fallback')).toBe('Fallback');
  });
});

describe('countWords / chunkIntoChapters', () => {
  it('counts whitespace-delimited words', () => {
    expect(countWords('eins zwei  drei')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });

  it('splits long text into chapters near the target size', () => {
    const paragraph = `${'Wort '.repeat(100).trim()}\n\n`;
    const chapters = chunkIntoChapters(paragraph.repeat(10), 300);
    expect(chapters.length).toBeGreaterThan(2);
    for (const chapter of chapters) expect(chapter.text.length).toBeGreaterThan(0);
  });

  it('uses a short leading line as the chapter title', () => {
    const chapters = chunkIntoChapters('Kapitelkopf\n\nDer Text folgt hier.', 10);
    expect(chapters[0]?.title).toBe('Kapitelkopf');
  });

  it('returns nothing for empty input', () => {
    expect(chunkIntoChapters('')).toEqual([]);
  });
});

describe('parseText', () => {
  it('parses plain text into a document', () => {
    const doc = parseText('Erster Absatz hier.\n\nZweiter Absatz dort.', { title: 'Notiz' });
    expect(doc.title).toBe('Notiz');
    expect(doc.source).toBe('text');
    expect(doc.wordCount).toBe(6);
    expect(doc.chapters[0]?.text).toContain('Zweiter Absatz');
  });

  it('parses Markdown with the syntax stripped', () => {
    const doc = parseText('# Kopf\n\nEin **Satz**.', { source: 'markdown' });
    expect(doc.title).toBe('Kopf');
    expect(doc.chapters[0]?.text).not.toContain('**');
  });

  it('refuses empty input with a clear message', () => {
    expect(() => parseText('   \n\n  ')).toThrow(/no readable text/i);
  });
});

describe('detectKind', () => {
  it('sniffs magic bytes before trusting the extension', () => {
    const pdfBytes = encode('%PDF-1.7 rest');
    expect(detectKind('report.txt', pdfBytes)).toBe('pdf');
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(detectKind('book.txt', zipBytes)).toBe('epub');
  });

  it('falls back to the extension', () => {
    expect(detectKind('book.epub')).toBe('epub');
    expect(detectKind('paper.pdf')).toBe('pdf');
    expect(detectKind('notes.md')).toBe('markdown');
    expect(detectKind('page.html')).toBe('html');
    expect(detectKind('plain.txt')).toBe('text');
    expect(detectKind('unknown')).toBe('text');
  });
});

describe('stripExtension', () => {
  it('turns a file name into a readable title', () => {
    expect(stripExtension('C:/Bücher/mein-buch_final.epub')).toBe('mein buch final');
    expect(stripExtension('report.pdf')).toBe('report');
    expect(stripExtension('.gitignore')).toBe('.gitignore');
  });
});

describe('importDocument', () => {
  it('routes plain text through the text parser', async () => {
    const doc = await importDocument(encode('Ein Satz zum Testen.'), { fileName: 'notiz.txt' });
    expect(doc.source).toBe('text');
    expect(doc.title).toBe('notiz');
  });

  it('routes Markdown through the Markdown parser', async () => {
    const doc = await importDocument(encode('# Kopf\n\nText.'), { fileName: 'doku.md' });
    expect(doc.source).toBe('markdown');
  });

  it('routes HTML through the article extractor', async () => {
    const html = `<html><head><title>Seite</title></head><body><article><p>${'Ein Absatz mit Inhalt. '.repeat(20)}</p></article></body></html>`;
    const doc = await importDocument(encode(html), { fileName: 'seite.html' });
    expect(doc.source).toBe('html');
    expect(doc.title).toBe('Seite');
  });

  it('strips a UTF-8 BOM instead of leaking it into the first word', async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('Erstes Wort hier.')]);
    const doc = await importDocument(withBom, { fileName: 'bom.txt' });
    expect(doc.chapters[0]?.text.startsWith('Erstes')).toBe(true);
  });

  it('decodes UTF-16 little-endian text files', async () => {
    const text = 'Grüße aus Berlin.';
    const buffer = new Uint8Array(2 + text.length * 2);
    buffer[0] = 0xff;
    buffer[1] = 0xfe;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      buffer[2 + i * 2] = code & 0xff;
      buffer[3 + i * 2] = code >> 8;
    }
    const doc = await importDocument(buffer, { fileName: 'utf16.txt' });
    expect(doc.chapters[0]?.text).toContain('Grüße');
  });
});

describe('Markdown structure', () => {
  const BOOK = [
    '# Die Verwandlung',
    '',
    '## Kapitel 1',
    '',
    'Als Gregor Samsa eines Morgens erwachte, fand er sich verwandelt.',
    '',
    '## Kapitel 2',
    '',
    'Erst in der Dämmerung erwachte Gregor aus seinem Schlaf.',
    '',
    '## Kapitel 3',
    '',
    'Die schwere Verwundung Gregors dauerte über einen Monat.',
  ].join('\n');

  it('cuts a Markdown document at its headings', () => {
    const doc = parseText(BOOK, { source: 'markdown' });
    expect(doc.title).toBe('Die Verwandlung');
    expect(doc.chapters.map((c) => c.title)).toEqual(['Kapitel 1', 'Kapitel 2', 'Kapitel 3']);
    expect(doc.chapters[1]?.text).toContain('Dämmerung');
  });

  it('ignores a level that occurs once, so the title is not the only chapter', () => {
    const single = '# Nur ein Titel\n\nEin Absatz ohne weitere Überschriften, nur Fließtext.';
    const doc = parseText(single, { source: 'markdown' });
    expect(doc.chapters).toHaveLength(1);
  });

  it('counts sections in the singular when there is one', () => {
    const doc = parseText('Ein einzelner Absatz.', { title: 'X' });
    expect(doc.importReport.notes).toContain('1 section');
  });
});
