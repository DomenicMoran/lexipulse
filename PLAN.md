# LexiPulse — Umsetzungsplan

Stand: 2026-08-16. Diese Datei ist der verbindliche Arbeitsplan. Abgehakt wird nur, was
mit einem Beleg (Kommando-Output, HTTP-Response, Screenshot) verifiziert wurde.

## Produkt

**LexiPulse — Ultimate RSVP & Document Reader.**
EPUB/PDF/Web-Artikel importieren, per RSVP (Rapid Serial Visual Presentation) mit
ORP-Fixierung lesen. Offline-first, kein Konto nötig, keine Cloud.

- Domain: `lexipulse.de` (erworben)
- Store-Preis: **4,99 € einmalig** (iOS + Android), kein Abo
- Web-App: kostenlos, PWA, Open Source
- Rechtstexte (Impressum/Datenschutz): Betreiberdaten aus MenuCloud übernehmen

## Accounts / Credentials (verifiziert 2026-08-16)

| Dienst | Konto | Beleg |
|---|---|---|
| GitHub | `DomenicMoran` (aktiv) | `gh auth status` |
| Vercel | `domenicmos-projects` / `team_glutztTQtWq7Te7NQiJC8KbM` | `/v2/user` 200 |
| Expo/EAS | `menucloudberlin` (Owner) | `eas whoami` |
| Apple ASC | Keys in `Dartile/.env.local`, `NOURI/.env` | – |

## Architektur

```
LexiPulse/
├── apps/
│   ├── web/          Next.js 15 App Router, Tailwind v4, Framer Motion, PWA
│   └── mobile/       Expo SDK 57, React Native, expo-router
├── packages/
│   ├── core/         RSVP-Engine, Parser-Pipeline, Storage, Types  (plattformfrei)
│   ├── ui/           Design-Tokens + geteilte React-Komponenten
│   └── assets/       Programmatische SVG/PNG-Generierung (Icons, Splash, Store)
└── store/            ASO-Metadaten DE/EN, Screenshots, Release Notes
```

## Arbeitspakete

### P0 — Fundament (Lead) ✅
- [x] Monorepo: pnpm workspaces + Turborepo, tsconfig.base, prettier, .gitignore
- [x] `@lexipulse/core`: types, ORP, Pacing-Matrix, Tokenizer, Engine, Settings
- [x] `@lexipulse/core`: Parser (EPUB, PDF+Smart-Filter, HTML-Artikel, TXT/MD)
- [x] `@lexipulse/core`: Storage-Abstraktion (Driver + LexiStore + Stats)
- [x] Unit- und Integrationstests grün — **206 Tests, 11 Dateien**
- [x] `pnpm install` sauber, typecheck 0 Fehler, ESLint 0 Errors

### P1 — Design-System (Lead) ✅
- [x] `@lexipulse/ui`: Tokens (4 Themes × 3 Akzente), Typo-Skala, Spacing, Motion
- [x] Web-Komponenten: Button, IconButton, Card, Badge, Kbd, Divider, ProgressBar,
      Slider, Switch, SegmentedControl, Stepper, BentoGrid/Cell/Heading, StatTile
- [x] `RsvpStage`/`RsvpWord` mit ORP-Fixierung per `translateX(…ch)`, Fokuslinien
- [x] Player-Geometrie plattformneutral (`computeStageGeometry`, `pivotOffsetPx`) — 13 Tests

### P2 — Web-App + Landingpage (Agent WEB)
- [ ] Landing: Hero mit Live-RSVP-Demo, Bento-Feature-Grid, Pricing, FAQ, Footer
- [ ] Reader: Import (Datei/URL/Paste), Player, Settings-Matrix, Bibliothek, Statistik
- [ ] IndexedDB-Driver, PWA-Manifest + Service Worker, Offline
- [ ] `/api/extract` Route für URL-Import (CORS-Umgehung, SSRF-geschützt)
- [ ] Rechtsseiten: Impressum, Datenschutz, AGB — Daten aus MenuCloud
- [ ] Vercel-Deployment + Domain `lexipulse.de`

### P3 — Mobile-App (Agent MOBILE)
- [ ] Expo SDK 57, expo-router, Tabs: Bibliothek / Lesen / Statistik / Einstellungen
- [ ] expo-sqlite-Driver, expo-document-picker Import, PDF via WebView-Bridge
- [ ] RSVP-Player nativ (Reanimated, Gesten: Tap=Play, Swipe=Rewind/Kapitel)
- [ ] TTS-Sync (expo-speech), Sound-Feedback, Keep-Awake
- [ ] app.json/eas.json, Icon/Splash, IAP-Vorbereitung 4,99 €

### P4 — Assets (Agent ASSETS)
- [ ] App-Icon programmatisch: tiefschwarz, „L" mit neon-rotem ORP-Punkt
- [ ] Favicon-Set, Splash, OG-Image, Vektor-Logo (hell/dunkel)
- [ ] Store-Screenshots automatisiert (Playwright → 6 Frames iOS + Android)
- [ ] Feature-Grafik Play Store 1024×500

### P5 — DevOps & Store (Agent OPS)
- [ ] GitHub-Repo `DomenicMoran/lexipulse` + Push
- [ ] GitHub Actions: lint + typecheck + test auf PR, EAS-Build auf Tag
- [ ] EAS-Projekt anlegen, `eas build` Testlauf iOS+Android
- [ ] Store-Metadaten DE/EN: Titel, Untertitel, Keywords, Beschreibung, Release Notes
- [ ] Datenschutz-Angaben (App Privacy / Data Safety): „keine Datenerhebung"

### P6 — Verifikation (Lead)
- [ ] Unit-Tests grün, Coverage-Report
- [ ] EPUB- und PDF-Import mit echten Dateien getestet
- [ ] Web live: Lighthouse LCP < 2,5 s, CLS < 0,1, INP < 200 ms
- [ ] Browser-Durchlauf der kompletten Reader-Strecke (Screenshot-Beleg)
- [ ] EAS-Build-Artefakte vorhanden

## Infrastruktur (Lead) — erledigt

- [x] GitHub `DomenicMoran/lexipulse` angelegt und gepusht (Autor `Domenic Moran`)
- [x] `.gitattributes` mit `eol=lf`, `.gitignore` mit verankerten Expo-Pfaden
- [x] GitHub Actions: `ci.yml` (typecheck/lint/test, Web-Build, Expo-Export),
      `eas-build.yml` (nur auf Tag oder manuell — Build-Slots sind knapp)
- [x] Vercel-Projekt `lexipulse` (`prj_xkeizdRdseopIECdkLBc5Ft7xNk5`), Root `apps/web`,
      GitHub-verknüpft, Install `cd ../.. && pnpm install --frozen-lockfile`
- [x] DNS `lexipulse.de` bei INWX auf Vercel gezeigt, `misconfigured: false`

## Legal-Check (pro Feature)
- DSGVO: keine Server-Speicherung von Dokumenten; Import läuft lokal. `/api/extract`
  loggt keine URLs. Art. 20 → JSON-Export im Reader.
- TTDSG: keine Cookies außer technisch notwendig → kein Banner nötig, wenn kein Tracking.
- EU AI Act Art. 50: der Smart-Filter ist Heuristik, keine KI-Interaktion → keine
  Offenlegungspflicht. Falls später LLM-Zusammenfassung: Hinweis nötig.
- UWG § 5: keine erfundenen Nutzerzahlen, keine Fake-Rezensionen auf der Landingpage.
