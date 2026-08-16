import { describe, expect, it } from 'vitest';
import {
  cleanFlowText,
  cleanPages,
  findRepeatedBoilerplate,
  isArtifact,
  isPageNumber,
  isTableRow,
  isTocLeader,
  lineSignature,
  looksLikeHeading,
  reflowParagraphs,
  DEFAULT_CLEAN_OPTIONS,
} from './clean.js';

describe('lineSignature', () => {
  it('normalises numbers so a numbered running head still matches', () => {
    expect(lineSignature('Kapitel 3 — Die Analyse')).toBe(lineSignature('Kapitel 7 — Die Analyse'));
  });

  it('is case- and punctuation-insensitive', () => {
    expect(lineSignature('DIE ANALYSE.')).toBe(lineSignature('Die Analyse'));
  });
});

describe('isPageNumber', () => {
  it('detects bare, decorated and labelled page numbers', () => {
    for (const line of ['42', '  7  ', '- 42 -', '[ xiv ]', 'Seite 12', 'Page 12 of 340', '3 / 90']) {
      expect(isPageNumber(line), line).toBe(true);
    }
  });

  it('does not eat real content', () => {
    for (const line of ['1984 war ein Jahr', 'Kapitel 3', '', 'Die 42 Regeln des Lebens']) {
      expect(isPageNumber(line), line).toBe(false);
    }
  });
});

describe('isTocLeader', () => {
  it('detects dotted table-of-contents lines', () => {
    expect(isTocLeader('Kapitel 4 .......... 87')).toBe(true);
    expect(isTocLeader('Einleitung ····· 9')).toBe(true);
    expect(isTocLeader('Ein normaler Satz endet hier.')).toBe(false);
  });
});

describe('isTableRow', () => {
  it('detects space-aligned numeric grids', () => {
    expect(isTableRow('Region      Umsatz    Marge     2024')).toBe(true);
    expect(isTableRow('Nord        12.400    18,2 %    9.100')).toBe(true);
  });

  it('detects pipe and tab tables', () => {
    expect(isTableRow('| Name | Wert | Jahr |')).toBe(true);
    expect(isTableRow('Name\tWert\tJahr')).toBe(true);
  });

  it('leaves prose alone, even long prose with numbers in it', () => {
    expect(isTableRow('Im Jahr 2024 stieg der Umsatz deutlich an und das Team wuchs.')).toBe(false);
    expect(isTableRow('Ein ganz normaler Satz ohne Spalten.')).toBe(false);
  });
});

describe('isArtifact', () => {
  it('flags rules, single characters and letterless lines', () => {
    expect(isArtifact('--------------------')).toBe(true);
    expect(isArtifact('x')).toBe(true);
    expect(isArtifact('•••')).toBe(true);
    expect(isArtifact('§§§ ###')).toBe(true);
  });

  it('keeps real text', () => {
    expect(isArtifact('Ein Satz.')).toBe(false);
    expect(isArtifact('42')).toBe(false);
  });
});

describe('looksLikeHeading', () => {
  it('recognises numbered and all-caps headings', () => {
    expect(looksLikeHeading('3.1 Die Methode')).toBe(true);
    expect(looksLikeHeading('EINLEITUNG')).toBe(true);
    expect(looksLikeHeading('II. Grundlagen')).toBe(true);
  });

  it('rejects sentences and over-long lines', () => {
    expect(looksLikeHeading('Das ist ein Satz, der weitergeht,')).toBe(false);
    expect(looksLikeHeading('a'.repeat(120))).toBe(false);
  });
});

