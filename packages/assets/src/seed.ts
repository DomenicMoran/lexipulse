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
  /**
   * Length of the real work. The excerpt below is only what the reader would show on
   * screen; a library card that says "188 Wörter · noch ca. unter 1 Min." next to
   * "Die Verwandlung" would look broken, because no reader has a 188-word novella.
   */
  words: number;
  /** Fraction read. */
  percent: number;
  /** Days ago the book was last opened. */
  lastOpenedDaysAgo: number;
}

const BOOKS: SeedBook[] = [
  {
    id: 'epub_die-verwandlung_seed01',
    title: 'Die Verwandlung',
    author: 'Franz Kafka',
    source: 'epub',
    language: 'de',
    words: 19_340,
    percent: 0.23,
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
    title: 'Effi Briest',
    author: 'Theodor Fontane',
    source: 'epub',
    language: 'de',
    words: 118_450,
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
    words: 32_780,
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
    words: 1_240,
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

/**
 * Key/value pairs for the `kv` object store of the `lexipulse` IndexedDB database,
 * exactly as `LexiStore` writes them.
 */
export function seedEntries(now = Date.now()): [string, string][] {
  const entries: [string, string][] = [['lexi:schema', '1']];

  let totalTokensRead = 0;

  for (const book of BOOKS) {
    const chapters = book.chapters.map((chapter, index) => ({
      id: `c${index}`,
      title: chapter.title,
      text: chapter.text,
      startToken: 0,
      tokenCount: 0,
    }));
    // The excerpt is what the reader renders; words is what the library reports.
    const wordCount = book.words;
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

    const tokenIndex = Math.round(wordCount * book.percent);
    entries.push([
      `lexi:progress:${book.id}`,
      JSON.stringify({
        documentId: book.id,
        tokenIndex,
        chapterIndex: Math.min(
          chapters.length - 1,
          Math.floor(book.percent * chapters.length),
        ),
        percent: book.percent,
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

