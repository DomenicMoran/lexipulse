import { describe, expect, it } from 'vitest';
import { detectKind, importDocument } from './index.js';
import { asciiHead, parseFb2 } from './fb2.js';

const encode = (s: string) => new TextEncoder().encode(s);

const BOOK = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">',
  '  <description><title-info>',
  '    <author><first-name>Franz</first-name><last-name>Kafka</last-name></author>',
  '    <book-title>Die Verwandlung</book-title>',
  '    <lang>de</lang>',
  '  </title-info></description>',
  '  <body>',
  '    <section>',
  '      <title><p>Erstes Kapitel</p></title>',
  '      <p>Als Gregor Samsa eines Morgens erwachte, fand er sich <emphasis>verwandelt</emphasis>.</p>',
  '      <empty-line/>',
  '      <p>Seine Beine flimmerten ihm hilflos vor den Augen.</p>',
  '    </section>',
  '    <section>',
  '      <title><p>Zweites Kapitel</p></title>',
  '      <p>Erst in der D&#228;mmerung erwachte Gregor.</p>',
  '    </section>',
  '  </body>',
  '</FictionBook>',
].join('\n');

describe('parseFb2', () => {
  it('reads title, author and language out of the description', () => {
    const doc = parseFb2(encode(BOOK));
    expect(doc.title).toBe('Die Verwandlung');
    expect(doc.author).toBe('Franz Kafka');
    expect(doc.language).toBe('de');
    expect(doc.source).toBe('fb2');
  });

  it('makes one chapter per top-level section, with its heading', () => {
    const doc = parseFb2(encode(BOOK));
    expect(doc.chapters.map((c) => c.title)).toEqual(['Erstes Kapitel', 'Zweites Kapitel']);
    expect(doc.chapters[0]?.text).toContain('Gregor Samsa');
  });

  it('keeps what inline markup wrapped and drops the markup', () => {
    const doc = parseFb2(encode(BOOK));
    const text = doc.chapters[0]?.text ?? '';
    expect(text).toContain('verwandelt');
    expect(text).not.toContain('emphasis');
    expect(text).not.toContain('<');
  });

  it('resolves entities instead of leaving them in the stream', () => {
    const doc = parseFb2(encode(BOOK));
    expect(doc.chapters[1]?.text).toContain('Dämmerung');
    expect(doc.chapters[1]?.text).not.toContain('&#228;');
  });

  it('does not lose the heading of a section into the reading text', () => {
    const doc = parseFb2(encode(BOOK));
    expect(doc.chapters[0]?.text.startsWith('Erstes Kapitel')).toBe(false);
  });

  it('closes a nested section at its own end, not at the first inner one', () => {
    // A lazy `[\s\S]*?</section>` cuts a nested book after its first paragraph, which is
    // why the parser counts depth. Two parts, each holding two sub-sections.
    const nested = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<FictionBook><description><title-info><book-title>Teile</book-title></title-info></description>',
      '<body>',
      '  <section><title><p>Teil eins</p></title>',
      '    <section><p>Erster Unterabschnitt mit Text.</p></section>',
      '    <section><p>Zweiter Unterabschnitt mit Text.</p></section>',
      '  </section>',
      '  <section><title><p>Teil zwei</p></title>',
      '    <section><p>Dritter Unterabschnitt mit Text.</p></section>',
      '  </section>',
      '</body></FictionBook>',
    ].join('\n');
    const doc = parseFb2(encode(nested));
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[0]?.title).toBe('Teil eins');
    expect(doc.chapters[0]?.text).toContain('Erster Unterabschnitt');
    expect(doc.chapters[0]?.text).toContain('Zweiter Unterabschnitt');
    expect(doc.chapters[1]?.text).toContain('Dritter Unterabschnitt');
  });

  it('leaves footnote bodies out of the reading text', () => {
    const withNotes = BOOK.replace(
      '</body>',
      '</body><body name="notes"><section><p>Eine Fussnote, die nicht vorgelesen wird.</p></section></body>',
    );
    const doc = parseFb2(encode(withNotes));
    const all = doc.chapters.map((c) => c.text).join(' ');
    expect(all).not.toContain('Fussnote');
  });

  it('takes the whole body when the file has no sections', () => {
    const flat = [
      '<FictionBook><description><title-info><book-title>Flach</book-title></title-info></description>',
      '<body><p>Ein Absatz ohne jede Gliederung im Dokument.</p></body></FictionBook>',
    ].join('\n');
    const doc = parseFb2(encode(flat));
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0]?.text).toContain('ohne jede Gliederung');
  });

  it('builds the cover data URL from the binary the coverpage names', () => {
    const withCover = BOOK.replace(
      '</description>',
      '</description>',
    ).replace(
      '<body>',
      '<description2/><body>',
    );
    const xml = withCover
      .replace('</title-info>', '<coverpage><image l:href="#cover.jpg"/></coverpage></title-info>')
      .replace('</FictionBook>', '<binary id="cover.jpg" content-type="image/png">QUJD</binary></FictionBook>');
    const doc = parseFb2(encode(xml));
    expect(doc.coverDataUrl).toBe('data:image/png;base64,QUJD');
  });

  it('keeps verse lines apart instead of running a poem into one sentence', () => {
    const poem = [
      '<FictionBook><description><title-info><book-title>Verse</book-title></title-info></description>',
      '<body><section><title><p>Ein Gedicht</p></title>',
      '<subtitle>Erster Teil</subtitle>',
      '<poem><stanza><v>Erste Zeile des Verses</v><v>Zweite Zeile des Verses</v></stanza></poem>',
      '<p>Ein Absatz danach.</p>',
      '</section></body></FictionBook>',
    ].join('');
    const text = parseFb2(encode(poem)).chapters[0]?.text ?? '';
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    expect(lines).toContain('Erste Zeile des Verses');
    expect(lines).toContain('Zweite Zeile des Verses');
    expect(text).not.toContain('VersesZweite');
    expect(text).toContain('Erster Teil');
  });

  it('refuses a file that is not FictionBook', () => {
    expect(() => parseFb2(encode('<html><body>nein</body></html>'))).toThrow(/not a FictionBook/i);
  });
});

describe('asciiHead', () => {
  it('reads the head without TextDecoder, which Hermes rejects for the ascii label', () => {
    // The device threw "Unknown encoding: ascii" while every test here stayed green,
    // because Node accepts the label and Hermes does not.
    expect(asciiHead(encode('<?xml version="1.0"?>'), 8)).toBe('<?xml ve');
  });

  it('stops at the end of a short buffer instead of reading past it', () => {
    expect(asciiHead(encode('ab'), 10)).toBe('ab');
  });

  it('replaces bytes above 127 rather than mangling them', () => {
    expect(asciiHead(new Uint8Array([0x41, 0xc3, 0xa4]), 3)).toBe('A' + String.fromCharCode(0xfffd) + String.fromCharCode(0xfffd));
  });
});

describe('FB2 detection', () => {
  it('recognises the extension', () => {
    expect(detectKind('buch.fb2')).toBe('fb2');
  });

  it('recognises the root element even without the extension', () => {
    expect(detectKind('buch.xml', encode(BOOK))).toBe('fb2');
  });

  it('routes an fb2 file through the FictionBook parser', async () => {
    const doc = await importDocument(encode(BOOK), { fileName: 'verwandlung.fb2' });
    expect(doc.source).toBe('fb2');
    expect(doc.title).toBe('Die Verwandlung');
  });
});
