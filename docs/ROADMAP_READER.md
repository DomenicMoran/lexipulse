# Der vollständige Plan: LexiPulse als Reader

Stand: 2026-08-17 (zweite Runde). Grundlage ist `MARKTANALYSE_2026-08-16.md`.
Status: **fertig** · **in Arbeit** · **offen** · **bewusst nicht**

Die Reihenfolge folgt Abhängigkeiten, nicht Wunschdenken. Jede Stufe wird am
Gerät geprüft, bevor die nächste beginnt.

---

## Stufe 1 — Es muss ein Reader sein

| # | Funktion | Status |
|---|---|---|
| 1.1 | Seitenmodus über das ganze Dokument, nicht nur ein Kapitel | **fertig** |
| 1.2 | Eine Position für RSVP und Seite, in beide Richtungen | **fertig** |
| 1.3 | Position folgt dem Scrollen und wird gespeichert | **fertig** |
| 1.4 | Schriftgröße, Zeilenabstand, Ränder, Blocksatz | **fertig** |
| 1.5 | Schriftwahl: Serif, Sans, System, OpenDyslexic | **fertig** |
| 1.6 | Wort antippen springt in den Wortstrom | **fertig** |

## Stufe 2 — Was man von einem Reader erwartet

| # | Funktion | Status |
|---|---|---|
| 2.1 | Volltextsuche mit Trefferliste und Sprung | **fertig** |
| 2.2 | Umlauttolerante Suche („fur" findet „für") | **fertig** |
| 2.3 | Markierungen in fünf Farben | **fertig** |
| 2.4 | Notiz an einer Markierung | **fertig** |
| 2.5 | Liste aller Markierungen, Sprung dorthin | **fertig** |
| 2.6 | Markierungen im Export enthalten | **fertig** |
| 2.7 | Auto-Scroll mit Geschwindigkeit | **fertig** |
| 2.8 | Blättern mit Seitenzahlen | **fertig** |
| 2.9 | FictionBook (.fb2) importieren | **fertig** |
| 2.10 | Markierungen als Markdown ausgeben | **fertig** |
| 2.11 | Tagesziel in Wörtern | **fertig** |
| 2.12 | Sicherung erstellen und wieder einlesen | **fertig** |
| 2.13 | Zwei Geräte zusammenführen, ohne Server | **fertig** |

## Stufe 3 — Der Unterschied zum Rest des Marktes

Hier liegt die Marktlücke: RSVP **und** Lesehilfen gibt es sonst nirgends
zusammen.

