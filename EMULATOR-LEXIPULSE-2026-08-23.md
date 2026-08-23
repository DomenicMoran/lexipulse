# Emulator-Durchgang LexiPulse — 2026-08-23

Geräte: `lexipulse_phone` (Pixel 7, 1080×2400 @420dpi) und `lexipulse_klein`
(360×640 @160dpi, kurzer Bildschirm), beide selbst angelegt für diese Sitzung.
Screenshots liegen unter `.verify/emulator-2026-08-23/` (gitignored).

**Umgebungsbefund vorab:** Expo Dev-Client (`npx expo start`) ist auf diesem
mehrfach parallel genutzten Rechner wiederholt unter Speicherdruck abgestürzt
(„Failed to start watch mode" beim Aufbau der Haste-Map über das ganze
Monorepo). Metro selbst funktioniert; nur der dauerhafte Server-Prozess war
instabil. Ausweg: `debuggableVariants = []` lokal in `android/app/build.gradle`
gesetzt (gitignoriert, nicht committet) und die Release-Variante mit dem
lokalen Debug-Keystore statt der echten Produktions-Signatur gebaut (die
Produktionsschlüssel-Datei liegt korrekterweise nicht auf diesem Rechner). So
läuft die App standalone, ganz ohne Metro — für den Rest der Sitzung stabil.

## Bildschirme (Telefon, 1080×2400)

| Bildschirm | Befund | Screenshot |
|---|---|---|
| Bibliothek (leer) | Sauber, „Noch nichts importiert", Import-Button | `phone-10-release-launch.png` |
| Import-Bildschirm | Datei/Zwischenablage/Web-Artikel, keine Überlappung | `phone-11-import.png` |
| Web-Artikel importieren | Wikipedia-Artikel „Schnelllesen" importiert, 1.656 Wörter, 2 Abschnitte | `phone-15-imported.png`, `phone-17.png` |
| RSVP-Player (Artikel) | ORP-Fixierung korrekt, Wischen/Tempo funktionieren | `phone-20-library2.png` |
| Bibliothek (Artikel) | Karte mit Label „Artikel", Fortschritt, Restzeit | `phone-23-library3.png` |
| EPUB importieren | Datei-Picker → Downloads → Import erfolgreich, 64 Wörter | `phone-42-epub-imported.png` |
| RSVP-Player (EPUB) | ORP-Fixierung, sauberer Text | `phone-44-rsvp-epub.png` |
| Einstellungen — Tempo | Slider 100–1200 WPM (Extremwerte gemessen, siehe unten) | `phone-45-settings.png`, `phone-46-wpm-max.png`, `phone-48-wpm-min.png` |
| Einstellungen — Darstellung/Lesemodus | 4 Schriften (Serif/Sans/System/Dyslexie), Schriftgröße/Zeilenabstand/Rand-Slider sauber | `phone-49-scroll1.png` |
| Einstellungen — Lesehilfen/Farbfilter | „Keine" + 6 Filter (Creme/Pfirsich/Rosé/Mint/Himmel/Flieder) | `phone-51-filters.png` |
| PDF importieren | „Vereinbarung Blaupause", 353 Wörter, Smart-Filter: 5 Abschnitte, 18 Kopf/Fußzeilen entfernt, 5 Seitenzahlen entfernt | `phone-54-pdf-report.png` |
| PDF — Original (pdf.js) | Zoom, Seiten 1/5, Navigation, Volltextsuche vorhanden | `phone-56-original2.png` |
| PDF — Original Seite 5 | Unterschriftszeile sichtbar, Navigation per Seitenzahl-Eingabe | `phone-59-page5c.png` |
| PDF — Bearbeiten-Werkzeuge | Toolbar aktiviert: Auswahl/Markieren/Unterstreichen/Durchstreichen/Freihand/Rechteck/Ellipse/Linie/Pfeil/Text/Notiz/Unterschrift/Bild/Schwärzen, 10-Farben-Palette für Notizen | `phone-65-tools-scroll2.png` |
| Statistik | 26-Wochen-Heatmap live, echte Zahlen (193 Wörter, 40 s, Ø 290 WPM, Serie 1 Tag) | `phone-68-stats.png` |
| Einstellungen — Über/Website | Version 1.1.0, „lexipulse.de"-Link öffnet Custom Tab zu lexipulse.de | `phone-69-about.png`, `phone-72-website3.png` |
| Bibliothek (alle 3 Dokumente) | PDF/EPUB/Artikel sauber gelabelt, Autor „Musterwerk GmbH" aus PDF-Metadaten | `phone-74-back.png` |
| Offline (Flugmodus) | Bibliothek, PDF-Seitenansicht ohne Netz fehlerfrei; `svc wifi/data disable` + `ping` → „Network is unreachable" als Beleg | `phone-75-offline-lib.png`, `phone-77-offline-pdf2.png` |