describe('findRepeatedBoilerplate', () => {
  const OPENERS = [
    'Zunaechst wird die Ausgangslage beschrieben.',
    'Anschliessend folgt die Methodik der Erhebung.',
    'Der Bruch im mittleren Zeitraum bleibt auffaellig.',
    'Die regionale Betrachtung wurde neu zugeschnitten.',
    'Im laendlichen Raum ist die Datenlage duenn.',
    'Drei Handlungsoptionen stehen zur Auswahl.',
    'Der Anhang begruendet den Zuschnitt im Detail.',
    'Ein Ausblick schliesst die Untersuchung ab.',
  ];
  const pages = OPENERS.map((opener, i) => [
    'Handbuch der Statistik',
    opener,
    `Ein weiterer eigener Gedanke traegt Kapitel ${'abcdefgh'[i]} und steht nur hier.`,
    `${i + 1}`,
  ]);

  it('finds the running head across pages', () => {
    const { headers } = findRepeatedBoilerplate(pages, DEFAULT_CLEAN_OPTIONS);
    expect(headers.has(lineSignature('Handbuch der Statistik'))).toBe(true);
  });

  it('does not flag unique body lines', () => {
    const { headers, footers } = findRepeatedBoilerplate(pages, DEFAULT_CLEAN_OPTIONS);
    expect(headers.has(lineSignature('Zunaechst wird die Ausgangslage beschrieben.'))).toBe(false);
    expect(footers.has(lineSignature('Drei Handlungsoptionen stehen zur Auswahl.'))).toBe(false);
  });

  it('still catches the running head on a three-page export', () => {
    const { headers } = findRepeatedBoilerplate(pages.slice(0, 3), DEFAULT_CLEAN_OPTIONS);
    expect(headers.has(lineSignature('Handbuch der Statistik'))).toBe(true);
  });

  it('skips the analysis below three pages, where one repeat proves nothing', () => {
    const { headers } = findRepeatedBoilerplate(pages.slice(0, 2), DEFAULT_CLEAN_OPTIONS);
    expect(headers.size).toBe(0);
  });

  it('does not flag a line that appears on only two of three pages', () => {
    const partial = [
      ['Handbuch der Statistik', 'Erster eigener Satz auf dieser Seite.'],
      ['Handbuch der Statistik', 'Zweiter eigener Satz auf dieser Seite.'],
      ['Ein anderer Kopf', 'Dritter eigener Satz auf dieser Seite.'],
    ];
    const { headers } = findRepeatedBoilerplate(partial, DEFAULT_CLEAN_OPTIONS);
    expect(headers.size).toBe(0);
  });
});

describe('reflowParagraphs', () => {
  it('rejoins hyphenated line breaks', () => {
    const { text, dehyphenated } = reflowParagraphs(
      ['Die vollstaendige Doku-', 'mentation liegt vor.'],
      true,
    );
    expect(text).toContain('Dokumentation');
    expect(text).not.toContain('Doku-');
    expect(dehyphenated).toBe(1);
  });

  it('joins hard-wrapped lines into one paragraph', () => {
    const { text } = reflowParagraphs(
      [
        'Dies ist eine sehr lange Zeile die im Satzspiegel umbricht und',
        'auf der naechsten Zeile weitergeht ohne dass ein Absatz endet.',
      ],
      true,
    );
    expect(text.split('\n\n')).toHaveLength(1);
  });

  it('starts a new paragraph after a short terminal line', () => {
    const { text } = reflowParagraphs(
      [
        'Dies ist eine sehr lange Zeile die im Satzspiegel bis zum Rand laeuft und',
        'hier endet der Absatz.',
        'Dies ist eine sehr lange Zeile die im Satzspiegel bis zum Rand laeuft und',
        'auch hier endet der Absatz.',
      ],
      true,
    );
    expect(text.split('\n\n').length).toBeGreaterThan(1);
  });

  it('keeps headings on their own paragraph', () => {
    const { text } = reflowParagraphs(['EINLEITUNG', 'Der Text beginnt hier.'], true);
    expect(text.split('\n\n')[0]).toBe('EINLEITUNG');
  });
});

