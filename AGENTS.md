# Conventions for this repo

These apply to humans and agents alike. Every rule below is read off the code,
not invented. Change one and you change it in both places.

## The one rule that shapes everything

**`packages/core` has no platform.** No DOM, no React, no React Native, no Node
built-ins. The same engine and the same parsers run in the browser and on the
device; each platform supplies a storage driver (`storage/driver.ts`) and, for
PDF, a pdf.js loader. Nothing else.

The moment `window`, `document`, `AsyncStorage` or `node:fs` appears in
`packages/core`, the promise that web and mobile behave identically is gone, and
it is gone silently: the tests still pass, because they run under Node.

```
apps/web/         Next.js 15 App Router — landing page, reader, PWA
apps/mobile/      Expo SDK 57 — iOS and Android
packages/core/    RSVP engine, parsers, storage. Platform-free.
packages/ui/      Design tokens, player geometry, shared React components
packages/assets/  Icon, logo and store-screenshot generation
store/            Legal texts, ASO metadata, store screenshots
```

## Language

Identifiers, file names, comments and commit messages are **English**; the
product ships German and English, and the German strings live in the locale
files, not in the code. `PLAN.md` and `USER-TODO.md` are German because they are
addressed to one reader.

A comment explains **why** something is the way it is, not what the line says.

## The engine

Four decisions carry the whole reading experience. None of them is a preference.

**The pivot is arithmetic, not an approximation.** The highlighted character is
pinned with `translateX((focusColumn − orp)ch)` on a monospace face. If the
pivot drifts by even a fraction of a column, the eye has to re-acquire it on
every word, and the entire point of RSVP is gone.

**Indices are code points, never UTF-16 offsets.** An emoji or a combining mark
must not be split in half. `tokenizer.ts` and `orp.ts` both depend on this.

**The pacing factors compose, they do not replace each other.** A long word at a
sentence end gets both multipliers. Flat pacing gives a three-letter article the
same budget as a sentence boundary, which is exactly where comprehension
collapses.

| Condition | Multiplier |
| --- | --- |
| Word core longer than 8 characters | ×1.25 |
| Sentence end (`.` `!` `?` `…`) | ×1.75 |
| Clause end (`,` `;` `:` `—`) | ×1.75 |
| Paragraph end | ×2.0 |
| Contains digits | ×1.4 |
| Core of 3 characters or fewer | ×0.9 |

Abbreviations and ordinals are excluded from the sentence rule, so `z.B.` and
`1.` do not stall the stream. Adding a new rule means adding a test to
`pacing.test.ts` that shows both the new case and one it must not touch.

**The clock consumes an absolute timestamp, not frame deltas.** A dropped frame
must not be able to make the stream drift. Anything that reintroduces
`requestAnimationFrame` deltas into `engine.ts` is a regression, however small
it looks.

## The parsers

A PDF is a page description, not a text. `parsers/clean.ts` removes running
heads, footers, page numbers and table-of-contents dot leaders, rejoins words
split at a line break, and turns hard wraps back into paragraphs. All of this
happens **before** a single word reaches the player, because everything
downstream assumes clean input.

A new parser goes into `parsers/` behind the same interface and gets its own
test file. `parsers/shared.ts` holds what more than one of them needs.

## Privacy is a property of the architecture, not a promise in the text

Documents are parsed and stored on the device: IndexedDB in the browser, SQLite
on mobile. The only server call is the URL importer, which fetches the page
server-side purely to get around CORS; **the URL is not logged and not stored.**
Full data export as JSON is built in (Art. 20 GDPR).

Any feature that would send document content anywhere changes what the landing
page, the store listing and the privacy policy say. Those three change together
or not at all.

## Assets

Icons, logos, splash screens and store screenshots are generated
(`pnpm assets`), not hand-drawn and checked in as one-offs. `store-screenshots.ts`
prefers the running web app and falls back to the templates in
`templates/screens.ts`; it prints which path each file took. A store asset that
quietly drifts from the app is worse than no asset.

## Definition of done

```bash
pnpm typecheck   # 0 errors
pnpm lint
pnpm test        # 309 tests
pnpm build
```

Node 20.11+ and pnpm 10.

Two things a green run does not cover, and both are named in `USER-TODO.md`:
speech synthesis (Playwright's Chromium has no installed voices, the Android
emulator emits no sound) and the native iOS build (no Mac here). Neither is
claimed as verified anywhere until it has been heard or built.
