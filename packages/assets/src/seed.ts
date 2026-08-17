/**
 * Demo library for the store screenshots.
 *
 * A live capture of the real web app is only better than a rebuilt template if the app
 * actually has something to show. An empty statistics screen under the headline
 * "see how much you really read" is worse than no screenshot at all, so the capture
 * seeds the browser's IndexedDB before it navigates.
 *
 * This is illustrative UI content, the way every store listing shows a populated app.
 * It is not a claim about anyone else: no user counts, no ratings, no testimonials.
 * The books are public domain.
 */

import { SEED_PDF_DOCUMENT_ID, SEED_STAMP_ID } from './seed-pdf.js';

const DAY = 86_400_000;

/** `YYYY-MM-DD` in local time — the key format `LexiStore.dayKey` writes. */
function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

interface SeedBook {
  id: string;
  title: string;
  author: string;
  source: 'epub' | 'pdf' | 'html';
  language: string;
  chapters: { title: string; text: string }[];
  /** Fraction read. */
  percent: number;
  /**
   * Word the player should be sitting on in the screenshot, resolved by searching the
   * text rather than guessing a fraction. A three-letter word leaves the stage looking
   * empty and hides the very thing the headline is about, and a hand-tuned percentage
   * silently lands somewhere else the moment the excerpt is edited.
   */
  startWord?: string;
  /** Days ago the book was last opened. */
  lastOpenedDaysAgo: number;
}

/** The book the player screenshot opens. Exported so the capture can deep-link to it. */
export const SEED_PLAYER_DOCUMENT_ID = 'epub_die-verwandlung_seed01';

