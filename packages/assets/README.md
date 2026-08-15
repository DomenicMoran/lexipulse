# @lexipulse/assets

Every icon, splash, social card and store screenshot LexiPulse ships is generated from
code in this package. Nothing is drawn by hand, nothing is exported from a design tool,
and no asset is checked in without a script that can recreate it byte for byte.

```bash
pnpm --filter @lexipulse/assets generate      # icons, splash, OG image, vector logos
pnpm --filter @lexipulse/assets screenshots   # store screenshots + Play feature graphic
pnpm --filter @lexipulse/assets typecheck
```

`screenshots` needs a browser once:

```bash
cd packages/assets && pnpm exec playwright install chromium
```

---

## The mark

A monospace `L` with the ORP block sitting in its crook and the two focus rails
bracketing it above and below. That is the product drawn literally: the player shows one
word, marks its pivot character, and pins a fixed column with those rails.

It is built from SVG paths in a 100 x 100 design space (`src/brand.ts`), never from a
glyph. An icon that depended on JetBrains Mono being installed would render as a
fallback `L` on any machine that does not have it — including CI.

Colours come from `@lexipulse/ui` tokens (`THEMES.oled`, `ACCENTS.coral`). They are never
re-declared here.

| Function | Purpose |
| --- | --- |
| `appIconSvg(size, opts)` | Square icon. `safeArea` scales the mark, `radius` rounds the plate, `border` adds the hairline edge, `simple` switches to the reduced construction. |
| `logoSvg(opts)` | Horizontal lockup, `variant: 'dark' \| 'light'`, optional wordmark. |
| `wordmarkSvg(opts)` | Wordmark alone, pivot character in the accent colour. |
| `faviconSvg(size)` | Reduced construction: no rails, fatter strokes, larger block. |
| `splashSvg(w, h, opts)` | Centred mark for the launch screen. |
| `ogImageSvg(title, sub)` | 1200 x 630 social card built around the RSVP stage. |
| `markRadius(simple)` | Distance from the mark's centre to its farthest painted point — the input to every masked-icon safe area. |
| `safeAreaForCircle(d)` | Largest `safeArea` that still fits inside a circle of diameter `d`. |

All of them are pure: numbers in, SVG string out, no file system.

### Why the reduced construction exists

At 16 px the full mark's rails are 0.7 px wide and turn into grey smudge. `faviconSvg`
therefore drops the rails, widens the stem and enlarges the ORP block — the shape is
redrawn for the size, not scaled down to it.

---

## What `generate` writes, and which rule each file answers to

### `apps/web/public/`

| File | Size | Requirement |
| --- | --- | --- |
| `favicon.svg` | scalable | Modern browsers prefer the SVG icon; ships the reduced construction. |
| `favicon.ico` | 16 / 32 / 48 | The bare `/favicon.ico` probe, Windows pinned sites, feed readers. PNG-compressed entries (legal since Vista). |
| `icons/icon-192.png` | 192² | Web app manifest `purpose="any"`, minimum size Chrome accepts for install. |
| `icons/icon-512.png` | 512² | Manifest `purpose="any"`, also the source for the generated splash. |
| `icons/icon-maskable-192.png` | 192² | Manifest `purpose="maskable"`. |
| `icons/icon-maskable-512.png` | 512² | Manifest `purpose="maskable"`. |
| `icons/apple-touch-icon.png` | 180² | iOS home screen. Opaque and square — iOS applies its own mask and shows transparency as black. |
| `og-image.png` | 1200 x 630 | Open Graph / `twitter:card=summary_large_image`, 1.91:1. |

The manifest itself belongs to the web app; this package only produces the files.

### `apps/mobile/assets/`

| File | Size | Requirement |
| --- | --- | --- |
| `icon.png` | 1024² | `expo.icon`. **No alpha channel** — App Store Connect rejects an icon that has one. Written through `sharp.flatten()`. |
| `adaptive-icon.png` | 1024² | `android.adaptiveIcon.foregroundImage`. |
| `adaptive-icon-monochrome.png` | 1024² | `android.adaptiveIcon.monochromeImage`, the Android 13 themed icon. Single colour; the system tints it. |
| `splash-icon.png` | 1024² | `expo-splash-screen` `image`. |
| `notification-icon.png` | 96² | Android notification small icon, 24 dp at xxxhdpi. White on transparent — Android discards colour and keeps only the alpha channel. |
| `favicon.png` | 48² | `expo.web.favicon`. |

### `packages/assets/out/`

`logo-dark.svg`, `logo-light.svg`, `logo-mark.svg`, `wordmark.svg`.

`dark` / `light` names the background the logo is *for*, not the ink. All four are
transparent. The wordmark files carry live text in JetBrains Mono — convert to outlines
before handing them to a printer or an agency. `logo-mark.svg` is path-only and safe
anywhere.

`out/` is ignored repo-wide (see the root `.gitignore`); re-run `generate` to recreate it.

---

## Safe areas, solved rather than guessed

Masked icons get cropped by the launcher, and the crop shape is not ours to choose.
Instead of eyeballing a margin, `markRadius()` walks the mark's real vertices and returns
the distance from its centre to the farthest painted point. `safeAreaForCircle(d)` then
solves for the largest scale that still fits a circle of diameter `d`.

