import { PDFDocument, PDFName, StandardFonts } from '@cantoo/pdf-lib';
import { createMark } from '@lexipulse/core';
import { describe, expect, it } from 'vitest';
import {
  buildPdf,
  extractPages,
  imagesToPdf,
  mergePdfs,
  parseColor,
  readFormFields,
  remapPage,
  setProperties,
  toWinAnsi,
  wrapText,
} from './pdf-export';

/** A small document with text, a form field and a known page count. */
async function samplePdf(pages = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Vorlage');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Seite ${i + 1} mit Umlauten: Grüße, Straße`, {
      x: 40,
      y: 520,
      size: 12,
      font,
    });
  }
  const form = doc.getForm();
  const name = form.createTextField('antrag.name');
  name.setText('');
  name.addToPage(doc.getPage(0), { x: 40, y: 400, width: 200, height: 20 });
  const agree = form.createCheckBox('antrag.ok');
  agree.addToPage(doc.getPage(0), { x: 40, y: 360, width: 14, height: 14 });
  return doc.save();
}

/** A 1×1 transparent PNG. */
const PNG_1PX = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

describe('parseColor', () => {
  it('reads a six-digit hex with or without the hash', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 1, g: 0, b: 0 });
    expect(parseColor('00ff00')).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('falls back to black rather than producing NaN', () => {
    expect(parseColor('nonsense')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor('#fff')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('toWinAnsi', () => {
  it('keeps everything a German document needs', () => {
    expect(toWinAnsi('Grüße aus Köln — 15 €')).toBe('Grüße aus Köln — 15 €');
  });

  it('replaces what the standard fonts cannot encode instead of throwing', () => {
    expect(toWinAnsi('Привет')).toBe('??????');
    expect(toWinAnsi('日本')).toBe('??');
  });

  it('keeps line breaks', () => {
    expect(toWinAnsi('eins\nzwei')).toBe('eins\nzwei');
  });
});

describe('wrapText', () => {
  // Every character one unit wide, so the arithmetic is checkable by counting.
  const measure = (line: string) => line.length;

  it('breaks at word boundaries', () => {
    expect(wrapText('aaa bbb ccc ddd', measure, 7)).toEqual(['aaa bbb', 'ccc ddd']);
  });

  it('keeps an over-long word on its own line rather than losing it', () => {
    expect(wrapText('kurz Donaudampfschifffahrt', measure, 8)).toEqual([
      'kurz',
      'Donaudampfschifffahrt',
    ]);
  });

  it('preserves explicit line breaks', () => {
    expect(wrapText('eins\n\nzwei', measure, 20)).toEqual(['eins', '', 'zwei']);
  });
});

describe('buildPdf', () => {
  it('returns a document that still opens, with the same pages', async () => {
    const original = await samplePdf(3);
    const out = await buildPdf(original, {
      marks: [
        createMark({ documentId: 'd', page: 1, kind: 'highlight', rect: [40, 515, 300, 535] }),
        createMark({ documentId: 'd', page: 2, kind: 'underline', rect: [40, 510, 300, 510] }),
        createMark({ documentId: 'd', page: 2, kind: 'strike', rect: [40, 500, 300, 520] }),
        createMark({ documentId: 'd', page: 3, kind: 'rect', rect: [40, 400, 300, 500] }),
        createMark({ documentId: 'd', page: 3, kind: 'ellipse', rect: [40, 200, 300, 300] }),
      ],
    });

    const reopened = await PDFDocument.load(out);
    expect(reopened.getPageCount()).toBe(3);
    expect(out.length).toBeGreaterThan(original.length - 1000);
  });

  it('draws a stroke, a dot and an arrow without complaint', async () => {
    const out = await buildPdf(await samplePdf(1), {
      marks: [
        createMark({
          documentId: 'd',
          page: 1,
          kind: 'ink',
          rect: [0, 0, 0, 0],
          paths: [[40, 40, 80, 90, 120, 60], [200, 200]],
        }),
        createMark({
          documentId: 'd',
          page: 1,
          kind: 'arrow',
          rect: [40, 40, 200, 300],
          paths: [[40, 300, 200, 40]],
        }),
      ],
    });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('writes text and survives characters the standard fonts cannot encode', async () => {
    const out = await buildPdf(await samplePdf(1), {
      marks: [
        createMark({
          documentId: 'd',
          page: 1,
          kind: 'text',
          rect: [40, 300, 340, 400],
          text: 'Grüße aus Köln.\nZweite Zeile mit 日本 darin.',
          fontSize: 11,
        }),
      ],
    });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('leaves a note as a real annotation, so other viewers show it', async () => {
    const out = await buildPdf(await samplePdf(1), {
      marks: [
        createMark({
          documentId: 'd',
          page: 1,
          kind: 'note',
          rect: [100, 100, 114, 114],
          text: 'Hier nachfragen',
        }),
      ],
    });
    const reopened = await PDFDocument.load(out);
    const annotations = reopened.getPage(0).node.Annots();
    // The sample carries two form widgets; the note has to be a third one beside them.
    const notes: string[] = [];
    for (let i = 0; i < (annotations?.size() ?? 0); i += 1) {
      const dict = reopened.context.lookup(annotations?.get(i)) as unknown as {
        get: (key: unknown) => { decodeText?: () => string; asString?: () => string } | undefined;
      };
      if (dict.get(PDFName.of('Subtype'))?.asString?.() !== '/Text') continue;
      notes.push(dict.get(PDFName.of('Contents'))?.decodeText?.() ?? '');
    }
    expect(notes).toEqual(['Hier nachfragen']);
  });

  it('stamps a picture', async () => {
    const out = await buildPdf(await samplePdf(1), {
      marks: [
        createMark({
          documentId: 'd',
          page: 1,
          kind: 'signature',
          rect: [40, 60, 240, 120],
          imageId: 'sig-1',
        }),
      ],
      loadImage: async (id) =>
        id === 'sig-1' ? { bytes: PNG_1PX, mime: 'image/png' } : null,
    });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('fills a form and can make it uneditable', async () => {
    const original = await samplePdf(1);

    const filled = await buildPdf(original, {
      marks: [],
      formValues: { 'antrag.name': 'Domenic Moran', 'antrag.ok': true },
    });
    const fields = await readFormFields(filled);
    expect(fields.find((f) => f.name === 'antrag.name')?.value).toBe('Domenic Moran');
    expect(fields.find((f) => f.name === 'antrag.ok')?.value).toBe(true);

    const flattened = await buildPdf(original, {
      marks: [],
      formValues: { 'antrag.name': 'Domenic Moran' },
      flattenForm: true,
    });
    expect(await readFormFields(flattened)).toEqual([]);
  });

  it('ignores a field the document does not have instead of failing the export', async () => {
    const out = await buildPdf(await samplePdf(1), {
      marks: [],
      formValues: { 'gibt.es.nicht': 'x' },
    });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('replaces the page content when a redaction is meant to remove text', async () => {
    const original = await samplePdf(1);
    const out = await buildPdf(original, {
      marks: [createMark({ documentId: 'd', page: 1, kind: 'redact', rect: [40, 510, 300, 535] })],
      hardRedaction: true,
      renderPage: async () => PNG_1PX,
    });

    // The words that were on the page are no longer anywhere in the file.
    expect(new TextDecoder('latin1').decode(out)).not.toContain('Umlauten');
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('only covers the text when hard redaction is off', async () => {
    const out = await buildPdf(await samplePdf(1), {
      marks: [createMark({ documentId: 'd', page: 1, kind: 'redact', rect: [40, 510, 300, 535] })],
    });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  describe('page operations', () => {
    it('deletes, moves and inserts', async () => {
      const out = await buildPdf(await samplePdf(4), {
        marks: [],
        ops: [
          { kind: 'delete', page: 2 },
          { kind: 'insertBlank', after: 1 },
          { kind: 'move', page: 1, to: 3 },
        ],
      });
      expect((await PDFDocument.load(out)).getPageCount()).toBe(4);
    });

    it('refuses to delete the last page, because an empty PDF opens nowhere', async () => {
      const out = await buildPdf(await samplePdf(1), {
        marks: [],
        ops: [{ kind: 'delete', page: 1 }],
      });
      expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
    });

    it('adds to the rotation a page already carries', async () => {
      const out = await buildPdf(await samplePdf(1), {
        marks: [],
        ops: [
          { kind: 'rotate', page: 1, degrees: 90 },
          { kind: 'rotate', page: 1, degrees: 90 },
        ],
      });
      expect((await PDFDocument.load(out)).getPage(0).getRotation().angle).toBe(180);
    });

    it('inserts another PDF and a picture', async () => {
      const out = await buildPdf(await samplePdf(2), {
        marks: [],
        ops: [
          { kind: 'insertPdf', after: 1, bytes: await samplePdf(2) },
          { kind: 'insertImage', after: 0, bytes: PNG_1PX, mime: 'image/png' },
        ],
      });
      expect((await PDFDocument.load(out)).getPageCount()).toBe(5);
    });
  });
});

describe('whole-file operations', () => {
  it('merges in the order given', async () => {
    const merged = await mergePdfs([await samplePdf(2), await samplePdf(3)]);
    expect((await PDFDocument.load(merged)).getPageCount()).toBe(5);
  });

  it('extracts the pages asked for, in that order, and ignores impossible ones', async () => {
    const out = await extractPages(await samplePdf(5), [4, 2, 99, 0]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });

  it('turns pictures into pages', async () => {
    const out = await imagesToPdf([
      { bytes: PNG_1PX, mime: 'image/png' },
      { bytes: PNG_1PX, mime: 'image/png' },
    ]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });

  it('rewrites the document properties', async () => {
    const out = await setProperties(await samplePdf(1), {
      title: 'Neuer Titel',
      author: 'MenuCloud Berlin',
    });
    const reopened = await PDFDocument.load(out);
    expect(reopened.getTitle()).toBe('Neuer Titel');
    expect(reopened.getAuthor()).toBe('MenuCloud Berlin');
  });
});

describe('readFormFields', () => {
  it('reports the fields with their types and current values', async () => {
    const fields = await readFormFields(await samplePdf(1));
    expect(fields.map((f) => f.type).sort()).toEqual(['checkbox', 'text']);
  });

  it('returns nothing for a document without a form', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    expect(await readFormFields(await doc.save())).toEqual([]);
  });
});

describe('remapPage', () => {
  it('leaves everything alone on a rotation', () => {
    expect(remapPage({ kind: 'rotate', page: 2, degrees: 90 }, 5)).toBe(5);
  });

  it('drops a mark on a deleted page and pulls the rest forward', () => {
    const op = { kind: 'delete', page: 3 } as const;
    expect(remapPage(op, 3)).toBeNull();
    expect(remapPage(op, 2)).toBe(2);
    expect(remapPage(op, 4)).toBe(3);
  });

  it('follows a page moved backwards', () => {
    const op = { kind: 'move', page: 2, to: 5 } as const;
    expect(remapPage(op, 2)).toBe(5);
    expect(remapPage(op, 3)).toBe(2);
    expect(remapPage(op, 5)).toBe(4);
    expect(remapPage(op, 6)).toBe(6);
    expect(remapPage(op, 1)).toBe(1);
  });

  it('follows a page moved forwards', () => {
    const op = { kind: 'move', page: 5, to: 2 } as const;
    expect(remapPage(op, 5)).toBe(2);
    expect(remapPage(op, 2)).toBe(3);
    expect(remapPage(op, 4)).toBe(5);
    expect(remapPage(op, 6)).toBe(6);
    expect(remapPage(op, 1)).toBe(1);
  });

  it('is a permutation: no two pages end up on the same one', () => {
    for (const op of [
      { kind: 'move', page: 2, to: 5 },
      { kind: 'move', page: 5, to: 2 },
      { kind: 'move', page: 1, to: 6 },
    ] as const) {
      const mapped = [1, 2, 3, 4, 5, 6].map((page) => remapPage(op, page));
      expect(new Set(mapped).size).toBe(6);
    }
  });

  it('pushes the pages after an insertion down', () => {
    expect(remapPage({ kind: 'insertBlank', after: 2 }, 2)).toBe(2);
    expect(remapPage({ kind: 'insertBlank', after: 2 }, 3)).toBe(4);
  });

  it('pushes by as many pages as an inserted file brings', async () => {
    const op = { kind: 'insertPdf', after: 1, bytes: await samplePdf(3) } as const;
    expect(remapPage(op, 1)).toBe(1);
    expect(remapPage(op, 2)).toBe(5);
  });
});