| # | Funktion | Status |
|---|---|---|
| 3.1 | Bionic-Hervorhebung, Stärke einstellbar | **fertig** |
| 3.2 | Farbfilter über der Seite (6 Töne, plus „keiner") | **fertig** |
| 3.3 | Leselineal, das der Zeile folgt | **fertig** |
| 3.4 | OpenDyslexic als Schriftdatei einbetten | **fertig** |
| 3.5 | Geführte Hervorhebung im Fließtext (wie Outread) | **fertig** |

## Stufe 4 — Bibliothek und Nachschlagen

| # | Funktion | Status |
|---|---|---|
| 4.1 | Bibliothek durchsuchen | **fertig** |
| 4.2 | Sortieren: zuletzt, Titel, hinzugefügt, Fortschritt | **fertig** |
| 4.3 | Filtern: alle, angefangen, ungelesen, gelesen | **fertig** |
| 4.4 | Sammlungen und Tags | **fertig** |
| 4.5 | Nachschlagen eines Wortes | **fertig**, ohne eingebautes Wörterbuch |
| 4.6 | Übersetzung der Auswahl | **fertig** über die Übergabe ans Betriebssystem |

## Stufe 5 — Web-App auf gleichem Stand

| # | Funktion | Status |
|---|---|---|
| 5.1 | Seitenmodus über das ganze Dokument | **fertig** |
| 5.2 | Typografie, Bionic, Farbfilter | **fertig** |
| 5.3 | Suche | **fertig** |
| 5.4 | Markierungen | **fertig** |
| 5.5 | Leselineal, Auto-Scroll, Blättern, Schlagwörter | **fertig** |
| 5.6 | Sicherung einlesen mit Zusammenführen | **fertig** |

Die Web-Fassung ist damit auf dem Stand der App. Das Blättern löst sie über
CSS-Spalten statt über gemessene Zeilenkästen, weil der Browser den Umbruch
selbst beherrscht; die Seitenzahl ergibt sich aus `scrollWidth / clientWidth`.
Nicht nachgebaut ist das Nachschlagen: Die Übergabe an eine App der eigenen
Wahl ist eine Betriebssystem-Sache und hat im Browser keine Entsprechung, die
diesen Namen verdient.

---

## Bewusst nicht

Nicht aus Bequemlichkeit weggelassen, sondern weil es dem Produkt schadet:

- **Cloud-Sync über Dropbox oder Google Drive.** Widerspricht der Zusage „nichts
  verlässt das Gerät", die in der Datenschutzerklärung, den Store-Texten und im
  Über-Bereich der App steht. Ließe sich nur mit neuen Rechtstexten und einer
  neuen Datenschutz-Erklärung im Store einführen.
- **Konto und Geräte-Sync über unsere Server.** Dasselbe, plus: Die App hat
  bewusst keine Anmeldung. Der Abgleich zwischen zwei Geräten läuft stattdessen
  über eine Datei, die der Nutzer selbst bewegt; siehe `PLAN_SICHERUNG.md`.
- **CBZ/CBR (Comics).** RSVP ergibt bei Bildern keinen Sinn.
- **Plugin-System wie KOReader.** Ein Wartungsversprechen, das eine App mit einem
  Entwickler nicht halten kann.
- **Ein eingebautes Wörterbuch.** Ein Nachschlagewerk offline mitzuliefern
  scheitert an Größe und Lizenz, und eines online abzufragen würde die Zusage
  brechen, dass die App selbst nichts sendet. Gebaut ist stattdessen die
  Wortübersicht (offline, aus dem Dokument selbst) plus eine ausdrückliche
  Übergabe an eine App der eigenen Wahl. Abschnitt 7 der Datenschutzerklärung
  sagt das, und der Eintrag in der App sagt es auch.
- **MOBI und AZW3.** Was Amazon heute ausliefert, ist KFX mit DRM; das zu
  öffnen wäre eine Umgehung technischer Schutzmaßnahmen. Bliebe die Handvoll
  alter DRM-freier Dateien, und „MOBI wird unterstützt“ zu behaupten, obwohl es
  bei den meisten echten Dateien fehlschlägt, wäre schlechter als es zu lassen.

## Was zuletzt entschieden wird

**Blättern mit Seitenzahlen** (2.8) war als aufwendigster Punkt zurückgestellt,
weil React Native keinen Seitenumbruch kennt. Der Weg dorthin hat sich beim Bau
des Leselineals ergeben: `onTextLayout` liefert die tatsächlich gerenderten
Zeilenkästen, das Layout muss also nicht nachgebaut, sondern nur ausgelesen
werden. Seitenumbrüche entstehen daraus durch gieriges Füllen der Fensterhöhe
und werden bei jeder Änderung von Schriftgröße, Zeilenabstand oder Rand
automatisch neu bestimmt, weil `onTextLayout` dann ohnehin erneut feuert.

Die Einstellung `readerPaged` samt Schalter existierte bereits, wurde aber
nirgends gelesen: der Schalter tat nichts. Ein sichtbares Versprechen ohne
Funktion ist schlechter als eine fehlende Funktion, deshalb wurde der Punkt
gebaut statt verschoben. Am Gerät nachgewiesen mit „Seite 8 von 16", drei
Tipps rechts führen auf 11, einer links zurück auf 10.

Blättern und Auto-Scroll schließen sich aus. Der Schalter heißt „Blättern statt
Scrollen"; beides gleichzeitig zöge dem Leser die Seite weg, während eine
Seitenzahl mitzählt.