| Target | Guaranteed circle | Scale used | Measured worst-case radius |
| --- | --- | --- | --- |
| Maskable PWA icon | 80 % of the edge | 0.791 of 0.930 allowed | 33.7 % of the edge |
| Android adaptive layers | 66 dp of 108 dp (61 %) | 0.639 of 0.710 allowed | 27.3 % of the edge |

The bounding box's half-diagonal is deliberately *not* the yardstick. The mark is tall and
narrow, its box corners are empty, and using them would shrink every masked icon by about
10 % for nothing.

Verify a build by finding the farthest non-background pixel:

```bash
node -e "const s=require('sharp');(async()=>{const{data,info}=await s('../../apps/web/public/icons/icon-maskable-512.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});let m=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels;if(data[i+3]>24&&(data[i]>24||data[i+1]>24||data[i+2]>24)){const d=Math.hypot(x-info.width/2,y-info.height/2);if(d>m)m=d}}console.log((m/info.width*100).toFixed(1)+'% of edge, limit 40%')})()"
```

---

## Splash screen: the Expo convention, checked

`expo-splash-screen` takes a **square 1024 x 1024 PNG with a transparent background** and
scales it to `imageWidth` dp (default 100, this app uses 180) on a solid colour. It does
not take a phone-sized canvas — a 1284 x 2778 image would be scaled down to a smear.
Confirmed against the plugin source (`getIosSplashConfig.js` / `getAndroidSplashConfig.js`,
`imageWidth: root.imageWidth ?? 100`) and the Expo docs, not from memory.

---

## Fonts

JetBrains Mono and Inter are vendored under `fonts/` (both SIL OFL, licences included).
They are needed twice, in two different ways:

- **sharp** rasterises SVG through libvips/Pango, which only sees fonts fontconfig knows
  about. `src/fonts.ts` writes a `fonts.conf` pointing at `fonts/` and exports
  `FONTCONFIG_PATH`. Measured, not assumed: setting `process.env.FONTCONFIG_PATH` and
  *then* importing sharp does **not** work — fontconfig reads the real process environment
  when the native library initialises. `bootstrapFonts()` therefore re-executes the script
  once with the variable already in place (`process.execArgv` carries the tsx loader flags,
  so the child is the same interpreter). Without this the OG image silently falls back to
  Consolas.
- **Chromium** gets the web faces inlined as base64 `@font-face`, so the screenshots never
  depend on a network or on the host's font list.

---

## Store screenshots

```
store/screenshots/
├── ios-6.9/            6 screens, 1290 x 2796
├── ios-6.5/            6 screens, 1242 x 2688
├── android-phone/      6 screens, 1080 x 1920
├── play-feature-graphic.png   1024 x 500
└── en/                 the same tree, English
```

| Slot | Rule |
| --- | --- |
| iPhone 6.9" — 1290 x 2796 | Required App Store slot; every other iPhone size is derived from it. |
| iPhone 6.5" — 1242 x 2688 | Legacy slot, still required for older device families. |
| iPad 13" — 2064 x 2752 | Generated **only** when the mobile config declares `ios.supportsTablet`. Apple reviews iPad shots against an iPad build; a stretched phone layout is a rejection. |
| Android phone — 1080 x 1920 | Play Store phone screenshots, minimum 2, maximum 8. |
| Feature graphic — 1024 x 500 | Play Store, mandatory. Cropped on some surfaces, so the lockup stays inside the middle 78 %. |

The layout is one idea repeated: solid background, one big headline, one explaining
sentence, one device. No collage, no badges, no gradient mesh.

### Where the content in the device comes from

1. **Preferred** — the web app's dev server at `http://localhost:3210` (override with
   `LEXIPULSE_DEV_URL`). A route is captured **only when the page marks itself** with
   `data-lexipulse-screen="<screen id>"` on the screen root. A 200 proves nothing: with no
   document imported, `/reader` renders the import empty state, and that under the headline
   *„Ein Wort. Immer an derselben Stelle."* is a listing promising something the picture
   does not show. Adding the attribute in the web app is all it takes to switch a screen to
   live capture; `LEXIPULSE_CAPTURE_LIVE=1` skips the check once the running app has been
   seeded by hand.
2. **Fallback** — the HTML screens in `src/templates/screens.ts`, built from the same
   design tokens and the same `computeStageGeometry` / `computeOrp` as the player. The
   rails sit on the pivot column because the geometry module says so, not because they
   were nudged there.

The capture hides Next.js dev overlays, freezes animations, and sets the browser locale to
match the screenshot locale, so the German and English sets never share one capture.

The run prints which path each file took, and re-reads every written PNG with
`sharp().metadata()` — the resolution in the report is measured, never intended.

### Copy rules

German is the primary language, English lives under `en/`. No Lorem Ipsum. No invented
claims about the product: no star ratings, no download counts, no "best reader" — § 5 UWG
treats that as misleading advertising. Numbers inside the device (reading progress, weekly
words) belong to the fictional reader whose screen is shown, and the books are public
domain.

---

## Adding a format

1. Add an entry to `TARGETS` in `src/store-screenshots.ts` with the exact pixel size and a
   `scale` that divides it into whole CSS pixels.
2. If it is a new device shape, add it to `DEVICE` in `src/templates/page.ts` (aspect,
   width fraction, app logical width, corner radius).

Everything else — headline sizing, device geometry, the app zoom factor — is derived.
