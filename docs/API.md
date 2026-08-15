# LexiPulse — interne API-Referenz

Für Entwickler an `apps/web` und `apps/mobile`. Alles hier ist implementiert und durch
Tests abgedeckt (`pnpm --filter @lexipulse/core test`, 202 Tests).

## `@lexipulse/core`

Plattformfrei: kein DOM, kein React Native, keine Node-Builtins. Import über
`import { ... } from '@lexipulse/core'`.

### Typen (`types.ts`)

```ts
RsvpToken      { index, text, orp, durationMs, chapterIndex, paragraphIndex,
                 sentenceIndex, charOffset, endsSentence, endsParagraph, isNumeric }
DocumentChapter{ id, title, text, startToken, tokenCount }
LexiDocument   { id, title, author, source, origin, language, chapters,
                 totalTokens, wordCount, coverDataUrl, createdAt, updatedAt, importReport }
ImportReport   { source, rawSections, removed{headers,footers,pageNumbers,tableRows,artifacts},
                 dehyphenated, notes[], durationMs }
RsvpSettings   { wpm, pacing, theme, accent, fontFamily, fontSize, showFocusGuides,
                 showProgress, showStats, contextWords, warmupTokens, pauseOnParagraph,
                 rewindTokens, soundEnabled, ttsEnabled, ttsVoice, keepAwake, reduceMotion }
PacingMatrix   { longWord, longWordThreshold, sentenceEnd, clauseEnd, paragraphEnd,
                 numeric, shortWord, minDurationMs, maxDurationMs }
ReadingProgress, Bookmark, LibraryEntry, ReadingStats
ThemeName = 'oled' | 'graphite' | 'sepia' | 'minimal'
AccentName = 'coral' | 'amber' | 'cyber'
FontKey = 'jetbrains-mono' | 'ibm-plex-mono' | 'system-mono' | 'inter' | 'literata'
```

### ORP (`orp.ts`)

```ts
computeOrp(word: string): number          // Code-Point-Index des Fixierpunkts
splitAtOrp(word, orp?): { before, pivot, after, index }   // IMMER hierüber slicen
orpOffsetChars(word, focusColumn, orp?): number
maxOrpIndex(words: string[]): number
```

### Pacing (`pacing.ts`)

```ts
MIN_WPM = 100, MAX_WPM = 1200
DEFAULT_PACING: PacingMatrix   // longWord 1.25 ab >8 Zeichen, sentenceEnd/clauseEnd 1.75,
                               // paragraphEnd 2.0, numeric 1.4, shortWord 0.9,
                               // min 40 ms, max 3000 ms
clampWpm(wpm), baseDurationMs(wpm)
tokenDurationMs(token, wpm, matrix?)
repaceTokens(tokens, wpm, matrix?)   // mutiert in place
estimateDurationMs(tokens, from?, to?)
effectiveWpm(tokens, from?, to?)     // liegt immer unter der nominalen WPM
```

### Tokenizer (`tokenizer.ts`)

```ts
tokenize(text, { wpm, pacing?, maxWordLength?=22, startIndex?, startParagraph?,
                 startSentence?, chapterIndex? })
  -> { tokens, nextIndex, nextParagraph, nextSentence }

tokenizeChapters(chapters, { wpm, pacing?, maxWordLength? }): RsvpToken[]
  // schreibt startToken/tokenCount in die Kapitel zurück

contextAround(tokens, index, radius?): { before[], current, after[] }
isSentenceTerminator(word), isAbbreviation(word)
splitLongWord(word, maxLength): { text, hardBreak }[]

// Für TTS und Lesezeichen-Vorschau:
sentenceText(tokens, sentenceIndex): string       // Satz als sprechbarer Text
sentenceTextAt(tokens, tokenIndex): string        // Satz, in dem dieses Token steht
sentenceRange(tokens, sentenceIndex): { start, end } | null
joinTokens(tokens): string                        // Tokens wieder zu Text
```

