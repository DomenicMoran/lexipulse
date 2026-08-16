# Marktanalyse und Funktionslücken

Stand: 2026-08-16. Grundlage für den Ausbau von LexiPulse zum vollwertigen Reader.

Verglichen wurde gegen die Apps, die in aktuellen Übersichten durchweg als Maßstab
genannt werden: **Moon+ Reader Pro** und **KOReader** (Vollausstattung bei
E-Book-Readern), **Spreeder**, **Outread** und **Reedy** (RSVP-Schnellleser),
**ClearRead** und **Helperbird** (Barrierefreiheit). Quellen am Ende.

---

## Was LexiPulse heute kann

Nachgeprüft am Gerät, nicht aus der Dokumentation abgeschrieben.

**Stark, teils besser als die Konkurrenz**

- RSVP mit ORP-Fixierung und dynamischer Pacing-Matrix (längere Wörter und
  Satzzeichen bekommen mehr Zeit). Reedy und Spreeder takten gleichförmiger.
- Warm-up-Rampe nach jedem Start.
- Import von EPUB, PDF mit Smart-Filter, Web-Artikeln, TXT, Markdown, HTML,
  Zwischenablage. Der Web-Import mit Chrome-Filterung ist besser als bei Reedy.
- Vorlesefunktion synchron zum Strom, mit Stimmwahl.
- Statistik mit Aktivitätsraster und Serie.
- Vollständig offline, kein Konto, JSON-Export nach Art. 20 DSGVO.
- Vier Themes, drei Akzentfarben, alle über 4,5:1 Kontrast geprüft.

**Vorhanden, aber nur halb**

- Fließtext-Ansicht: zeigt das aktuelle Kapitel in einem Sheet. Zum Wiederfinden
  gedacht, nicht zum Lesen.
- Kapitelliste, Lesezeichen mit Kontextvorschau.

---

## Was fehlt

Nach Wirkung sortiert, nicht nach Aufwand.

### A — Ohne das ist es kein Reader

| Funktion | Moon+ | KOReader | LexiPulse |
|---|---|---|---|
| Vollbild-Lesemodus über das ganze Buch | ja | ja | **nein** |
| Eigene Leseposition im Lesemodus | ja | ja | **nein** |
| Blättern statt Scrollen, mit Seitenzahlen | ja | ja | **nein** |
| Auto-Scroll mit Geschwindigkeit | 5 Modi | ja | **nein** |
| Zeilenabstand, Ränder, Blocksatz, Silbentrennung | ja | ja | **nein** |
| Helligkeit in der App | ja | ja | **nein** |
| Volltextsuche mit Trefferliste | ja | ja | **nein** |

### B — Erwartet man von einem ernsten Reader

| Funktion | Moon+ | KOReader | LexiPulse |
|---|---|---|---|
| Markierungen in mehreren Farben | ja | ja | **nein** |
| Notiz an einer Markierung | ja | ja | **nein** |
| Liste und Export aller Markierungen | ja | ja | **nein** |
| Wörterbuch beim Antippen eines Wortes | ja | ja | **nein** |
| Übersetzung der Auswahl | ja | ja | **nein** |
| Sammlungen, Tags, Sortierung, Filter | ja | ja | **nein** |
| Bildschirmausrichtung sperren | ja | ja | **nein** |

### C — Das Unterscheidungsmerkmal für diese Zielgruppe

Wer einen Schnellleser sucht, liest oft viel und ungern. Genau hier ist der Markt
dünn besetzt — Moon+ und KOReader haben davon nichts, die Barrierefreiheits-Apps
haben dafür kein RSVP.

| Funktion | Wer hat es | LexiPulse |
|---|---|---|
| OpenDyslexic-Schrift | ClearRead, Kindle | **nein** |
| Leselineal, das der Zeile folgt | ClearRead, Helperbird | **nein** |
| Farbüberlagerung (Irlen-Filter) | ClearRead | **nein** |
| Bionic Reading (Wortanfänge fett) | Outread, viele | **nein** |
| Geführte Hervorhebung im Fließtext | Outread | **nein** |

Punkt C ist die eigentliche Chance: RSVP **und** ein barrierefreier Lesemodus in
einer App gibt es am Markt praktisch nicht. Outread hat die geführte
Hervorhebung, aber keinen echten Reader; ClearRead hat die Barrierefreiheit, aber
kein RSVP.

### D — Nice to have, hoher Aufwand, geringe Wirkung

Weitere Formate (MOBI, AZW3, FB2, CBZ/CBR), Cloud-Sync über Dropbox/Google Drive,
OPDS-Kataloge, Calibre-Anbindung, Plugin-System. Sync widerspricht zudem der
Datenschutzzusage „nichts verlässt das Gerät" und müsste erst rechtlich neu
gefasst werden.

---

## Vorgehen

Reihenfolge nach Abhängigkeit: A trägt B und C.

1. **Lesemodus als Vollbild** über das ganze Dokument, mit eigener Position, die
   sich RSVP und Lesen teilen. Umschalter an derselben Stelle.
2. **Typografie**: Schriftgröße, Zeilenabstand, Ränder, Blocksatz, Schriftwahl
   inklusive OpenDyslexic.
3. **Blättern** mit Seitenzahlen als Alternative zum Scrollen, plus Auto-Scroll.
4. **Suche** über das ganze Dokument mit Trefferliste.
5. **Markierungen und Notizen** mit Farben, Liste und Export.
6. **Lesehilfen**: Leselineal, Farbüberlagerung, Bionic Reading.
7. **Bibliothek**: Sammlungen, Tags, Sortierung, Filter.
8. **Wörterbuch und Übersetzung** über die Systemdienste.

Punkt 1 bis 3 macht LexiPulse zu einem normalen Reader. 4 bis 6 zu einem guten.
7 und 8 zu einem vollständigen.

---

## Quellen

- [Comparison of Android e-reader software](https://grokipedia.com/page/comparison_of_android_e_reader_software)
- [Moon+ Reader Pro: The Complete Guide](https://geekchamp.com/moon-reader-pro-the-complete-guide/)
- [KOReader vs Moon Reader](https://www.bookrunch.org/comparison/koreader_vs_moon_reader/)
- [Best Speed Reading Apps 2026: RSVP, AI Audio](https://eist.app/blog/best-rsvp-speed-reading-apps-2026)
- [Best Apps for Speed Reading in 2026 – Outread](https://outreadapp.com/blog/best-speed-reading-apps)
- [ClearRead — Accessible eReader App](https://www.clearread.app/)
- [Kindle accessibility features](https://www.aboutamazon.com/news/books-and-authors/kindle-accessibility-features-for-all-readers)