## Bildschirme (kurzer Bildschirm, 360×640)

| Bildschirm | Befund | Screenshot |
|---|---|---|
| Bibliothek (leer) | Kein Überlauf, Tab-Leiste passt | `klein-01-library.png` |
| Import-Bildschirm | Sauber, keine Überlappung | `klein-02-import.png` |
| Onboarding-Dialog „So steuerst du den Player" | Vollständig sichtbar, kein Abschneiden (kritischer Fall laut Lehre zu kurzen Bildschirmen) | `klein-06-imported.png` |
| Import-Bericht-Dialog | Vollständig sichtbar | `klein-08-player2.png` |
| RSVP-Player | Titelleiste mit 5 Icons ohne Overlap, Transport-Leiste über Tab-Leiste, ORP sauber | `klein-09-player3.png` |
| Einstellungen — Tempo | Slider und Voreinstellungen ohne Überlauf | `klein-10-settings.png` |

## Anrede-Kontrolle (Ergebnis: sauber)

Die Umstellung auf „du" betraf laut `git show --stat b3c37eb` 24 Dateien in
`apps/web/src` und `packages/pdf/src` (plus den Ladentext) — die mobile App
selbst nutzte an keiner Stelle „Sie" (0 Treffer in `apps/mobile/src/i18n/*`
außer einem False-Positive: „Sie stehen unter freien Lizenzen" bezieht sich
auf die Schriften, nicht auf die Leserin). AGB, Datenschutz und Impressum
bleiben vollständig förmlich (0 „du"-Treffer, alle „Sie"). Auf der Landing-
Page ebenfalls nur ein False-Positive („Dokumente … Sie verlassen das Gerät
nicht"). Kein gemischter Bildschirm gefunden, kein zerbrochener Satz.

## Nachgemessene Zahlen gegen Ladentext

| Zahl | Ladentext | Live gemessen | Ergebnis |
|---|---|---|---|
| Lesetempo | 100–1200 WPM | Slider-Minimum 100, Maximum ~1200 (Endanschlag) | ✅ stimmt |
| Schriften (Lesemodus) | „Vier Schriften, darunter OpenDyslexic" | Serif, Sans, System, Dyslexie = 4 | ✅ stimmt |
| Farbfilter | „Sechs Farbfilter" | Creme, Pfirsich, Rosé, Mint, Himmel, Flieder = 6 (+ „Keine") | ✅ stimmt |
| Markierfarben | „fünf Farben" | Gelb, Grün, Blau, Pink, Violett = 5 (i18n + `HIGHLIGHT_COLORS`, aus Settings-Bildschirm mitgezählt statt live per Long-Press bestätigt, siehe „Offen") | ✅ stimmt (Quelle direkt verifiziert) |
| Statistik-Übersicht | Ladentext nennt keine Wochenzahl | **Web-App: 12 Wochen. Mobile App: 26 Wochen** (live im Statistik-Bildschirm: „Die letzten 26 Wochen") | ℹ️ kein Fehler — beide Werte sind je Plattform vorsätzlich unterschiedlich (Kommentar im Code: „Six months is what fits a phone width"); der Auftrag nahm „12 Wochen" für beide Plattformen an, das gilt nur für die Web-App |

## Web-Artikel-Import — Datenschutz-Befund (wichtigster Fund dieser Sitzung)

