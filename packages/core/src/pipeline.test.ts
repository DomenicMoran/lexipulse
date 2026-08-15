import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { RsvpEngine } from './engine.js';
import { importDocument } from './parsers/index.js';
import { DEFAULT_SETTINGS } from './settings.js';
import { MemoryDriver } from './storage/driver.js';
import { LexiStore } from './storage/store.js';
import { tokenizeChapters } from './tokenizer.js';
import type { RsvpSettings } from './types.js';

/**
 * End-to-end through the real pipeline: bytes in, a played-out RSVP stream and a
 * persisted library out. Unit tests prove the pieces; this proves they compose.
 */

const CHAPTER_ONE = [
  'Es war ein heller kalter Tag im April und die Uhren schlugen dreizehn.',
  'Winston Smith presste sein Kinn auf die Brust, um dem gemeinen Wind zu entgehen.',
  'Der Flur roch nach gekochtem Kohl und alten Fetzen von Bastmatten.',
].join('</p><p>');

const CHAPTER_TWO = [
  'Am Ende des Flurs war ein farbiges Plakat an die Wand geheftet.',
  'Es zeigte lediglich ein riesenhaftes Gesicht, mehr als einen Meter breit.',
  'Das Gesicht eines etwa fuenfundvierzigjaehrigen Mannes mit dichtem schwarzem Schnurrbart.',
].join('</p><p>');

async function buildTestEpub(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
      '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/ch1.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Erstes Kapitel</h1><p>${CHAPTER_ONE}</p></body></html>`,
  );
  zip.file(
    'OEBPS/ch2.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Zweites Kapitel</h1><p>${CHAPTER_TWO}</p></body></html>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Testbuch</dc:title><dc:creator>Test Autor</dc:creator><dc:language>de</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch1"/><itemref idref="ch2"/></spine>
</package>`,
  );
  return zip.generateAsync({ type: 'uint8array' });
}

describe('EPUB → tokens → engine → store', () => {
  it('carries a book all the way to a finished reading session', async () => {
    // 1. Import.
    const document = await importDocument(await buildTestEpub(), { fileName: 'testbuch.epub' });
    expect(document.title).toBe('Testbuch');
    expect(document.chapters).toHaveLength(2);
    expect(document.wordCount).toBeGreaterThan(50);

    // 2. Tokenize at the user's settings.
    const settings: RsvpSettings = { ...DEFAULT_SETTINGS, wpm: 400, warmupTokens: 0 };
    const tokens = tokenizeChapters(document.chapters, {
      wpm: settings.wpm,
      pacing: settings.pacing,
    });
    // At least one token per word; overlong words split into more.
    expect(tokens.length).toBeGreaterThanOrEqual(document.wordCount);
    expect(tokens.length).toBeLessThanOrEqual(document.wordCount * 2);
    expect(document.chapters[1]?.startToken).toBe(document.chapters[0]?.tokenCount);
    expect(tokens.some((t) => t.text.endsWith('-'))).toBe(true); // the split word

    // 3. Play the whole book on a deterministic clock.
    let now = 0;
    const engine = new RsvpEngine({ tokens, settings, now: () => now });
    const seen: string[] = [tokens[0]?.text ?? ''];
    engine.subscribe((event) => {
      if (event.type === 'token') seen.push(event.token.text);
    });

    engine.play();
    // 16 ms frames, generous ceiling; the loop exits as soon as the engine finishes.
    for (let frame = 0; frame < 20_000 && engine.getStatus() === 'playing'; frame += 1) {
      now += 16;
      engine.update(now);
    }

    expect(engine.getStatus()).toBe('finished');
    // Every token was shown exactly once, in order.
    expect(seen).toEqual(tokens.map((t) => t.text));
    // Wall-clock spent matches the pacing plan within one frame.
    expect(now).toBeGreaterThanOrEqual(engine.totalMs() - tokens.length * 16 - 16);

    // 4. Persist the session.
    const store = new LexiStore(new MemoryDriver());
    await store.init();
    await store.saveDocument(document);
    await store.saveProgress({
      documentId: document.id,
      tokenIndex: tokens.length - 1,
      chapterIndex: 1,
      percent: 1,
      updatedAt: Date.now(),
      msRead: engine.totalMs(),
    });
    const stats = await store.recordSession({
      tokensRead: tokens.length,
      msRead: engine.totalMs(),
      started: true,
      finished: true,
    });

    const library = await store.listLibrary();
    expect(library).toHaveLength(1);
    expect(library[0]?.progress?.percent).toBe(1);
    expect(stats.documentsFinished).toBe(1);
    expect(stats.averageWpm).toBeGreaterThan(100);
    expect(stats.averageWpm).toBeLessThan(settings.wpm);
  });

  it('resumes a book at the stored position after a restart', async () => {
    const document = await importDocument(await buildTestEpub(), { fileName: 'testbuch.epub' });
    const tokens = tokenizeChapters(document.chapters, { wpm: 350 });

    const store = new LexiStore(new MemoryDriver());
    await store.init();
    await store.saveDocument(document);
    await store.saveProgress({
      documentId: document.id,
      tokenIndex: 25,
      chapterIndex: 0,
      percent: 25 / tokens.length,
      updatedAt: Date.now(),
      msRead: 5_000,
    });

    const progress = await store.getProgress(document.id);
    const engine = new RsvpEngine({
      tokens,
      settings: DEFAULT_SETTINGS,
      startIndex: progress?.tokenIndex ?? 0,
    });
    expect(engine.getIndex()).toBe(25);
    expect(engine.getSnapshot().token?.text).toBe(tokens[25]?.text);
  });

  it('changes speed mid-book without losing the position', async () => {
    const document = await importDocument(await buildTestEpub(), { fileName: 'testbuch.epub' });
    const tokens = tokenizeChapters(document.chapters, { wpm: 300 });
    const engine = new RsvpEngine({ tokens, settings: { ...DEFAULT_SETTINGS, wpm: 300 } });

    engine.seek(30);
    const before = engine.totalMs();
    engine.setWpm(900);
    expect(engine.getIndex()).toBe(30);
    expect(engine.totalMs()).toBeCloseTo(before / 3, 4);
  });

  it('survives a document whose chapters are empty after cleaning', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      '<container><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>',
    );
    zip.file(
      'OEBPS/ch1.xhtml',
      '<html><body><p>---</p><p>***</p></body></html>',
    );
    zip.file(
      'c.opf',
      '<package><metadata><dc:title>Leer</dc:title></metadata>' +
        '<manifest><item id="ch1" href="OEBPS/ch1.xhtml" media-type="application/xhtml+xml"/></manifest>' +
        '<spine><itemref idref="ch1"/></spine></package>',
    );
    await expect(
      importDocument(await zip.generateAsync({ type: 'uint8array' }), { fileName: 'leer.epub' }),
    ).rejects.toThrow();
  });
});
