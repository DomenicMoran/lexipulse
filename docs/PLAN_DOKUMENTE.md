# LexiPulse als Dokumenten-Werkzeug

Stand: 2026-08-17. Grundlage: `MARKTANALYSE_2026-08-16.md`, `ROADMAP_READER.md`.
Status: **fertig** · **in Arbeit** · **offen**

---

## Befund

Drei Dinge stimmen heute nicht zusammen.

**1. Die App kann mehr, als sie sagt.** Seitenmodus über das ganze Dokument,
vier Leseschriften, freie Typografie, Blättern, Auto-Scroll, Volltextsuche,
Markierungen mit Notizen, Bionic, Leselineal, Farbfilter, Bibliothek mit
Schlagwörtern — alles gebaut, alles am Gerät nachgewiesen. Die **Store-Texte**
nennen es seit dem 17.08. Die **Landingpage** nicht: dort steht „RSVP-Reader für
EPUB, PDF und Web" und sonst nichts über das Lesen selbst. Wer die Seite liest,
hält LexiPulse für ein Spielzeug mit einem Trick.

**2. „PDF" bedeutet heute etwas anderes, als der Markt darunter versteht.**
LexiPulse liest aus einem PDF den *Text* heraus und wirft die Seite weg.
`apps/web/src/lib/pdf-loader.ts` sagt es wörtlich: „we only ever read text
content, never render a page". Das ist für den Wortstrom richtig und für einen
PDF-Viewer nichts. Kein Seitenbild, keine Abbildungen, keine Tabellen, keine
Formulare, keine Anmerkung im Original, keine Unterschrift, keine Ausgabe einer
PDF-Datei. Wer „PDF-Reader" sucht, sucht genau das.

**3. Ein Kaufargument fehlt.** Web ist kostenlos und kann dasselbe wie die App.
Was die App rechtfertigt, muss aus dem entstehen, was ein Browser-Tab nicht
kann: Dateien öffnen aus dem System, Teilen-Blatt, Offline ohne Tab, Vorlesen
mit Systemstimmen, Haptik. Das ist heute schon so und wird nirgends gesagt.

## Zielbild

LexiPulse ist ein **Dokumenten-Reader mit zwei Leseweisen und einem
PDF-Werkzeugkasten**. Der Wortstrom bleibt das Besondere, ist aber nicht mehr
die Identität, sondern das Argument.

Drei Oberflächen auf einem Dokument, eine Leseposition:

| Oberfläche | Was sie zeigt | Wofür |
|---|---|---|
| **Original** | die echte Seite, gerendert | PDF-Viewer, Formulare, Unterschrift, Abbildungen |
| **Seite** | Fließtext, eigene Typografie | lesen, stundenlang |
| **Wortstrom** | ein Wort an fester Stelle | schnell durch |

## Stufe 6 — Der PDF-Viewer

| # | Funktion | Status |
|---|---|---|
| 6.1 | Originalbytes werden gespeichert, nicht weggeworfen | **offen** |
| 6.2 | Seiten rendern (Canvas, Geräteauflösung, virtualisiert) | **offen** |
| 6.3 | Zoom: Breite, Seite, freie Stufen, Doppelseite | **offen** |
| 6.4 | Textebene: markieren, kopieren, suchen im Original | **offen** |
| 6.5 | Miniaturenleiste und Gliederung (Outline/Lesezeichen des PDF) | **offen** |
| 6.6 | Sprungziele und Links im Dokument | **offen** |
| 6.7 | Drehen, Nachtmodus (invertiert), Vollbild | **offen** |
| 6.8 | Seite ↔ Wortstrom: eine Position, in beide Richtungen | **offen** |
| 6.9 | Passwortgeschützte PDFs öffnen | **offen** |

## Stufe 7 — PDF bearbeiten

Alles im Gerät. Keine Datei geht an einen Server — das ist die Zusage, auf der
das Produkt steht, und sie gilt hier genauso.

| # | Funktion | Status |
|---|---|---|
| 7.1 | Markieren, Unterstreichen, Durchstreichen auf der Originalseite | **offen** |
| 7.2 | Freihand zeichnen, Stiftstärke und Farbe | **offen** |
| 7.3 | Textkasten setzen, Schriftgröße und Farbe | **offen** |
| 7.4 | Notizzettel (Kommentar) an einer Stelle | **offen** |
| 7.5 | Formen: Rechteck, Ellipse, Pfeil, Linie | **offen** |
| 7.6 | Übermalen (Whiteout) und echtes Schwärzen | **offen** |
| 7.7 | **Unterschreiben**: zeichnen, Bild einsetzen oder tippen, dann platzieren | **offen** |
| 7.8 | **Formulare ausfüllen**: Textfelder, Haken, Auswahl, danach festschreiben | **offen** |
| 7.9 | Seiten: drehen, löschen, verschieben, einfügen, herauslösen | **offen** |
| 7.10 | Dokumente zusammenführen und teilen | **offen** |
| 7.11 | Bilder zu einem PDF machen | **offen** |
| 7.12 | Dokumenteigenschaften bearbeiten | **offen** |
| 7.13 | Als PDF ausgeben — herunterladen, teilen, ersetzen | **offen** |

