import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseEpub, resolveHref } from './epub.js';

/** Build a real, spec-shaped EPUB in memory — no binary fixture to keep in the repo. */
async function buildEpub(
  options: {
    version?: 2 | 3;
    withCover?: boolean;
    extraChapter?: { id: string; body: string };
    tinyFrontMatter?: boolean;
  } = {},
): Promise<Uint8Array> {
  const { version = 3, withCover = true, extraChapter, tinyFrontMatter = false } = options;
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const chapterFile = (title: string, paragraphs: string[]) =>
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head>
<body><h1>${title}</h1>${paragraphs.map((p) => `<p>${p}</p>`).join('')}</body></html>`;

  zip.file(
    'OEBPS/ch1.xhtml',
    chapterFile('Der erste Anfang', [
      'Es war ein heller kalter Tag im April und die Uhren schlugen dreizehn.',
      'Winston Smith presste sein Kinn auf die Brust, um dem gemeinen Wind zu entgehen.',
    ]),
  );
  zip.file(
    'OEBPS/ch2.xhtml',
    chapterFile('Das zweite Kapitel', [
      'Der Flur roch nach gekochtem Kohl und alten Fetzen von Bastmatten.',
      'An einem Ende war ein farbiges Plakat an die Wand geheftet, zu gross fuer den Innenraum.',
    ]),
  );

  if (tinyFrontMatter) {
    // No heading and no ToC entry — exactly the fragment that should be merged away.
    zip.file(
      'OEBPS/front.xhtml',
      '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>Alle Rechte vorbehalten.</p></body></html>',
    );
  }
  if (extraChapter) {
    zip.file(`OEBPS/${extraChapter.id}.xhtml`, extraChapter.body);
  }
  if (withCover) {
    // 1×1 transparent PNG.
    zip.file(
      'OEBPS/cover.png',
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      { base64: true },
    );
  }

  const manifest = [
    '<item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>',
    tinyFrontMatter
      ? '<item id="front" href="front.xhtml" media-type="application/xhtml+xml"/>'
      : '',
    extraChapter
      ? `<item id="${extraChapter.id}" href="${extraChapter.id}.xhtml" media-type="application/xhtml+xml"/>`
      : '',
    withCover
      ? `<item id="cover" href="cover.png" media-type="image/png" ${
          version === 3 ? 'properties="cover-image"' : ''
        }/>`
      : '',
    version === 2 ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' : '',
    version === 3 ? '<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>' : '',
  ]
    .filter((s) => s.length > 0)
    .join('\n    ');

  const spine = [
    tinyFrontMatter ? '<itemref idref="front"/>' : '',
    '<itemref idref="ch1"/>',
    '<itemref idref="ch2"/>',
    extraChapter ? `<itemref idref="${extraChapter.id}"/>` : '',
  ]
    .filter((s) => s.length > 0)
    .join('\n    ');

  if (version === 2) {
    zip.file(
      'OEBPS/toc.ncx',
      `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>
  <navPoint id="n1" playOrder="1"><navLabel><text>Der erste Anfang</text></navLabel><content src="ch1.xhtml"/></navPoint>
  <navPoint id="n2" playOrder="2"><navLabel><text>Das zweite Kapitel</text></navLabel><content src="ch2.xhtml"/></navPoint>
</navMap></ncx>`,
    );
  } else {
    zip.file(
      'OEBPS/nav.xhtml',
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
<nav epub:type="toc"><ol>
  <li><a href="ch1.xhtml">Der erste Anfang</a></li>
  <li><a href="ch2.xhtml">Das zweite Kapitel</a></li>
</ol></nav></body></html>`,
    );
  }

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Neunzehnhundertvierundachtzig</dc:title>
    <dc:creator>George Orwell</dc:creator>
    <dc:language>de</dc:language>
    ${withCover && version === 2 ? '<meta name="cover" content="cover"/>' : ''}
  </metadata>
  <manifest>
    ${manifest}
  </manifest>
  <spine ${version === 2 ? 'toc="ncx"' : ''}>
    ${spine}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: 'uint8array' });
}

