/**
 * The six store screens, rebuilt as HTML.
 *
 * These are not decorative mock-ups: the player stage is laid out with the same
 * `computeStageGeometry` / `computeOrp` the product uses, and every colour comes from
 * `@lexipulse/ui` tokens. If the design system moves, these move with it.
 *
 * Copy is real German (and real English) — never Lorem Ipsum — and deliberately free of
 * invented numbers about the product itself. Figures inside the device belong to the
 * fictional reader whose screen we are showing, not to a marketing claim.
 */

import { computeOrp } from '@lexipulse/core';
import { computeStageGeometry, pivotOffsetColumns } from '@lexipulse/ui/geometry';

export type Locale = 'de' | 'en';

export interface ScreenDef {
  id: string;
  headline: Record<Locale, string>;
  sub: Record<Locale, string>;
  /** Route to grab from the web dev server when it happens to be running. */
  /**
   * Route of the running web app that renders this screen, or `null` when no route can
   * reach it without a user action the capture cannot fake.
   */
  devPath: string | null;
  /** Also used for the iPad set, which is a subset. */
  tablet: boolean;
  body: (locale: Locale) => string;
}

const t = <T,>(de: T, en: T) => ({ de, en });

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function icon(paths: string, extra = ''): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;
}

const ICONS = {
  chevronLeft: icon('<path d="M15 5 8 12l7 7"/>'),
  sliders: icon('<path d="M5 8h14M5 16h14"/><circle cx="10" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>'),
  library: icon('<path d="M5 4v16M10 4v16M15.5 5l3.5 15"/>'),
  play: icon('<path d="M8 5.5 18 12 8 18.5z" fill="currentColor" stroke-width="1"/>'),
  chart: icon('<path d="M5 19V11M12 19V5M19 19v-5"/>'),
  gear: icon('<path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="17" r="2"/>'),
  file: icon('<path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13 3v6h6"/>'),
  search: icon('<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>'),
  check: icon('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
};

function statusBar(): string {
  return `<div class="statusbar">
    <span class="clock">9:41</span>
    <span class="status-right">
      <span class="bars"><i></i><i></i><i></i><i></i></span>
      <span class="battery"><i></i></span>
    </span>
  </div>`;
}

type Tab = 'library' | 'read' | 'stats' | 'settings';

function tabBar(active: Tab, locale: Locale): string {
  const labels: Record<Tab, Record<Locale, string>> = {
    library: t('Bibliothek', 'Library'),
    read: t('Lesen', 'Read'),
    stats: t('Statistik', 'Stats'),
    settings: t('Einstellungen', 'Settings'),
  };
  const glyphs: Record<Tab, string> = {
    library: ICONS.library,
    read: ICONS.play,
    stats: ICONS.chart,
    settings: ICONS.gear,
  };
  const items = (Object.keys(labels) as Tab[])
    .map(
      (key) =>
        `<div class="tab${key === active ? ' is-active' : ''}"><span class="tab-icon">${glyphs[key]}</span><span>${labels[key][locale]}</span></div>`,
    )
    .join('');
  return `<nav class="tabbar">${items}</nav>`;
}

function pageHead(title: string, sub: string): string {
  return `<header class="page-head"><h1>${title}</h1><p>${sub}</p></header>`;
}

function toggleRow(label: string, on: boolean): string {
  return `<div class="toggle-row"><span>${label}</span><span class="switch${on ? ' is-on' : ''}"><i></i></span></div>`;
}

/**
 * The RSVP stage, laid out through the shared geometry module rather than by eye.
 * `1ch` on a monospace face is exactly one column, so the CSS below is the same
 * arithmetic the player runs at 60 fps.
 */
function stage(word: string): string {
  // A 14-character worst case rather than the tokenizer's 22: the store screen shows a
  // sentence, not an outlier, and 22 columns would shrink the type to a whisper.
  const geometry = computeStageGeometry({ maxWordLength: 14, padding: 1 });
  const orp = computeOrp(word);
  const shift = pivotOffsetColumns(orp, geometry.focusColumn);
  const chars = Array.from(word);
  const spans = chars
    .map((ch, i) => (i === orp ? `<b>${ch}</b>` : `<span>${ch}</span>`))
    .join('');

  // The rails live inside the track, not the stage: their column is measured from the
  // word's own origin, and a rail one character off the pivot is the whole illusion gone.
  return `<section class="stage">
    <div class="track" style="--cols:${geometry.columns};--focus:${geometry.focusColumn}">
      <div class="rail rail-top"></div>
      <div class="rail rail-bottom"></div>
      <div class="word" style="transform:translateX(${shift}ch)">${spans}</div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

const player = (locale: Locale): string => `
  ${statusBar()}
  <header class="topbar">
    <span class="icon-btn">${ICONS.chevronLeft}</span>
    <span class="doc">
      <b>Die Verwandlung</b>
      <em>${locale === 'de' ? 'Kapitel 1 · Franz Kafka' : 'Chapter 1 · Franz Kafka'}</em>
    </span>
    <span class="icon-btn">${ICONS.sliders}</span>
  </header>
  ${stage(locale === 'de' ? 'verwandelt' : 'transformed')}
  <div class="controls">
    <div class="progress"><i style="width:23%"></i></div>
    <div class="progress-meta">
      <span>23 %</span>
      <span>${locale === 'de' ? 'noch 41 Min.' : '41 min left'}</span>
    </div>
    <div class="transport">
      <button class="step">−</button>
      <div class="wpm"><b>480</b><span>${locale === 'de' ? 'Wörter/Min.' : 'words/min'}</span></div>
      <button class="step">+</button>
    </div>
    <button class="primary">${locale === 'de' ? 'Pause' : 'Pause'}</button>
  </div>
  ${tabBar('read', locale)}
`;

const importScreen = (locale: Locale): string => {
  const recents = [
    { title: 'Die Verwandlung', meta: 'EPUB · 2,1 MB' },
    { title: 'Der Prozess', meta: 'EPUB · 4,7 MB' },
    { title: locale === 'de' ? 'Grundgesetz (Auszug)' : 'Basic Law (excerpt)', meta: 'PDF · 1,3 MB' },
    { title: 'Effi Briest', meta: 'EPUB · 3,4 MB' },
    { title: locale === 'de' ? 'Recherche: KI-Regulierung' : 'Research: AI regulation', meta: 'HTML · 84 kB' },
  ];
  return `
  ${statusBar()}
  ${pageHead(
    locale === 'de' ? 'Importieren' : 'Import',
    locale === 'de'
      ? 'Alles wird auf diesem Gerät verarbeitet.'
      : 'Everything is processed on this device.',
  )}
  <div class="dropzone">
    <span class="dz-icon">${ICONS.file}</span>
    <b>${locale === 'de' ? 'Datei ablegen oder auswählen' : 'Drop a file or pick one'}</b>
    <em>EPUB · PDF · TXT · MD · HTML</em>
  </div>
  <div class="or"><span>${locale === 'de' ? 'oder' : 'or'}</span></div>
  <div class="url-row">
    <span class="url-field">https://www.zeit.de/…</span>
    <span class="url-btn">${locale === 'de' ? 'Laden' : 'Fetch'}</span>
  </div>
  <div class="section-label">${locale === 'de' ? 'Zuletzt importiert' : 'Recently imported'}</div>
  <ul class="list">
    ${recents
      .map(
        (r) =>
          `<li><span class="li-icon">${ICONS.file}</span><span class="li-body"><b>${r.title}</b><em>${r.meta}</em></span><span class="li-ok">${ICONS.check}</span></li>`,
      )
      .join('')}
  </ul>
  ${tabBar('library', locale)}
`;
};

const smartFilter = (locale: Locale): string => {
  const before =
    locale === 'de'
      ? [
          { text: '— 14 —', strike: true },
          { text: 'DER PROZESS · KAPITEL II', strike: true },
          { text: 'Jemand musste Josef K. ver-', strike: false },
          { text: 'leumdet haben, denn ohne', strike: false },
          { text: '| Tab. 3 | 12 | 44 | 91 |', strike: true },
          { text: '¹ Vgl. Anm. des Herausgebers', strike: true },
        ]
      : [
          { text: '— 14 —', strike: true },
          { text: 'THE TRIAL · CHAPTER II', strike: true },
          { text: 'Someone must have slan-', strike: false },
          { text: 'dered Josef K., for one', strike: false },
          { text: '| Tab. 3 | 12 | 44 | 91 |', strike: true },
          { text: '¹ Cf. editor’s note', strike: true },
        ];
  const after =
    locale === 'de'
      ? ['Jemand musste Josef K.', 'verleumdet haben, denn ohne', 'dass er etwas Böses getan']
      : ['Someone must have slandered', 'Josef K., for one morning he', 'was arrested without having'];

  const toggles: [string, boolean][] =
    locale === 'de'
      ? [
          ['Kopf- und Fußzeilen entfernen', true],
          ['Seitenzahlen entfernen', true],
          ['Silbentrennung zusammenführen', true],
          ['Tabellen überspringen', true],
          ['Fußnoten ausblenden', false],
        ]
      : [
          ['Strip headers and footers', true],
          ['Strip page numbers', true],
          ['Rejoin hyphenated words', true],
          ['Skip tables', true],
          ['Hide footnotes', false],
        ];

  return `
  ${statusBar()}
  ${pageHead(
    'Smart-Filter',
    locale === 'de'
      ? 'Der PDF-Text wird bereinigt, bevor das erste Wort erscheint.'
      : 'PDF text is cleaned up before the first word appears.',
  )}
  <div class="diff">
    <div class="diff-col">
      <span class="tag">${locale === 'de' ? 'Rohtext' : 'Raw text'}</span>
      ${before.map((l) => `<p class="${l.strike ? 'is-dropped' : ''}">${l.text}</p>`).join('')}
    </div>
    <div class="diff-col is-clean">
      <span class="tag tag-ok">${locale === 'de' ? 'Bereinigt' : 'Cleaned'}</span>
      ${after.map((l) => `<p>${l}</p>`).join('')}
    </div>
  </div>
  <div class="card">
    ${toggles.map(([label, on]) => toggleRow(label, on)).join('')}
  </div>
  <p class="footnote">${
    locale === 'de'
      ? 'Reine Heuristik. Kein Modell, keine Cloud, kein Upload.'
      : 'Plain heuristics. No model, no cloud, no upload.'
  }</p>
  ${tabBar('library', locale)}
`;
};

const settings = (locale: Locale): string => {
  const themes: [string, string, string][] = [
    ['OLED Black', '#000000', '#1C1C1F'],
    ['Graphite', '#18181B', '#3A3A40'],
    ['Sepia', '#F4ECD8', '#C9B894'],
    ['Minimal', '#FFFFFF', '#D2D2D6'],
  ];
  const switches: [string, boolean][] =
    locale === 'de'
      ? [
          ['Pause am Satzende', true],
          ['Lange Wörter dehnen', true],
          ['Display anlassen', true],
          ['Sprachausgabe koppeln', false],
        ]
      : [
          ['Pause at sentence end', true],
          ['Stretch long words', true],
          ['Keep screen awake', true],
          ['Sync with speech', false],
        ];

  return `
  ${statusBar()}
  ${pageHead(
    locale === 'de' ? 'Einstellungen' : 'Settings',
    locale === 'de' ? 'Tempo, Pausen und Farben.' : 'Pace, pauses and colours.',
  )}
  <div class="card">
    <div class="row-label">${locale === 'de' ? 'Tempo' : 'Pace'}</div>
    <div class="wpm-big">480<em>${locale === 'de' ? 'Wörter/Min.' : 'words/min'}</em></div>
    <div class="slider"><span class="track"><i style="width:35%"></i><b style="left:35%"></b></span></div>
    <div class="slider-scale"><span>100</span><span>1200</span></div>
  </div>
  <div class="card">
    <div class="row-label">Theme</div>
    <div class="swatches">
      ${themes
        .map(
          ([name, bg, border], i) =>
            `<div class="swatch${i === 0 ? ' is-active' : ''}"><span style="background:${bg};border-color:${border}"></span><em>${name}</em></div>`,
        )
        .join('')}
    </div>
  </div>
  <div class="card">
    <div class="row-label">${locale === 'de' ? 'Akzent' : 'Accent'}</div>
    <div class="accents">
      <span class="accent is-active" style="background:#FF4D4D"></span>
      <span class="accent" style="background:#FFB020"></span>
      <span class="accent" style="background:#22E584"></span>
    </div>
  </div>
  <div class="card">
    ${switches.map(([label, on]) => toggleRow(label, on)).join('')}
  </div>
  ${tabBar('settings', locale)}
`;
};

const library = (locale: Locale): string => {
  const books = [
    { initials: 'DV', title: 'Die Verwandlung', author: 'Franz Kafka', kind: 'EPUB', pct: 23 },
    { initials: 'DP', title: 'Der Prozess', author: 'Franz Kafka', kind: 'EPUB', pct: 61 },
    { initials: 'EB', title: 'Effi Briest', author: 'Theodor Fontane', kind: 'EPUB', pct: 8 },
    { initials: 'GG', title: 'Grundgesetz', author: locale === 'de' ? 'Auszug' : 'Excerpt', kind: 'PDF', pct: 100 },
    { initials: 'FT', title: 'Faust I', author: 'J. W. von Goethe', kind: 'EPUB', pct: 0 },
    { initials: 'RA', title: locale === 'de' ? 'Recherche: KI-Regulierung' : 'Research: AI regulation', author: locale === 'de' ? 'Artikel' : 'Article', kind: 'HTML', pct: 100 },
  ];
  return `
  ${statusBar()}
  ${pageHead(
    locale === 'de' ? 'Bibliothek' : 'Library',
    locale === 'de' ? `${books.length} Titel · alle offline verfügbar` : `${books.length} titles · all available offline`,
  )}
  <div class="search"><span>${ICONS.search}</span><em>${locale === 'de' ? 'Titel suchen' : 'Search titles'}</em></div>
  <ul class="books">
    ${books
      .map(
        (b) => `<li>
      <span class="cover">${b.initials}</span>
      <span class="book-body">
        <b>${b.title}</b>
        <em>${b.author} · ${b.kind}</em>
        <span class="bar"><i style="width:${b.pct}%"></i></span>
      </span>
      <span class="pct">${b.pct === 100 ? (locale === 'de' ? 'fertig' : 'done') : `${b.pct} %`}</span>
    </li>`,
      )
      .join('')}
  </ul>
  <p class="footnote">${locale === 'de' ? 'Kein Konto. Keine Cloud. Keine Synchronisierung.' : 'No account. No cloud. No sync.'}</p>
  ${tabBar('library', locale)}
`;
};

const stats = (locale: Locale): string => {
  const days =
    locale === 'de'
      ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heights = [42, 66, 30, 88, 54, 74, 96];
  return `
  ${statusBar()}
  ${pageHead(
    locale === 'de' ? 'Statistik' : 'Stats',
    locale === 'de' ? 'Nur auf diesem Gerät gespeichert.' : 'Stored on this device only.',
  )}
  <div class="kpis">
    <div><b>18.420</b><em>${locale === 'de' ? 'Wörter diese Woche' : 'words this week'}</em></div>
    <div><b>470</b><em>${locale === 'de' ? 'Ø Wörter/Min.' : 'avg words/min'}</em></div>
    <div><b>2:14</b><em>${locale === 'de' ? 'Std. Lesezeit' : 'hours read'}</em></div>
  </div>
  <div class="card">
    <div class="row-label">${locale === 'de' ? 'Letzte 7 Tage' : 'Last 7 days'}</div>
    <div class="chart">
      ${days.map((d, i) => `<div class="bar-col"><i style="height:${heights[i]}%"></i><em>${d}</em></div>`).join('')}
    </div>
  </div>
  <div class="card streak">
    <div class="row-label">${locale === 'de' ? 'Serie' : 'Streak'}</div>
    <div class="streak-row">${Array.from({ length: 14 }, (_, i) => `<i class="${i > 1 ? 'is-on' : ''}"></i>`).join('')}</div>
    <p>${locale === 'de' ? '12 Tage in Folge gelesen.' : '12 days in a row.'}</p>
  </div>
  <div class="card">
    <div class="row-label">${locale === 'de' ? 'Nach Dokument' : 'By document'}</div>
    ${[
      { title: 'Der Prozess', words: '9.140', time: '1:04' },
      { title: 'Die Verwandlung', words: '5.860', time: '0:41' },
      { title: locale === 'de' ? 'Recherche: KI-Regulierung' : 'Research: AI regulation', words: '3.420', time: '0:29' },
    ]
      .map(
        (row) =>
          `<div class="doc-row"><span>${row.title}</span><em>${row.words} · ${row.time} h</em></div>`,
      )
      .join('')}
  </div>
  ${tabBar('stats', locale)}
`;
};

export const SCREENS: readonly ScreenDef[] = [
  {
    id: '01-player',
    headline: t('Ein Wort. Immer an derselben Stelle.', 'One word. Always in the same place.'),
    sub: t(
      'Der Fixierpunkt bleibt stehen — dein Auge muss nicht mehr springen.',
      'The fixation point holds still — your eye stops jumping.',
    ),
    devPath: '/reader?doc=epub_die-verwandlung_seed01',
    tablet: true,
    body: player,
  },
  {
    id: '02-import',
    headline: t('EPUB, PDF, Artikel. In Sekunden.', 'EPUB, PDF, articles. In seconds.'),
    sub: t(
      'Datei ablegen oder Link einfügen — der Rest passiert lokal.',
      'Drop a file or paste a link — the rest happens locally.',
    ),
    devPath: '/reader',
    tablet: true,
    body: importScreen,
  },
  {
    id: '03-page',
    headline: t('Anhalten und die ganze Seite sehen.', 'Stop, and see the whole page.'),
    sub: t(
      'Das aktuelle Wort bleibt markiert — tippe ein anderes an, um dort weiterzulesen.',
      'The current word stays marked — tap another one to carry on from there.',
    ),
    // No route reaches this without a document open and the view expanded, so the capture
    // comes from a device.
    devPath: null,
    tablet: false,
    body: smartFilter,
  },
  {
    id: '04-settings',
    headline: t('100 bis 1200 Wörter pro Minute. Vier Themes.', '100 to 1200 words per minute. Four themes.'),
    sub: t(
      'Tempo, Pausen und Farben stellst du so ein, wie du liest.',
      'Set pace, pauses and colours the way you actually read.',
    ),
    devPath: '/reader?doc=epub_die-verwandlung_seed01',
    tablet: true,
    body: settings,
  },
  {
    id: '05-library',
    headline: t('Deine Bibliothek. Offline. Auf deinem Gerät.', 'Your library. Offline. On your device.'),
    sub: t(
      'Kein Konto, keine Cloud, keine Synchronisierung im Hintergrund.',
      'No account, no cloud, no background sync.',
    ),
    devPath: '/reader/library',
    tablet: true,
    body: library,
  },
  {
    id: '06-stats',
    headline: t('Sieh, wie viel du wirklich liest.', 'See how much you actually read.'),
    sub: t(
      'Wörter, Tempo und Lesezeit — nur für dich, nur auf diesem Gerät.',
      'Words, pace and reading time — yours alone, on this device.',
    ),
    devPath: '/reader/stats',
    tablet: false,
    body: stats,
  },
];