Der Import eines Web-Artikels lief live erfolgreich (Wikipedia-Artikel, siehe
oben). Ein Netzwerk-Mitschnitt über einen eigenen Logging-Proxy (System-Proxy
per `adb shell settings put global http_proxy`) zeigte keine Verbindung — das
belegt, dass die App den System-Proxy **nicht** nutzt und stattdessen direkt
verbindet (bestätigt durch Quelltext, siehe unten). Ein Host-seitiger Mitschnitt
der QEMU-Netzwerkverbindung (`Get-NetTCPConnection` auf die aufgelöste IP der
Zielseite) war für den ursprünglich gewählten Testfall zeitlich zu knapp
getroffen.

**Der entscheidende Beleg kommt aus dem Quelltext, exakt nachvollzogen:**
`apps/mobile/src/lib/import.ts` → `importFromUrl()` ruft
`fetchArticle(url, fetch)` mit dem **nativen Geräte-`fetch`** auf — es gibt in
der mobilen App keinen Aufruf von `/api/extract`. Dieser Endpunkt existiert
nur in `apps/web`. Das bedeutet: Bei den mobilen Apps geht **der gesamte
Artikeltext**, nicht nur das Vorschaubild, direkt vom Gerät an die fremde
Seite — der Betreiber sieht dabei die Geräte-IP, genau wie bei jedem
gewöhnlichen Webseitenaufruf.

**Das stand so nicht in den Texten.** `store/legal/datenschutz.de.md` Abschnitt 5
beschrieb ausschließlich den Weg der Web-App über `/api/extract` und nannte nur
das Vorschaubild als Ausnahme vom Server-Weg. Die interne Ausfüllhilfe
`store/metadata/app-privacy.md` behauptete sogar wörtlich „Der URL-Import ruft
`/api/extract` auf dem eigenen Server auf" als plattformübergreifende Tatsache
— das ist für die App schlicht falsch, weil sie diesen Endpunkt nie aufruft.
Die Apple-Begründung in derselben Datei stützte sich auf genau diese falsche
Prämisse.

**Behoben:** `store/legal/datenschutz.de.md`, `store/legal/privacy.en.md` und
`store/metadata/app-privacy.md` beschreiben jetzt beide Wege getrennt (Web-App
über `/api/extract`, mobile Apps als Geräte-Direktabruf) und benennen, dass bei
mobilen Apps der ganze Artikeltext, nicht nur das Bild, den fremden Betreiber
erreicht. Ein `USER-TODO.md`-Eintrag bittet darum, die daraus resultierende
Apple-Einschätzung („No, we do not collect data") vor der nächsten
Einreichung gegenzulesen — das ist eine Rechtsfrage, die ich nicht einseitig
abschließend beantworten kann.

## Offline-Verhalten (Flugmodus)

`svc wifi disable` + `svc data disable`, per `ping 8.8.8.8` → „Network is
unreachable" bestätigt (echter Netzverlust, kein Fake). Bibliothek und
PDF-Seitenansicht liefen fehlerfrei weiter. `adb logcat` gefiltert auf
`FATAL|AndroidRuntime|de.lexipulse|ReactNativeJS` über die gesamte
Offline-Phase: **keine Treffer** — kein Absturz, keine Warnung.

## Nicht abschließend verifiziert (ehrlich offen)

- **Unterschrift zeichnen/speichern:** Die Bearbeiten-Werkzeugleiste wurde
  erreicht und alle Werkzeuge (inkl. Unterschrift-Icon) sind sichtbar/aktiv;
  eine tatsächlich gezeichnete und gespeicherte Unterschrift wurde wegen
  instabiler Pixel-Koordinaten in der WebView-Toolbar (verschiebt sich beim
  Umschalten von Zeilen) in dieser Sitzung nicht mehr geschafft — Zeitbudget
  war zu diesem Zeitpunkt aufgebraucht.
- **Markierfarben live per Long-Press:** Die 5 Farben sind aus den
  Einstellungen/Quelltext bestätigt, aber nicht durch einen Long-Press auf ein
  Wort im laufenden Wortstrom mit sichtbarem Farbmenü nachgestellt.
- **Rechtsseiten im Custom Tab:** Der „Website"-Link öffnet nachweislich
  `lexipulse.de` (Code + Custom-Tab-Start bestätigt), blieb aber wegen Chromes
  Ersteinrichtungsbildschirm auf dem frischen Emulator-Image im
  Konto-Auswahl-Screen hängen. Die Zielseiten selbst wurden separat per
  echtem HTTP-Abruf verifiziert (siehe Live-Nachweis).