describe('cleanPages', () => {
  /** Genuinely distinct prose per page — a running head repeats, body text does not. */
  const BODY: readonly (readonly [string, string, string])[] = [
    [
      'Ein laengerer Absatz eroeffnet dieses Kapitel und beschreibt die Ausgangslage,',
      'die sich aus den Erhebungen der vergangenen Jahre unmittelbar ergeben hat.',
      'Damit ist der Rahmen der Untersuchung abgesteckt.',
    ],
    [
      'Die Methodik folgt einem zweistufigen Verfahren, das zunaechst die Rohdaten',
      'bereinigt und anschliessend eine gewichtete Auswertung darueber legt.',
      'Beide Schritte sind reproduzierbar dokumentiert.',
    ],
    [
      'Auffaellig ist der Bruch im mittleren Zeitraum, den weder saisonale Effekte',
      'noch veraenderte Erhebungsmethoden allein hinreichend erklaeren koennen.',
      'Eine dritte Ursache liegt daher nahe.',
    ],
    [
      'Fuer die regionale Betrachtung wurden die Erhebungsgebiete neu zugeschnitten,',
      'weil die alten Grenzen die tatsaechlichen Verflechtungen verzerrt haben.',
      'Der Zuschnitt ist im Anhang begruendet.',
    ],
    [
      'Kritisch bleibt die Datenlage im laendlichen Raum, wo die Stichproben klein',
      'und die Ausfallquoten deutlich hoeher ausfallen als im staedtischen Umfeld.',
      'Die Ergebnisse sind dort entsprechend unsicher.',
    ],
    [
      'Abschliessend werden drei Handlungsoptionen entwickelt, die sich in Aufwand',
      'und erwarteter Wirkung erheblich voneinander unterscheiden lassen.',
      'Eine Empfehlung schliesst das Kapitel ab.',
    ],
  ];

  const pages = BODY.map((body, i) => [
    'Handbuch der Statistik',
    body[0],
    body[1],
    'Region      Umsatz    Marge     2024',
    'Nord        12.400    18,2 %    9.100',
    body[2],
    '--------------------',
    `${i + 1}`,
  ]);

  const result = cleanPages(pages);

  it('removes the running head on every page', () => {
    expect(result.text).not.toContain('Handbuch der Statistik');
    expect(result.removed.headers).toBe(6);
  });

  it('removes page numbers', () => {
    expect(result.removed.pageNumbers).toBeGreaterThan(0);
  });

  it('removes table rows', () => {
    expect(result.text).not.toContain('Umsatz');
    expect(result.text).not.toContain('12.400');
    expect(result.removed.tableRows).toBe(12);
  });

  it('removes rule artifacts', () => {
    expect(result.text).not.toContain('-----');
    expect(result.removed.artifacts).toBeGreaterThan(0);
  });

  it('keeps the body text', () => {
    expect(result.text).toContain('laengerer Absatz');
    expect(result.text).toContain('Handlungsoptionen');
    expect(result.text).toContain('Empfehlung schliesst das Kapitel ab');
  });

  it('does not mistake a repeated full-width body line for a running head', () => {
    const repeated =
      'Dieser identische Satz steht bewusst auf jeder einzelnen Seite des Dokuments und ist trotzdem Inhalt.';
    const withRepeat = Array.from({ length: 6 }, (_, i) => [
      'Handbuch der Statistik',
      repeated,
      `Nur diese Zeile unterscheidet sich, naemlich durch die Nummer ${i + 1}.`,
    ]);
    const cleaned = cleanPages(withRepeat);
    expect(cleaned.text).toContain('identische Satz');
    expect(cleaned.text).not.toContain('Handbuch der Statistik');
  });

  it('can be told to keep tables', () => {
    const kept = cleanPages(pages, { stripTables: false });
    expect(kept.removed.tableRows).toBe(0);
    expect(kept.text).toContain('Umsatz');
  });

  it('handles an empty document without throwing', () => {
    expect(cleanPages([]).text).toBe('');
    expect(cleanPages([[]]).text).toBe('');
  });
});

describe('cleanFlowText', () => {
  it('drops artifacts but never strips tables from flowing text', () => {
    const result = cleanFlowText('Ein Satz.\n\n-----\n\nName  Wert  Jahr  2024');
    expect(result.text).toContain('Ein Satz.');
    expect(result.removed.tableRows).toBe(0);
    expect(result.text).toContain('Name');
  });

  it('rejoins hyphenation in flowing text too', () => {
    const result = cleanFlowText('Die Doku-\nmentation ist fertig.');
    expect(result.text).toContain('Dokumentation');
    expect(result.dehyphenated).toBe(1);
  });
});
