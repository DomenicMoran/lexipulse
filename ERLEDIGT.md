# ERLEDIGT — LexiPulse

Nur abgeschlossene Punkte. Offenes steht in [`USER-TODO.md`](./USER-TODO.md). Sortiert nach
Datum, neueste zuerst. Daten stammen aus der Git-Historie von `USER-TODO.md`.

## 2026-08-19

- **Adressregel korrigiert.** „Überall `lexipulse@menucloud-berlin.de`" war nur der Stand
  vom 16.08.2026 und wurde zurückgenommen. Gültig ist `DomenicMoran/marke/adressen.json`:
  `lexipulse@domenicmoran.de` — belegt in `store/legal/impressum.de.md:26`.

## 2026-08-17

- **1.1 in beiden Stores eingereicht** (Apple Build 11, Play versionCode 10). Die frühere
  Einreichung 1.0 wurde zurückgezogen, weil die App inzwischen PDF-Werkzeuge bietet und die
  alte Beschreibung („LexiPulse: Speed Reader") das nicht mehr abbildete. Bei Apple:
  Freigabeart zuerst auf `MANUAL`, Einreichung zurückgezogen, Fassung auf 1.1 umbenannt,
  Freigabe zurück auf `AFTER_APPROVAL`, Name/Untertitel/Beschreibung/Suchbegriffe in beiden
  Sprachen gesetzt, alle 32 Screenshots ersetzt, Build 11 angehängt. Bei Play in einem
  Vorgang: Paket, Eintrag, Bilder, Feature-Grafik, Versionshinweise.

- **PDF-Werkzeuge jetzt auch in der mobilen App, nicht mehr nur im Web.** Bildschirm
  „Original" aus dem Player erreichbar; Markieren, Zeichnen, Textfelder, Notizen, Formulare,
  Unterschreiben, Seiten ordnen — derselbe Werkzeugkasten wie im Web, als eigenes Paket, das
  beide Fassungen benutzen. Läuft in der App über eine mitgelieferte WebView (pdf.js braucht
  einen Browser), alles lokal ohne Netz.

- **Store-Texte und Bilder für 1.1 fertig, beide Sprachen.** Name „LexiPulse: PDF & E-Book",
  Untertitel „Ausfüllen, unterschreiben", Beschreibung/Kurzbeschreibung/Suchbegriffe/
  Versionshinweise neu geschrieben (innerhalb der Zeichenlimits), zwei neue Screenshots aus
  der laufenden App. Prüfhinweise neu geschrieben und als `store/metadata/review-notes.txt`
  im Repo abgelegt, weil der erste Entwurf die Beschriftungen der Web-Fassung nannte statt
  der App-Beschriftungen. Beispiel-PDF mit Signaturlinie unter
  `lexipulse.de/beispiel-vereinbarung.pdf` bereitgestellt, weil sich auf iOS keine PDF per
  „Öffnen mit" in die App reichen lässt (nur `public.json` als Dateityp angemeldet).

- **Drei App-Fehler am Emulator gefunden und behoben**, die im Browser nicht sichtbar waren
  und sonst mit 1.1 ausgeliefert worden wären: Werkzeugleiste brach in der WebView (~900px
  Breite) auf drei Zeilen um, jetzt eine scrollende Zeile. Speichern-Symbol `⭳` hatte keine
  Glyphe in der Android-WebView (leerer Kasten), ersetzt durch `↑`/`↓`. Speichern-Dialog
  sagte fälschlich „als neue Datei herunterladen" statt das Teilen-Blatt zu erwähnen — Text
  kommt jetzt von der Plattform. Belege als Screenshots in `.verify/` (`dev-08` vorher,
  `dev-10` nachher, `dev-15` Teilen-Blatt). iOS-Pfad blieb ungeprüft (kein Mac verfügbar).

- **Sichern & Übertragen (Import) nachgerüstet.** Die App konnte vorher nur exportieren
  („Vollständige JSON-Sicherung"), jetzt auch einlesen: Vorschau der Datei, Wahl zwischen
  Zusammenführen und Alles ersetzen, danach Bericht aus Zahlen statt Erfolgsmeldung.
  Zusammenführen erkennt dasselbe Buch über den Inhalt, nicht über die Kennung — keine
  Duplikate, keine zurückspringende Leseposition. „In Ordner speichern" auf Android; auf iOS
  bereits über „In Dateien sichern" im Teilen-Blatt. In beiden Stores ausgeliefert: Play als
  versionCode 9, Apple als Build 10.

- **ITMS-90737-Warnung von Apple behoben.** `CFBundleDocumentTypes` fehlte einer der beiden
  Pflichtschlüssel. Behoben mit `LSSupportsOpeningDocumentsInPlace: false` (bewusst nicht
  `true`, da LexiPulse Originaldateien liest, aber nie zurückschreibt). Dabei Folgefehler
  gefunden und behoben: Bei `false` legt iOS beim Öffnen eine Kopie in `Documents/Inbox` an,
  die sonst unsichtbar geblieben und mit jeder Sicherung im Volltext mitgewachsen wäre —
  Aufräumen inkl. Normalisierung von `/private/var` gegen `/var` gebaut. Ging mit 1.0.1 raus
  (nicht in Build 10, der bereits lief). Play war nicht betroffen (iOS-spezifischer
  Schlüssel).

- **Zweite Runde: Wort-Nachschlagen, FictionBook, Markdown-Export, Tagesziel.** Offline-
  Wortnachschlagen (zeigt sonstige Vorkommen im Dokument, Übergabe an eine App der Wahl, die
  App selbst sendet nichts — Abschnitt 7 der Datenschutzerklärung deckt das jetzt ab).
  FictionBook (`.fb2`) wird gelesen (Titel, Autor, Kapitel, Umschlag). Markierungen als
  Markdown-Export, nach Kapiteln geordnet. Tagesziel in Wörtern in der Statistik. Web-Fassung
  auf App-Stand gezogen (Leselineal, Auto-Scroll, Blättern mit Seitenzahl, Schlagwörter).
  Feature-Grafik bei Play nennt beide Leseweisen. Import-Bericht erscheint in der Sprache der
  App statt auf Englisch.

- **Erste Einreichung in beiden Stores.** Play (versionCode 9, Sichern & Übertragen, 17.08.
  eingereicht) und Apple (Version 1.0, Build 10, gleicher Funktionsstand, 17.08. eingereicht).
  Bei Apple lief die laufende Prüfung bewusst zurückgezogen und neu gestartet, damit
  Beschreibung und Paket zueinander passen: Einreichung zurückgezogen (→
  `DEVELOPER_REJECTED`, bearbeitbar), Beschreibung/Keywords/Untertitel gesetzt, alle 24
  Bilder ersetzt, Build angehängt, neu eingereicht. Zuletzt zurückgelesen:
  `WAITING_FOR_REVIEW`, Build 10. Build 9 war zwischenzeitlich über ein geliehenes
  Expo-Konto (`salatibox`, gleiche Anmeldung, freie Bauzeit) entstanden — `owner`,
  `projectId`, Build-Nummer und zwei EAS-Schalter wurden danach zurückgesetzt (Details:
  `docs/PLAN_SICHERUNG.md`).

## 2026-08-16 und davor

- **Aus dem RSVP-Reader wurde ein vollständiger Reader.** Seitenmodus über das ganze
  Dokument mit vier mitgelieferten Schriften, freier Typografie, Blättern samt Seitenzahl,
  Auto-Scroll, Volltextsuche, Markierungen in fünf Farben mit Notizen, Lesehilfen (Bionic,
  Leselineal, sechs Farbfilter), Schlagwörter in der Bibliothek. Leseposition ist in beiden
  Modi (Wortstrom/Seitenmodus) dieselbe. Store-Texte (Beschreibung, Untertitel, Keywords,
  Versionshinweise, alle Bilder) entsprechend nachgezogen.

- **Zahlungsvoraussetzungen erledigt.** Apple: Vertrag für gebührenpflichtige Apps aktiv
  (15.08.2026–15.04.2027), Bankkonto aktiv, W-8BEN und Certificate of Foreign Status aktiv.
  Google Play: Zahlungsprofil eingerichtet, Händlerkonto steht.

- **Preise gesetzt.** 4,99 € inklusive Mehrwertsteuer für Deutschland in beiden Stores. Bei
  Play als Netto-Basispreis 4,19 € eingetragen (ergibt mit 19 % genau 4,99 €). Gültig für
  172 Länder/Regionen bei Play, alle Länder bei Apple.

- **Funktionsprüfung am Emulator bestanden**, in der Fassung, die eingereicht wird (nicht
  nur aus dem Quelltext geschlossen): vier Leseschriften laden korrekt (OpenDyslexic
  eingeschlossen, Umlaute stimmen), Bionic-Hervorhebung sichtbar auch mit eingebetteten
  Schriften, Leselineal folgt der Leseposition, Blättern korrekt („Seite 8 von 16" etc.),
  Auto-Scroll schaltet beim Blättern ab, Volltextsuche findet „Träume" bei Eingabe von
  „traumen", Markierungen/Notizen/Liste/Sprung funktionieren, Schlagwörter filtern/suchen/
  bearbeiten ohne Waisen nach dem Löschen, Lesefortschritt landet in der Bibliothek auch
  ohne Wiedergabe, Import von Markdown/Text/Web-Artikel funktioniert (Wikipedia-Artikel
  beginnt beim ersten echten Satz), Schriftlizenzen und Impressum live gegengelesen.
