# LexiPulse — Umsetzungsplan

Stand: 2026-08-16. Abgehakt ist nur, was mit einem Beleg verifiziert wurde.

## Produkt

**LexiPulse — Ultimate RSVP & Document Reader.**
EPUB/PDF/Web-Artikel importieren, per RSVP mit ORP-Fixierung lesen. Offline-first, kein
Konto, keine Cloud.

- Web: **https://lexipulse.de** — live, kostenlos
- Store-Preis: **4,99 € einmalig**, kein Abo, keine Werbung
- Repo: https://github.com/DomenicMoran/lexipulse

## Accounts (verifiziert)

| Dienst | Konto | Beleg |
|---|---|---|
| GitHub | `DomenicMoran/lexipulse` | Push + CI grün |
| Vercel | `domenicmos-projects` / `prj_xkeizdRdseopIECdkLBc5Ft7xNk5` | Deployment READY |
| DNS | INWX (BitDojo-Konto), A → 216.198.79.1 / 64.29.17.1 | `misconfigured: false` |
| Expo/EAS | `@menucloudberlin/lexipulse` / `5aebaf91-…` | Build FINISHED, APK |

## Architektur

```
apps/web/       Next.js 15 App Router, Tailwind v4, Framer Motion, PWA
apps/mobile/    Expo SDK 57, expo-router, expo-sqlite
packages/core/  RSVP-Engine, Parser, Storage — plattformfrei, 218 Tests
packages/ui/    Design-Tokens, Player-Geometrie, React-Komponenten — 80 Tests
packages/assets/ Icons, Logos, Splash, Store-Screenshots (programmatisch)
store/          Rechtstexte, ASO-Metadaten, 38 Store-Screenshots
docs/API.md     Interne API-Referenz
```

## Status

### P0 — Fundament ✅
- [x] Monorepo pnpm + Turborepo, tsconfig.base, prettier, .gitattributes (LF)
- [x] `@lexipulse/core`: ORP, Pacing-Matrix, Tokenizer, Engine, Settings, Storage
- [x] Parser: EPUB 2+3, PDF mit Smart-Filter, Web-Artikel, TXT/Markdown
- [x] Satz-Rekonstruktion für TTS (`sentenceText`, `joinTokens`)
- [x] **218 Tests** inkl. End-to-End-Durchlauf EPUB → Tokens → Engine → Store

### P1 — Design-System ✅
- [x] 4 Themes × 3 Akzente, eigener Akzentsatz für helle Themes
- [x] **Jede Textfarbe in jedem Theme ≥ 4,5:1** gegen Fläche und Hintergrund,
      abgesichert durch 67 Kontrasttests statt nach Augenmaß
- [x] `RsvpStage` mit ORP-Fixierung per `translateX(…ch)`
- [x] 18 Komponenten, Player-Geometrie plattformneutral

### P2 — Web-App + Landingpage ✅
- [x] Landing: Hero mit laufender Live-Demo der echten Engine, Bento-Grid, Preise, FAQ
- [x] Reader: Import (Datei/URL/Text), Player, Einstellungsmatrix, Bibliothek, Statistik
- [x] IndexedDB-Driver, PWA mit Service Worker, Offline-Seite
- [x] `/api/extract` mit SSRF-Schutz, Rate-Limit, **ohne URL-Logging**
- [x] JSON-Export und -Import (Art. 20 DSGVO), Round-Trip verifiziert
- [x] Impressum, Datenschutz, AGB aus `store/legal/`
- [x] **Live: LCP 400 ms, CLS 0,0005, 0 Konsolenfehler**

### P3 — Mobile-App ✅
- [x] Expo SDK 57, expo-router-Tabs, expo-sqlite-Driver
- [x] Player mit Gesten, TTS, Haptik, Keep-Awake
- [x] PDF-Import über pdf.js-WebView-Brücke, offline, unabhängig belegt
- [x] Manifest fragt nur INTERNET und VIBRATE ab
- [x] `expo-doctor` 21/21, Export beide Plattformen, APK auf Emulator gelaufen
- [x] **Kein OTA** — würde die Datenschutzaussage brechen

### P4 — Assets ✅
- [x] Icon, Logo, Favicon, Splash, OG-Bild programmatisch aus den Tokens
- [x] Maskable-Beschnitt an den echten Pixeln gemessen (33,7 % bei 40 % erlaubt)
- [x] 38 Store-Screenshots DE+EN, 5 von 6 Screens aus der **echten laufenden App**

### P5 — DevOps & Store ✅
- [x] GitHub Actions: typecheck/lint/test, Web-Build, Expo-Export — **grün**
- [x] EAS-Build-Workflow (nur auf Tag oder manuell)
- [x] Vercel-Deployment automatisch bei Push auf main
- [x] EAS-Build Android preview: **FINISHED**, APK-Artefakt
- [x] Store-Metadaten DE/EN, Zeichenlimits nachgemessen
- [x] App-Privacy-Antworten für Apple und Google

### P6 — Offen
- [ ] TTS mit echten Stimmen auf einem Desktop-Browser und einem echten Gerät prüfen
      (Playwright-Chromium liefert keine Stimmen, Emulator keinen Ton)
- [ ] iOS: nur Export und Typecheck geprüft, kein Simulator-Lauf (kein Mac)
- [ ] Store-Einträge anlegen — siehe `USER-TODO.md`

## Legal-Check

- **DSGVO:** Dokumente werden nur lokal verarbeitet. `/api/extract` loggt die URL nicht —
  im Code verankert und kommentiert. Art. 20 über JSON-Export erfüllt.
- **TDDDG § 25 Abs. 2:** kein Tracking, keine nicht-notwendigen Cookies → kein Banner.
- **EU AI Act Art. 50:** der Smart-Filter ist Heuristik, kein KI-System → keine
  Offenlegungspflicht. Bei einer späteren LLM-Zusammenfassung wäre sie nötig.
- **UWG § 5:** keine Nutzerzahlen, keine Bewertungen, keine unbelegten
  Geschwindigkeitsversprechen. Die Feature-Grafik sagt, was die App *tut*, nicht was der
  Nutzer dadurch *erreicht*.
- **§ 5 TMG:** Impressum mit echten Betreiberdaten aus MenuCloud.
