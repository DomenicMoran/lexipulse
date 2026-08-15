import { describe, expect, it, vi } from 'vitest';
import { extractPdfPages, itemsToLines, parsePdf, type PdfDocumentProxy, type PdfTextItem } from './pdf.js';

/** Build a pdf.js-shaped text item at a page position. */
function item(str: string, x: number, y: number, charWidth = 5): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width: str.length * charWidth };
}

/** Fake pdf.js document from an array of pages, each an array of positioned items. */
function fakeDoc(pages: PdfTextItem[][], info?: Record<string, unknown>): PdfDocumentProxy {
  return {
    numPages: pages.length,
    getPage: (n: number) =>
      Promise.resolve({
        getTextContent: () => Promise.resolve({ items: pages[n - 1] ?? [] }),
      }),
    getMetadata: () => Promise.resolve({ info: info ?? {} }),
    destroy: () => Promise.resolve(),
  };
}

describe('itemsToLines', () => {
  it('groups runs on the same baseline into one line, top to bottom', () => {
    const lines = itemsToLines([
      item('zweite', 50, 700),
      item('Die', 50, 720),
      item('Zeile', 75, 720),
    ]);
    expect(lines).toEqual(['Die Zeile', 'zweite']);
  });

  it('tolerates sub-pixel baseline jitter', () => {
    const lines = itemsToLines([item('Wort', 50, 700), item('daneben', 80, 701.4)]);
    expect(lines).toHaveLength(1);
  });

  it('inserts a double space for a column gutter so tables stay detectable', () => {
    const lines = itemsToLines([
      item('Region', 50, 700),
      item('Umsatz', 200, 700),
      item('Marge', 350, 700),
    ]);
    expect(lines[0]).toMatch(/Region {2,}Umsatz {2,}Marge/);
  });

  it('does not invent spaces inside a continuous word run', () => {
    const lines = itemsToLines([item('Ent', 50, 700), item('wicklung', 65, 700)]);
    expect(lines[0]).toBe('Entwicklung');
  });

  it('returns nothing for an empty page', () => {
    expect(itemsToLines([])).toEqual([]);
    expect(itemsToLines([item('', 0, 0)])).toEqual([]);
  });
});

describe('extractPdfPages', () => {
  it('reads every page and reports progress', async () => {
    const doc = fakeDoc([[item('Seite eins', 50, 700)], [item('Seite zwei', 50, 700)]]);
    const onProgress = vi.fn();
    const pages = await extractPdfPages(doc, onProgress);
    expect(pages).toEqual([['Seite eins'], ['Seite zwei']]);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });
});

describe('parsePdf', () => {
  /** Six pages with a running head, a footer page number and a table block. */
  const BODY = [
    'Zunaechst wird die Ausgangslage der Untersuchung ausfuehrlich beschrieben und',
    'Anschliessend folgt die Methodik der Erhebung mit allen ihren Einzelschritten,',
    'Der Bruch im mittleren Zeitraum bleibt bis heute auffaellig und unerklaert,',
    'Die regionale Betrachtung wurde fuer diese Auflage vollstaendig neu zugeschnitten,',
    'Im laendlichen Raum ist die Datenlage duenn und die Ausfallquote sehr hoch,',
    'Drei Handlungsoptionen stehen am Ende dieses Kapitels zur konkreten Auswahl,',
  ];

  const TAIL = [
    'was den Rahmen der weiteren Betrachtung eindeutig absteckt.',
    'sodass beide Schritte reproduzierbar dokumentiert vorliegen.',
    'weshalb eine dritte Ursache hier deutlich naheliegender ist.',
    'weil die alten Grenzen die Verflechtungen verzerrt hatten.',
    'wodurch die Ergebnisse dort entsprechend unsicher bleiben.',
    'die sich in Aufwand und erwarteter Wirkung stark unterscheiden.',
  ];

  // Head at the top, page number at the bottom, table block safely in the middle so the
  // repetition detector and the table detector are exercised independently.
  const pages = BODY.map((line, i) => [
    item('Handbuch der Statistik', 50, 760),
    item(line, 50, 700),
    item(TAIL[i] as string, 50, 680),
    item('Region', 50, 600),
    item('Umsatz', 200, 600),
    item('2024', 350, 600),
    item('Nord', 50, 580),
    item('12.400', 200, 580),
    item('9.100', 350, 580),
    item(`Der Abschnitt ${'abcdef'[i]} schliesst mit einer eigenen Bewertung ab.`, 50, 520),
    item(`Ein letzter Gedanke zu Teil ${'abcdef'[i]} rundet die Seite ab.`, 50, 500),
    item(`${i + 1}`, 300, 40),
  ]);

  it('removes running heads, page numbers and table rows but keeps the prose', async () => {
    const doc = await parsePdf(new Uint8Array([1]), {
      loader: () => Promise.resolve(fakeDoc(pages)),
    });
    expect(doc.chapters.map((c) => c.text).join('\n')).not.toContain('Handbuch der Statistik');
    expect(doc.chapters.map((c) => c.text).join('\n')).not.toContain('Umsatz');
    expect(doc.chapters.map((c) => c.text).join('\n')).toContain('Ausgangslage');
    expect(doc.chapters.map((c) => c.text).join('\n')).not.toContain('12.400');
    expect(doc.importReport.removed.headers).toBe(6);
    expect(doc.importReport.removed.pageNumbers).toBe(6);
    expect(doc.importReport.removed.tableRows).toBe(12);
  });

  it('takes title and author from the PDF metadata', async () => {
    const doc = await parsePdf(new Uint8Array([1]), {
      loader: () =>
        Promise.resolve(fakeDoc(pages, { Title: 'Handbuch der Statistik', Author: 'M. Kern' })),
    });
    expect(doc.title).toBe('Handbuch der Statistik');
    expect(doc.author).toBe('M. Kern');
  });

  it('falls back to the supplied title when metadata is empty', async () => {
    const doc = await parsePdf(new Uint8Array([1]), {
      loader: () => Promise.resolve(fakeDoc(pages)),
      fallbackTitle: 'Mein Dokument',
    });
    expect(doc.title).toBe('Mein Dokument');
    expect(doc.author).toBeNull();
  });

  it('can be told to keep tables', async () => {
    const doc = await parsePdf(new Uint8Array([1]), {
      loader: () => Promise.resolve(fakeDoc(pages)),
      stripTables: false,
    });
    expect(doc.importReport.removed.tableRows).toBe(0);
    expect(doc.chapters.map((c) => c.text).join('\n')).toContain('Umsatz');
  });

  it('gives a scan-specific error instead of an empty document', async () => {
    await expect(
      parsePdf(new Uint8Array([1]), { loader: () => Promise.resolve(fakeDoc([[], []])) }),
    ).rejects.toThrow(/OCR/i);
  });

  it('releases the pdf.js document even when parsing fails', async () => {
    const destroy = vi.fn(() => Promise.resolve());
    const doc: PdfDocumentProxy = { ...fakeDoc([[]]), destroy };
    await expect(
      parsePdf(new Uint8Array([1]), { loader: () => Promise.resolve(doc) }),
    ).rejects.toThrow();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('reports what it removed in human-readable notes', async () => {
    const doc = await parsePdf(new Uint8Array([1]), {
      loader: () => Promise.resolve(fakeDoc(pages)),
    });
    expect(doc.importReport.notes.join(' ')).toMatch(/6 pages processed/);
    expect(doc.importReport.notes.join(' ')).toMatch(/table rows removed/);
  });
});
