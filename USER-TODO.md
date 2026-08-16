# USER-TODO — LexiPulse

Stand: 2026-08-17. **Offen ist nichts mehr, was jemand tun müsste.**

---

## Was sich seit gestern geändert hat

LexiPulse ist nicht mehr nur ein RSVP-Leser, sondern ein vollständiger Reader.
Dazu kam ein Seitenmodus über das ganze Dokument, mit vier mitgelieferten
Schriften, freier Typografie, Blättern samt Seitenzahl, Auto-Scroll,
Volltextsuche, Markierungen in fünf Farben mit Notizen, Lesehilfen (Bionic,
Leselineal, sechs Farbfilter) und Schlagwörtern in der Bibliothek. Die
Leseposition ist in beiden Modi dieselbe.

Weil die Store-Texte das jetzt versprechen, mussten Beschreibung, Untertitel,
Keywords, Versionshinweise und alle Bilder mit. Ein Eintrag, der etwas
verspricht, das im geprüften Paket nicht drin ist, wäre ein Ablehnungsgrund und
gegenüber Käufern schlicht falsch.

---

## Wo die App gerade steht

| Store | Stand | Was danach passiert |
|---|---|---|
| **Google Play** | Produktion auf **versionCode 6**, neuer Ladentext und 12 neue Bilder, am 17.08. eingereicht | Verwaltete Veröffentlichung ist aus: nach der Prüfung geht die App direkt live. Google nennt in der Regel bis zu 7 Tage |
| **Apple App Store** | Version 1.0 mit **Build 7**, neuen Texten und 24 neuen Bildern, am 17.08. eingereicht | Freigabemodus **AFTER_APPROVAL**: Apple genehmigt, die App geht ohne weiteren Klick live |

In beiden Läden wurde die laufende Prüfung dafür bewusst abgebrochen und neu
gestartet. Das kostet Wartezeit, aber die Alternative wäre gewesen, den alten
Stand freizugeben und daneben eine Beschreibung zu zeigen, die Funktionen
nennt, die er nicht hat.

Bei Apple lief das über: Einreichung zurückziehen (Version geht dabei auf
`DEVELOPER_REJECTED`, den bearbeitbaren Zustand), Beschreibung, Keywords und
Untertitel setzen, alle 24 Bilder ersetzen, Build 7 anhängen, neu einreichen.
Zurückgelesen: `WAITING_FOR_REVIEW`, Build 7, Bilder im Status `COMPLETE`.

---

## Preise

Beide Stores: **4,99 € inklusive Mehrwertsteuer** für Kundinnen und Kunden in
Deutschland, wie im Store-Text und auf der Website.

Bei Play ist der eingegebene Betrag der **Netto**-Basispreis; die
Endkundenpreise entstehen daraus mit der jeweiligen Landessteuer. Eingetragen
sind deshalb 4,19 € Basis, woraus mit 19 % genau 4,99 € werden.

Gültig für 172 Länder/Regionen bei Play und alle Länder bei Apple.

---

## Zahlungsvoraussetzungen — erledigt

**Apple:** Vertrag für gebührenpflichtige Apps aktiv (15.08.2026 – 15.04.2027),
Bankkonto aktiv, W-8BEN und Certificate of Foreign Status aktiv.

**Google Play:** Zahlungsprofil eingerichtet, Händlerkonto steht.

---

## Was am Gerät nachgewiesen ist

Alles Folgende wurde auf dem Emulator in der Fassung geprüft, die eingereicht
wird, nicht aus dem Quelltext geschlossen:

- Vier Leseschriften laden wirklich, OpenDyslexic eingeschlossen, Umlaute stimmen
- Bionic-Hervorhebung sichtbar fett, auch mit eingebetteten Schriften
- Leselineal folgt der Zeile, auf der die Leseposition steht
- Blättern: „Seite 8 von 16", drei Tipps rechts führen auf 11, einer links zurück auf 10
- Auto-Scroll bewegt den Text, und ist abgeschaltet, solange geblättert wird
- Suche findet „Träume" bei Eingabe von „traumen"
- Markierungen, Notizen, Liste und Sprung dorthin
- Schlagwörter: filtern, suchen, bearbeiten, und keine Waisen nach dem Löschen
- Lesefortschritt landet in der Bibliothek, auch ohne Wiedergabe
- Import von Markdown, Text und Web-Artikel; der Wikipedia-Artikel beginnt beim ersten echten Satz
- Schriftlizenzen in der App, Impressum-Nachweis live gegengelesen

---

## Zwei Kleinigkeiten, die bewusst offen sind

1. **Feature-Grafik bei Play** trägt weiter die Zeile „Ein Wort nach dem anderen.
   Immer an derselben Stelle." Das ist sachlich richtig, verkauft aber nur den
   Wortstrom. Sie neu zu erzeugen fasst denselben Generator an, der auch die
   App-Symbole schreibt, deshalb nicht nach dem fertigen Build. Kandidat fürs
   nächste Update.
2. **Wörterbuch und Übersetzung** sind bewusst nicht gebaut. Die
   Datenschutzerklärung zählt abschließend auf, welche einzige Funktion einen
   Server kontaktiert; eine Nachschlagefunktion würde diese Aussage falsch
   machen. Begründung steht in `docs/ROADMAP_READER.md`.

---

## Kontakt

Überall `lexipulse@menucloud-berlin.de`, ein Alias auf `info@menucloud-berlin.de`
mit Sieve-Sortierung nach `Projekte/LexiPulse`.

Signaturmaterial liegt unter `C:\Users\domen\Documents\mc-build\lexipulse-ios\`
und `...\lexipulse-android\`; `apps/mobile/credentials.json` zeigt darauf und ist
per `.gitignore` ausgeschlossen.