`RsvpToken` trägt zusätzlich die optionalen Felder `continuesWord` und
`syntheticHyphen`. Sie markieren Teilstücke eines zu langen Wortes. Nur ein vom
Tokenizer **selbst eingefügter** Bindestrich darf beim Zusammenfügen wegfallen — ein
echter Kompositum-Bindestrich („Bundes-Immissionsschutzverordnung") muss bleiben.
`joinTokens` und `sentenceText` machen das korrekt; eigene Rekonstruktion per
`tokens.map(t => t.text).join(' ')` macht es falsch.

Absätze werden an Leerzeilen getrennt, einfache Zeilenumbrüche gelten als weicher
Umbruch. Wörter über 22 Zeichen werden in mehrere Tokens zerlegt (mit Bindestrich).

### Engine (`engine.ts`)

```ts
new RsvpEngine({ tokens, settings, startIndex?, now? })

play() pause() toggle() stop()
update(now?)                 // aus rAF (Web) bzw. Timer (Native) aufrufen
seek(i) seekPercent(0..1) rewind(n?) forward(n?)
seekSentence(-1|1) seekParagraph(-1|1) seekChapter(i)
setWpm(n) setPacing(m) updateSettings(patch) setTokens(tokens, startIndex?)
getSnapshot(): { status, index, token, percent, remainingMs, elapsedMs, chapterIndex, warmupFactor }
getTokens() getIndex() getStatus() currentDurationMs() totalMs()
subscribe(listener) -> unsubscribe

Events: {type:'token'|'status'|'sentence'|'paragraph'|'chapter'|'finish', ...}
formatDuration(ms): "1:05" bzw. "1:02:05"
```

Die Engine arbeitet mit einer absoluten Uhr, nicht mit Deltas: ein ausgelassener Frame
kann den Stream nicht verschieben. `warmupTokens` lässt den Stream nach jedem Start von
40 % auf volle Geschwindigkeit anlaufen.

### Settings (`settings.ts`)

```ts
DEFAULT_SETTINGS, normalizeSettings(unknown): RsvpSettings   // repariert kaputte Werte
THEMES, ACCENTS, FONTS, THEME_LABELS, ACCENT_LABELS, FONT_LABELS, MONOSPACE_FONTS
WPM_MIN=100, WPM_MAX=1200, WPM_STEP=10
SPEED_PRESETS: [study 220, read 350, skim 600, sprint 900]
applyPreset(settings, presetId)
```

### Parser (`@lexipulse/core` bzw. `@lexipulse/core/parsers`)

```ts
importDocument(bytes, { fileName?, epub?, pdf?, html?, text? }): Promise<LexiDocument>
detectKind(fileName, bytes?): 'epub'|'pdf'|'html'|'markdown'|'text'   // Magic Bytes zuerst

parseEpub(data, { minChapterChars?=240, includeCover?=true, origin? })
parsePdf(data, { loader, origin?, fallbackTitle?, chapterWords?, onProgress?, stripTables? })
parseArticleHtml(html, { url?, fallbackTitle?, chapterWords? })
fetchArticle(url, fetchImpl, options?)      // nur serverseitig / nativ
parseText(input, { title?, author?, origin?, language?, chapterWords?, source? })
markdownToText(md), inferTitle(text, fallback?)
```

**PDF:** `loader` ist Pflicht. Signatur:
`(data: Uint8Array) => Promise<PdfDocumentProxy>`, wobei `PdfDocumentProxy` das
pdf.js-Interface `{ numPages, getPage(n), getMetadata?, destroy? }` ist. Web lädt pdf.js
aus dem eigenen Bundle, Native über eine WebView-Brücke. Core hängt bewusst nicht an
pdf.js.

**Smart-Filter** (`parsers/clean.ts`): `cleanPages(pages: string[][], options?)` und
`cleanFlowText(text, options?)`. Erkennt wiederkehrende Kopf-/Fußzeilen über
Zeilensignaturen (Ziffern werden zu `#` normalisiert, nur Zeilen bis 80 Zeichen gelten
als Kandidaten), Seitenzahlen, TOC-Punktlinien, Tabellenzeilen und Layout-Artefakte,
verbindet Silbentrennungen und fließt harte Umbrüche zu Absätzen zusammen.
`itemsToLines(items)` in `parsers/pdf.ts` baut aus pdf.js-Textitems wieder Zeilen —
Spaltenabstände werden als doppeltes Leerzeichen kodiert, damit der Tabellenfilter greift.

### Storage (`@lexipulse/core/storage`)

```ts
interface StorageDriver { get, set, delete, keys(prefix), getMany?, clear? }
class MemoryDriver implements StorageDriver      // Tests, Landing-Demo

class LexiStore {
  init()
  getSettings() saveSettings(s)
  saveDocument(d) getDocument(id) deleteDocument(id) listDocuments() listLibrary()
  getProgress(docId) saveProgress(p) listAllProgress()
  addBookmark(b) deleteBookmark(docId, id) listBookmarks(docId) listAllBookmarks()
  getStats() recordSession({ tokensRead, msRead, finished?, started?, now? })
  exportAll(): Promise<string>   // Art. 20 DSGVO
  importAll(json) clearAll()
}
dayKey(ts), computeStreak(daily, now?)
```

Jede Plattform liefert nur den Driver: Web IndexedDB, Native expo-sqlite. Alles
darüber ist geteilter, getesteter Code.

## `@lexipulse/ui`

```ts
// Tokens
THEMES, ACCENTS, THEME_LABELS, ACCENT_LABELS
SPACE, RADIUS, FONT_STACKS, FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT, LETTER_SPACING,
SHADOW, MOTION, Z, BREAKPOINT
resolveTheme(theme, accent), themeCssVars(theme, accent), themeCssText(theme, accent)

// Geometrie des Players
computeStageGeometry({ maxWordLength?=22, maxOrp?=4, padding?=2 })
  -> { focusColumn, columns, leftColumns, rightColumns }
pivotOffsetColumns(orp, focusColumn), pivotTransformCss(orp, focusColumn)
pivotOffsetPx(orp, focusColumn, charWidthPx), charWidthPx(fontSize), fitFontSize(w, g)
MONO_ADVANCE_RATIO = 0.6

// React-Komponenten (Web, Tailwind-Klassen auf CSS-Variablen)
Button IconButton Card CardHeader CardTitle CardDescription CardBody
Badge Kbd Divider ProgressBar
Slider Switch SegmentedControl Stepper
BentoGrid BentoCell BentoHeading StatTile
RsvpWord RsvpStage
cn(...classes)
```

CSS-Variablen, die die App auf `<html>` setzen muss:
`--lx-bg --lx-surface --lx-surface-hover --lx-border --lx-border-strong --lx-text
--lx-text-muted --lx-text-faint --lx-stage --lx-rail --lx-overlay --lx-accent
--lx-accent-strong --lx-accent-soft --lx-accent-on --lx-accent-glow` sowie
`--lx-font-mono` für den Player.

`RsvpStage` fixiert das Wort per `translateX((focusColumn - orp)ch)`. Das funktioniert
nur mit einer Monospace-Schrift — `--lx-font-mono` muss gesetzt sein, sonst wandert der
Fixierpunkt.