describe('resolveHref', () => {
  it('resolves relative hrefs against the OPF directory', () => {
    expect(resolveHref('OEBPS', 'ch1.xhtml')).toBe('OEBPS/ch1.xhtml');
    expect(resolveHref('OEBPS/text', '../images/c.png')).toBe('OEBPS/images/c.png');
    expect(resolveHref('', 'ch1.xhtml')).toBe('ch1.xhtml');
  });

  it('drops fragments and decodes percent-encoding', () => {
    expect(resolveHref('OEBPS', 'ch1.xhtml#section-2')).toBe('OEBPS/ch1.xhtml');
    expect(resolveHref('OEBPS', 'Kapitel%201.xhtml')).toBe('OEBPS/Kapitel 1.xhtml');
  });
});

describe('parseEpub (EPUB 3)', () => {
  it('reads metadata, chapters and text', async () => {
    const doc = await parseEpub(await buildEpub({ version: 3 }));
    expect(doc.title).toBe('Neunzehnhundertvierundachtzig');
    expect(doc.author).toBe('George Orwell');
    expect(doc.language).toBe('de');
    expect(doc.source).toBe('epub');
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[0]?.text).toContain('heller kalter Tag im April');
    expect(doc.wordCount).toBeGreaterThan(30);
  });

  it('takes chapter titles from the nav document', async () => {
    const doc = await parseEpub(await buildEpub({ version: 3 }));
    expect(doc.chapters.map((c) => c.title)).toEqual([
      'Der erste Anfang',
      'Das zweite Kapitel',
    ]);
  });

  it('extracts the cover as a data URL', async () => {
    const doc = await parseEpub(await buildEpub({ version: 3, withCover: true }));
    expect(doc.coverDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('returns no cover when the EPUB has none', async () => {
    const doc = await parseEpub(await buildEpub({ version: 3, withCover: false }));
    expect(doc.coverDataUrl).toBeNull();
  });

  it('strips markup and keeps paragraph structure', async () => {
    const doc = await parseEpub(await buildEpub({ version: 3 }));
    const text = doc.chapters[0]?.text ?? '';
    expect(text).not.toContain('<p>');
    expect(text.split('\n\n').length).toBeGreaterThanOrEqual(2);
  });

  it('writes a useful import report', async () => {
    const doc = await parseEpub(await buildEpub({ version: 3 }));
    expect(doc.importReport.source).toBe('epub');
    expect(doc.importReport.rawSections).toBe(2);
    expect(doc.importReport.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('parseEpub (EPUB 2)', () => {
  it('reads the NCX table of contents and the legacy cover meta', async () => {
    const doc = await parseEpub(await buildEpub({ version: 2 }));
    expect(doc.chapters.map((c) => c.title)).toEqual([
      'Der erste Anfang',
      'Das zweite Kapitel',
    ]);
    expect(doc.coverDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

describe('parseEpub edge cases', () => {
  it('keeps a short but titled section as its own chapter', async () => {
    const doc = await parseEpub(await buildEpub({ version: 3 }));
    // Both fixture chapters are shorter than minChapterChars but carry a ToC title.
    expect(doc.chapters).toHaveLength(2);
  });

  it('merges an untitled fragment into the neighbouring chapter', async () => {
    const doc = await parseEpub(await buildEpub({ tinyFrontMatter: true }));
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[0]?.text).toContain('Alle Rechte vorbehalten');
    expect(doc.chapters.some((c) => c.text.includes('heller kalter Tag'))).toBe(true);
  });

  it('rejects a file that is not an EPUB', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'nope');
    await expect(parseEpub(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(
      /container\.xml/i,
    );
  });

  it('rejects an EPUB with no readable text', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      '<container><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>',
    );
    zip.file(
      'c.opf',
      '<package><metadata><dc:title>Leer</dc:title></metadata><manifest></manifest><spine></spine></package>',
    );
    await expect(parseEpub(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(
      /no readable text/i,
    );
  });
});
