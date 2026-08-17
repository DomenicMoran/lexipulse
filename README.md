# LexiPulse

**Document reader and PDF toolkit.** Open a PDF, an EPUB or a web article and read it
three ways: the original page as it was laid out, flowing text in a typeface you choose,
or word by word at a fixed position with the Optimal Recognition Point highlighted. On a
PDF you can also highlight, comment, fill in forms, sign, and reorder pages. Runs offline,
needs no account, and never uploads a document.

- Web app: [lexipulse.de](https://lexipulse.de) — free
- iOS and Android: 4,99 € once. No subscription, no ads, no tracking.

## Why another reader

Two things decide whether this is usable, and both are solved here.

**The pivot drifts.** If the highlighted character does not land on the same physical
column every time, the eye has to re-acquire it and the whole point is lost. LexiPulse
pins it with `translateX((focusColumn − orp)ch)` on a monospace face, so alignment is
arithmetic, not approximation.

**PDFs arrive as garbage — and are also more than text.** A PDF is a page description:
running heads repeat on every page, footers carry page numbers, tables come through as
space-aligned noise, and words are cut in half at the line break. The import pipeline
detects and removes all of it before a single word reaches the player. The original file
is kept beside the extracted text, because the figures, tables, forms and signature lines
have no representation in it — that is what the original surface renders, and what the
editor writes back to.

## Structure

```
apps/
  web/        Next.js 15 App Router — landing page, reader, PWA
  mobile/     Expo SDK 57 — iOS and Android
packages/
  core/       RSVP engine, document parsers, page marks, storage. Platform-free.
  ui/         Design tokens, player geometry, shared React components
  assets/     Programmatic icon, logo and store-screenshot generation
store/        Legal texts, ASO metadata, store screenshots
docs/API.md   Internal API reference
```

`packages/core` has no DOM, no React Native and no Node built-ins. The same engine and
the same parsers run on web and on device; each platform supplies only a storage driver
and, for PDF, a pdf.js loader.

## Development

```bash
pnpm install
pnpm dev                    # all apps
pnpm --filter @lexipulse/web dev
pnpm test                   # all packages
pnpm typecheck
pnpm lint
```

Node 20.11+ and pnpm 10 are required.

## How the engine works

**ORP.** The pivot offset is derived from the length of a word's alphanumeric core, so
`"Hallo` and `Hallo` pivot on the same letter. Indices are code points, never UTF-16
offsets, so an emoji or a combining mark cannot split a character in half.

**Pacing matrix.** Flat RSVP gives a three-letter article the same budget as a sentence
boundary, which is why comprehension collapses. Multipliers compose:

| Condition | Multiplier |
| --- | --- |
| Word core longer than 8 characters | ×1.25 |
| Sentence end (`.` `!` `?` `…`) | ×1.75 |
| Clause end (`,` `;` `:` `—`) | ×1.75 |
| Paragraph end | ×2.0 |
| Contains digits | ×1.4 |
| Core of 3 characters or fewer | ×0.9 |

Abbreviations and ordinals are excluded from the sentence rule, so `z.B.` and `1.` do
not stall the stream.

**Warm-up.** After every resume the first few words run at 40 % of the target pace and
accelerate to full speed. Dropping straight into 900 WPM from a standstill is the single
biggest cause of reading nothing at all.

**Clock.** The engine consumes an absolute timestamp rather than frame deltas, so a
dropped frame cannot make the stream drift.

## Privacy

Documents are parsed and stored on the device: IndexedDB in the browser, SQLite on
mobile. The only server call is the URL importer, which fetches the page server-side to
get around CORS; the URL is not logged and not stored. Full data export as JSON is built
in (Art. 20 GDPR).

## Licence

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).

Read it, audit it, change it, build it and run it for yourself — that is the point of
keeping the repository public: an app that promises your documents never leave the device
should let you check. What the licence does not allow is selling it or publishing it to
an app store, which is why LexiPulse is source-available rather than open source.

Commits made before 2026-08-16 were published under the MIT licence and stay available
under it; the change applies from that point on.
