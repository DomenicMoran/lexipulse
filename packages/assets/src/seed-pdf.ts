import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import type { Page } from 'playwright';

/**
 * The demo PDF the original-surface screenshots are taken of, and the signature on it.
 *
 * Built here rather than checked in: a binary fixture drifts silently from the code that
 * reads it, and the two screenshots that sell the whole toolkit would be the last place
 * anyone noticed. It is a made-up document — a fictional party, a fictional project — for
 * the same reason the seeded library uses public-domain books: a store listing must not
 * show anything that could be mistaken for a real person's paperwork.
 */

export const SEED_PDF_DOCUMENT_ID = 'pdf_vereinbarung_seed07';
export const SEED_STAMP_ID = `stamp:${SEED_PDF_DOCUMENT_ID}:sig`;

const BODY = [
  'Diese Vereinbarung regelt die Zusammenarbeit zwischen der Musterwerk GmbH und der',
  'Beispiel Studio GbR für das Vorhaben „Blaupause". Sie tritt mit der Unterzeichnung',
  'durch beide Seiten in Kraft und ersetzt alle vorherigen Absprachen zum selben Zweck.',
];

const CLAUSES: [string, string[]][] = [
  [
    '1. Gegenstand',
    [
      'Die Beispiel Studio GbR erstellt für die Musterwerk GmbH ein Gestaltungskonzept',
      'einschließlich zweier Entwurfsrunden. Der Leistungsumfang ergibt sich im Einzelnen',
      'aus der Anlage 1, die Bestandteil dieser Vereinbarung ist.',
    ],
  ],
  [
    '2. Fristen',
    [
      'Der erste Entwurf wird innerhalb von vier Wochen nach Vertragsschluss vorgelegt.',
      'Rückmeldungen erfolgen jeweils innerhalb von zehn Werktagen; verstreicht die Frist,',
      'gilt der Entwurf als angenommen.',
    ],
  ],
  [
    '3. Vergütung',
    [
      'Die Vergütung beträgt 8.400 Euro zuzüglich Umsatzsteuer und wird in zwei gleichen',
      'Teilen fällig: bei Vertragsschluss und bei Abnahme des zweiten Entwurfs.',
    ],
  ],
];

/** A five-page agreement with a signature line, in a face every viewer has. */
export async function buildSeedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Vereinbarung Blaupause');
  doc.setAuthor('Musterwerk GmbH');

  const body = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const grey = rgb(0.42, 0.42, 0.45);

  for (let index = 0; index < 5; index += 1) {
    const page = doc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    page.drawText('Vereinbarung Blaupause', {
      x: 56,
      y: height - 52,
      size: 9,
      font: body,
      color: grey,
    });
    page.drawLine({
      start: { x: 56, y: height - 60 },
      end: { x: width - 56, y: height - 60 },
      thickness: 0.5,
      color: grey,
    });

    let y = height - 104;

    if (index === 0) {
      page.drawText('Vereinbarung', { x: 56, y, size: 26, font: bold });
      y -= 44;
      for (const line of BODY) {
        page.drawText(line, { x: 56, y, size: 11, font: body });
        y -= 17;
      }
      y -= 22;
    }

    for (const [heading, lines] of CLAUSES) {
      page.drawText(`${heading}`, { x: 56, y, size: 12.5, font: bold });
      y -= 20;
      for (const line of lines) {
        page.drawText(line, { x: 56, y, size: 11, font: body });
        y -= 17;
      }
      y -= 18;
    }

    if (index === 4) {
      y -= 30;
      page.drawText('Ort, Datum', { x: 56, y, size: 10, font: bold });
      page.drawText('Unterschrift', { x: 300, y, size: 10, font: bold });
      page.drawLine({
        start: { x: 56, y: y - 46 },
        end: { x: 250, y: y - 46 },
        thickness: 0.75,
        color: grey,
      });
      page.drawLine({
        start: { x: 300, y: y - 46 },
        end: { x: 520, y: y - 46 },
        thickness: 0.75,
        color: grey,
      });
    }

    page.drawText(String(index + 1), {
      x: width / 2,
      y: 44,
      size: 9,
      font: body,
      color: grey,
    });
  }

  return doc.save({ useObjectStreams: true });
}

/**
 * A signature, drawn as a stroke and rasterised by the browser that is already running.
 *
 * The app produces exactly this shape — a transparent PNG that gets stamped on the page —
 * so the screenshot shows the real thing rather than a picture of a different signature
 * pasted into a mock.
 */
export async function buildSeedSignature(page: Page): Promise<Uint8Array> {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="150" viewBox="0 0 440 150">
  <path d="M18 108 C 46 40, 74 34, 84 66 C 92 92, 74 116, 66 104 C 58 92, 82 62, 118 60
           C 150 58, 150 104, 176 100 C 200 96, 196 52, 214 52 C 232 52, 224 104, 246 100
           C 268 96, 268 44, 296 56 C 320 66, 300 106, 322 100 C 352 92, 372 58, 420 46"
        fill="none" stroke="#111111" stroke-width="5.5"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

  await page.setContent(
    `<body style="margin:0;background:transparent">${svg}</body>`,
    { waitUntil: 'load' },
  );
  const element = await page.$('svg');
  if (!element) throw new Error('signature: the drawing did not render');
  return new Uint8Array(await element.screenshot({ omitBackground: true, type: 'png' }));
}