const BOOKS: SeedBook[] = [
  {
    id: 'epub_die-verwandlung_seed01',
    // Labelled as the excerpt it is: the word count and the remaining time the library
    // shows are computed from the text stored here, so a title promising a whole novella
    // next to "190 Wörter" would be the app contradicting itself in a store listing.
    title: 'Die Verwandlung (Auszug)',
    author: 'Franz Kafka',
    source: 'epub',
    language: 'de',
    percent: 0.3,
    startWord: 'flimmerten',
    lastOpenedDaysAgo: 0,
    chapters: [
      {
        title: 'Kapitel 1',
        text: [
          'Als Gregor Samsa eines Morgens aus unruhigen Träumen erwachte, fand er sich in seinem Bett zu einem ungeheueren Ungeziefer verwandelt. Er lag auf seinem panzerartig harten Rücken und sah, wenn er den Kopf ein wenig hob, seinen gewölbten, braunen, von bogenförmigen Versteifungen geteilten Bauch.',
          'Seine vielen, im Vergleich zu seinem sonstigen Umfang kläglich dünnen Beine flimmerten ihm hilflos vor den Augen. Was ist mit mir geschehen, dachte er. Es war kein Traum. Sein Zimmer, ein richtiges, nur etwas zu kleines Menschenzimmer, lag ruhig zwischen den vier wohlbekannten Wänden.',
          'Über dem Tisch, auf dem eine auseinandergepackte Musterkollektion von Tuchwaren ausgebreitet war, hing das Bild, das er vor kurzem aus einer illustrierten Zeitschrift ausgeschnitten und in einem hübschen, vergoldeten Rahmen untergebracht hatte.',
        ].join('\n\n'),
      },
      {
        title: 'Kapitel 2',
        text: [
          'Erst in der Dämmerung erwachte Gregor aus seinem schweren, ohnmachtsähnlichen Schlaf. Er wäre gewiß nicht viel später auch ohne Störung erwacht, denn er fühlte sich genügend ausgeruht und ausgeschlafen.',
          'Ihm war, als sei ihm ein flüchtiger Schritt und ein vorsichtiges Schließen der zum Vorzimmer führenden Tür geweckt worden. Der Schein der elektrischen Straßenlampen lag bleich hier und da auf der Zimmerdecke und auf den höheren Teilen der Möbel.',
        ].join('\n\n'),
      },
    ],
  },
  {
    id: 'epub_effi-briest_seed02',
    title: 'Effi Briest (Auszug)',
    author: 'Theodor Fontane',
    source: 'epub',
    language: 'de',
    percent: 0.61,
    lastOpenedDaysAgo: 1,
    chapters: [
      {
        title: 'Erstes Kapitel',
        text: [
          'In Front des schon seit Kurfürst Georg Wilhelm von der Familie von Briest bewohnten Herrenhauses zu Hohen-Cremmen fiel heller Sonnenschein auf die mittagsstille Dorfstraße, während nach der Park- und Gartenseite hin ein rechtwinklig angebauter Seitenflügel einen breiten Schatten warf.',
          'Hier fiel zunächst auf einen kleinen, weiß und grün quadrierten Fliesengang, dahinter aber, mit einer kleinen Erhöhung, auf ein in drei Stufen ansteigendes Rondell mit einer Sonnenuhr in der Mitte.',
          'Ein paar Schritte weiter, und man stand an dem großen, in seinen Umrissen kaum sichtbaren Teich, an dessen Rand eine Brücke lag, die zu einem Bootssteg führte.',
        ].join('\n\n'),
      },
    ],
  },
  {
    id: 'pdf_wahrnehmung-und-lesen_seed03',
    title: 'Wahrnehmung und Lesen',
    author: null as unknown as string,
    source: 'pdf',
    language: 'de',
    percent: 0.08,
    lastOpenedDaysAgo: 3,
    chapters: [
      {
        title: 'Teil 1',
        text: [
          'Beim Lesen bewegt sich das Auge nicht gleichmäßig über die Zeile, sondern in kurzen Sprüngen, den Sakkaden, zwischen denen es für etwa zweihundert Millisekunden stillsteht. Nur während dieser Fixationen wird tatsächlich Information aufgenommen.',
          'Die Stelle innerhalb eines Wortes, an der das Auge bevorzugt landet, liegt nicht in der Mitte, sondern etwas links davon. Von dort aus lässt sich das Wort am zuverlässigsten als Ganzes erkennen.',
        ].join('\n\n'),
      },
    ],
  },
  {
    id: 'html_warum-rsvp-funktioniert_seed04',
    title: 'Warum RSVP funktioniert',
    author: 'Anna Berg',
    source: 'html',
    language: 'de',
    percent: 1,
    lastOpenedDaysAgo: 6,
    chapters: [
      {
        title: 'Abschnitt 1',
        text: [
          'Rapid Serial Visual Presentation zeigt Wörter nacheinander an derselben Bildschirmposition. Die Sakkade entfällt, weil es nichts mehr anzuspringen gibt, und der Blick bleibt auf einer Stelle stehen.',
          'Entscheidend ist, dass der Erkennungspunkt jedes Wortes exakt auf derselben Spalte liegt. Wandert er, muss das Auge ihn jedes Mal neu suchen, und der Vorteil ist wieder aufgebraucht.',
        ].join('\n\n'),
      },
    ],
  },
];

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Key/value pairs for the `kv` object store of the `lexipulse` IndexedDB database,
 * exactly as `LexiStore` writes them.
 */