## Stufe 8 — Der Reader, wie er sein müsste

| # | Funktion | Status |
|---|---|---|
| 8.1 | EPUB im Originallayout: Abbildungen, Auszeichnung, Kapitel | **offen** |
| 8.2 | Texterkennung für gescannte PDFs, zuschaltbar, im Gerät | **offen** |
| 8.3 | Wörterbuch, offline, mitgeliefert | **offen** |
| 8.4 | Vorlesen im Seiten- und Originalmodus, nicht nur im Wortstrom | **offen** |

## Stufe 9 — Auftritt

| # | Funktion | Status |
|---|---|---|
| 9.1 | Landingpage: Reader und PDF-Werkzeug vorn, Wortstrom als Argument | **offen** |
| 9.2 | Eigene Seiten für die Werkzeuge, mit eigenen Suchbegriffen | **offen** |
| 9.3 | Store-Titel, Untertitel, Beschreibung, Suchbegriffe neu | **offen** |
| 9.4 | Neue Bildschirmfotos aus der laufenden App | **offen** |
| 9.5 | Rechtstexte nachziehen, wo sich etwas ändert | **offen** |

---

## Bewusst nicht

- **Serverseitige Umwandlung** (PDF → Word, Komprimierung mit Neuberechnung der
  Bilder in Serverqualität). Jeder dieser Dienste lädt die Datei hoch. Damit
  fiele die einzige Aussage, die dieses Produkt trägt.
- **Digitale Signatur mit Zertifikat** (PAdES, qualifiziert nach eIDAS). Eine
  gezeichnete Unterschrift ist ein Bild und wird auch so benannt. Eine
  qualifizierte Signatur braucht einen Vertrauensdiensteanbieter, also einen
  Server und eine Prüfung — und „unterschreiben" darf dann nicht mehr
  danebenstehen, als wäre es dasselbe.
- **Cloud-Sync und Konto.** Unverändert, siehe `ROADMAP_READER.md`.

## Reihenfolge, und warum die Store-Texte warten müssen

Beide Läden prüfen seit dem 17.08. eine Einreichung: Play versionCode 9, Apple
Build 10. Ein Eingriff in den Play-Eintrag bricht die laufende Prüfung ab, bei
Apple müsste die Einreichung erst zurückgezogen werden. Beides ist schon einmal
passiert und hat Tage gekostet.

Deshalb:

1. **Web zuerst.** Die Web-Fassung hängt an keiner Prüfung und geht mit jedem
   Push live. Dort entstehen Viewer und Werkzeuge, dort werden sie belegt.
2. **App zieht nach**, über denselben Kanal wie der heutige PDF-Import: eine
   mitgelieferte WebView, offline, ohne Netz. Eine Umsetzung, zwei Hosts.
3. **Store-Auftritt zuletzt**, zusammen mit dem Build, der die Funktionen
   wirklich enthält. Ein Eintrag, der etwas verspricht, das im geprüften Paket
   fehlt, ist ein Ablehnungsgrund und gegenüber Käufern falsch.

Die Landingpage ist davon ausgenommen und wird sofort auf das gezogen, was
heute schon stimmt: Seitenmodus, Lesehilfen, Suche, Markierungen, Bibliothek.
Das steht bereits in den geprüften Store-Texten, es fehlt nur auf der eigenen
Seite.

## Rechtliches

- **DSGVO:** Alles läuft im Gerät, auch Rendern und Bearbeiten. Die
  Datenschutzerklärung zählt abschließend auf, welche einzige Funktion einen
  Server anspricht (Web-Artikel per URL); daran ändert sich nichts.
- **UWG § 5:** „Unterschreiben" wird als *gezeichnete Unterschrift* beschrieben,
  nicht als qualifizierte elektronische Signatur. „Schwärzen" heißt schwärzen,
  wenn der Text wirklich entfernt wird, sonst heißt es übermalen.
- **EU AI Act Art. 50:** Texterkennung ist Mustererkennung ohne generatives
  Modell und ohne Interaktion mit einem Menschen; keine Offenlegungspflicht.
  Käme je eine Zusammenfassung durch ein Sprachmodell dazu, wäre sie nötig.
- **Lizenzen:** `pdf.js` (Apache-2.0) ist bereits im Einsatz, `pdf-lib` (MIT)
  kommt dazu. Beides erlaubt die Nutzung in einem verkauften Produkt; die
  Hinweise gehören zu den Schriftlizenzen in der App.