export function seedEntries(now = Date.now()): [string, string][] {
  const entries: [string, string][] = [['lexi:schema', '1']];
  entries.push(...pdfSeedEntries(now));

  let totalTokensRead = 0;

  for (const book of BOOKS) {
    const chapters = book.chapters.map((chapter, index) => ({
      id: `c${index}`,
      title: chapter.title,
      text: chapter.text,
      startToken: 0,
      tokenCount: 0,
    }));
    const wordCount = chapters.reduce((sum, c) => sum + countWords(c.text), 0);
    const updatedAt = now - book.lastOpenedDaysAgo * DAY;

    entries.push([
      `lexi:doc:${book.id}`,
      JSON.stringify({
        id: book.id,
        title: book.title,
        author: book.author ?? null,
        source: book.source,
        origin: null,
        language: book.language,
        chapters,
        totalTokens: wordCount,
        wordCount,
        coverDataUrl: null,
        createdAt: updatedAt - 4 * DAY,
        updatedAt,
        importReport: {
          source: book.source,
          rawSections: chapters.length,
          removed: {
            headers: book.source === 'pdf' ? 214 : 0,
            footers: book.source === 'pdf' ? 107 : 0,
            pageNumbers: book.source === 'pdf' ? 107 : 0,
            tableRows: book.source === 'pdf' ? 63 : 0,
            artifacts: book.source === 'pdf' ? 41 : 3,
          },
          dehyphenated: book.source === 'pdf' ? 386 : 0,
          notes: [],
          durationMs: 812,
        },
      }),
    ]);

    const words = chapters
      .map((c) => c.text)
      .join(' ')
      .trim()
      .split(/\s+/);
    const wordIndex = book.startWord
      ? words.findIndex((w) => w.replace(/[^\p{L}\p{N}]/gu, '') === book.startWord)
      : -1;
    if (book.startWord && wordIndex === -1) {
      throw new Error(`Seed word "${book.startWord}" is not in "${book.title}" any more.`);
    }
    const tokenIndex = wordIndex >= 0 ? wordIndex : Math.round(wordCount * book.percent);
    const percent = wordCount > 0 ? tokenIndex / wordCount : 0;
    entries.push([
      `lexi:progress:${book.id}`,
      JSON.stringify({
        documentId: book.id,
        tokenIndex,
        chapterIndex: Math.min(chapters.length - 1, Math.floor(percent * chapters.length)),
        percent,
        updatedAt,
        msRead: Math.round((tokenIndex / 380) * 60_000),
      }),
    ]);
  }

  // Twelve consecutive days ending today, so a recomputed streak lands on twelve too.
  const daily: Record<string, number> = {};
  const pattern = [1840, 2260, 960, 3120, 1480, 2040, 780, 2680, 1320, 1960, 2410, 1150];
  for (let i = 0; i < pattern.length; i += 1) {
    const words = pattern[i] as number;
    daily[dayKey(now - i * DAY)] = words;
    totalTokensRead += words;
  }
  // Earlier, sparser history for the heatmap.
  for (let i = 14; i < 84; i += 1) {
    if (i % 3 === 0) continue;
    const words = 400 + ((i * 137) % 2200);
    daily[dayKey(now - i * DAY)] = words;
    totalTokensRead += words;
  }

  const averageWpm = 382;
  const totalMsRead = Math.round((totalTokensRead / averageWpm) * 60_000);

  entries.push([
    'lexi:stats',
    JSON.stringify({
      totalMsRead,
      totalTokensRead,
      documentsStarted: BOOKS.length,
      documentsFinished: BOOKS.filter((b) => b.percent >= 1).length,
      averageWpm,
      daily,
      streakDays: 12,
    }),
  ]);

  entries.push([
    'lexi:bm:epub_die-verwandlung_seed01:bm-seed-1',
    JSON.stringify({
      id: 'bm-seed-1',
      documentId: 'epub_die-verwandlung_seed01',
      tokenIndex: 18,
      chapterIndex: 0,
      preview: 'zu einem ungeheueren Ungeziefer verwandelt',
      note: null,
      createdAt: now - 2 * DAY,
    }),
  ]);

  return entries;
}



/* ------------------------------------------------------------------ the demo PDF */

/**
 * The record for the demo agreement, plus the marks the original-surface screenshots
 * show: a highlighted clause, a note beside it and a signature on the line.
 *
 * The file itself is written into the `files` object store by the capture, because a PDF
 * is bytes and this function returns strings. The two belong together: without the file
 * the document opens on an error, and without the record the file is an orphan the first
 * sweep removes.
 */
export function pdfSeedEntries(now: number): [string, string][] {
  const id = SEED_PDF_DOCUMENT_ID;
  const updatedAt = now - 2 * 3_600_000;

  const text = [
    'Diese Vereinbarung regelt die Zusammenarbeit zwischen der Musterwerk GmbH und der Beispiel Studio GbR für das Vorhaben „Blaupause". Sie tritt mit der Unterzeichnung durch beide Seiten in Kraft.',
    'Die Beispiel Studio GbR erstellt ein Gestaltungskonzept einschließlich zweier Entwurfsrunden. Der Leistungsumfang ergibt sich aus der Anlage 1, die Bestandteil dieser Vereinbarung ist.',
    'Der erste Entwurf wird innerhalb von vier Wochen nach Vertragsschluss vorgelegt. Rückmeldungen erfolgen jeweils innerhalb von zehn Werktagen.',
  ].join('\n\n');
  const wordCount = text.trim().split(/\s+/).length;

  const mark = (
    key: string,
    kind: string,
    rect: number[],
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: `${id}-${key}`,
    documentId: id,
    page: kind === 'signature' ? 5 : 1,
    kind,
    rect,
    color: kind === 'highlight' ? '#ffd400' : '#e5484d',
    opacity: kind === 'highlight' ? 0.4 : 1,
    strokeWidth: 2,
    createdAt: updatedAt,
    updatedAt,
    ...extra,
  });

  return [
    [
      `lexi:doc:${id}`,
      JSON.stringify({
        id,
        title: 'Vereinbarung Blaupause',
        author: 'Musterwerk GmbH',
        source: 'pdf',
        origin: 'vereinbarung-blaupause.pdf',
        language: 'de',
        chapters: [{ id: 'c0', title: 'Vereinbarung', text, startToken: 0, tokenCount: 0 }],
        totalTokens: wordCount,
        wordCount,
        coverDataUrl: null,
        createdAt: updatedAt - 3 * DAY,
        updatedAt,
        original: {
          fileId: `original:${id}`,
          mime: 'application/pdf',
          bytes: 0,
          fileName: 'vereinbarung-blaupause.pdf',
          pageCount: 5,
        },
        pageWordStarts: [0, 1, 2, 3, 4].map((page) => Math.round((wordCount * page) / 5)),
        importReport: {
          source: 'pdf',
          rawSections: 5,
          removed: { headers: 5, footers: 0, pageNumbers: 5, tableRows: 0, artifacts: 0 },
          dehyphenated: 0,
          notes: [],
          durationMs: 240,
        },
      }),
    ],
    [
      `lexi:progress:${id}`,
      JSON.stringify({
        documentId: id,
        tokenIndex: Math.round(wordCount * 0.34),
        chapterIndex: 0,
        percent: 0.34,
        updatedAt,
        msRead: 96_000,
      }),
    ],
    // Coordinates are PDF points against the page `buildSeedPdf` draws.
    [
      `lexi:mark:${id}:${id}-hl`,
      JSON.stringify(mark('hl', 'highlight', [56, 604, 470, 620])),
    ],
    [
      `lexi:mark:${id}:${id}-hl2`,
      JSON.stringify(mark('hl2', 'highlight', [56, 587, 420, 603])),
    ],
    [
      `lexi:mark:${id}:${id}-note`,
      JSON.stringify(mark('note', 'note', [498, 596, 512, 610], {
        color: '#ffb224',
        text: 'Frist mit dem Team abstimmen',
      })),
    ],
    [
      `lexi:mark:${id}:${id}-sig`,
      /*
       * On the line, not under it.
       *
       * The signature line on page 5 sits at y = 411.89 pt (`buildSeedPdf` draws it 46 pt
       * below the "Unterschrift" label). The drawn stroke fills the middle of its picture
       * and stops about a fifth short of the bottom edge, so the box has to reach past the
       * line for the ink to rest on it. The earlier box ended at 388 and the signature
       * floated a good two centimetres below the line — in a screenshot captioned
       * "unterschreiben".
       */
      JSON.stringify(mark('sig', 'signature', [304, 402, 474, 460], {
        imageId: SEED_STAMP_ID,
      })),
    ],
  ];
}
