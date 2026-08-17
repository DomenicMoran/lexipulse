# USER-TODO — LexiPulse

Stand: 2026-08-17. **Offen ist nichts mehr, was jemand tun müsste.**

---

## Zweite Runde: was noch dazugekommen ist

Nach der ersten Einreichung kamen die letzten offenen Punkte dazu:

- **Nachschlagen eines Wortes.** Stand vorher als „bewusst nicht" im Plan, weil
  die Datenschutzerklärung abschließend aufzählt, welche einzige Funktion einen
  Server anspricht. Gebaut ist es jetzt ohne diesen Widerspruch: eine
  Wortübersicht, die vollständig offline zeigt, wo das Wort im Dokument sonst
  vorkommt, plus eine Übergabe an eine App deiner Wahl. Die App selbst sendet
  nichts. Abschnitt 7 der Datenschutzerklärung sagt genau das.
- **FictionBook (.fb2)** wird gelesen, mit Titel, Autor, Kapiteln und Umschlag.
- **Markierungen als Markdown** ausgeben, nach Kapiteln geordnet.
- **Tagesziel in Wörtern**, sichtbar in der Statistik.
- **Web-Fassung nachgezogen**: Leselineal, Auto-Scroll, Blättern mit Seitenzahl
  und Schlagwörter. Damit ist sie auf dem Stand der App.
- **Feature-Grafik bei Play** nennt jetzt beide Leseweisen statt nur den
  Wortstrom.
- **Import-Bericht** erscheint in der Sprache der App statt auf Englisch.

---

## Was sich davor geändert hat

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
| **Google Play** | Produktion auf **versionCode 7**, Ladentext und 12 Bilder aktuell, am 17.08. eingereicht | Verwaltete Veröffentlichung ist aus: nach der Prüfung geht die App direkt live. Google nennt in der Regel bis zu 7 Tage |
| **Apple App Store** | Version 1.0 mit **Build 8**, neuen Texten und 24 Bildern, am 17.08. eingereicht | Freigabemodus **AFTER_APPROVAL**: Apple genehmigt, die App geht ohne weiteren Klick live |

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

## Was bewusst offen bleibt

1. **MOBI und AZW3** bleiben draußen. Was Amazon heute ausliefert, ist KFX mit
   DRM; das zu öffnen wäre eine Umgehung technischer Schutzmaßnahmen. Bliebe
   eine Handvoll alter DRM-freier Dateien, und „MOBI wird unterstützt" zu
   behaupten, obwohl es bei den meisten echten Dateien fehlschlägt, wäre
   schlechter als es zu lassen.
2. **Cloud-Sync und Konto** bleiben draußen. Beides widerspricht der Zusage
   „nichts verlässt das Gerät", die in der Datenschutzerklärung, den
   Store-Texten und im Über-Bereich der App steht. Das wäre kein Feature mehr,
   sondern ein anderes Produkt mit Servern, Konten und neuen Rechtstexten.
3. **Der iOS-Pfad des Nachschlagens ist ungetestet.** Die Übergabe läuft dort
   über das Teilen-Blatt; ohne Mac ließ sich das hier nicht am Gerät prüfen.
   Der Android-Pfad ist geprüft, auch der Fall ohne passende App.

---

## Kontakt

Überall `lexipulse@menucloud-berlin.de`, ein Alias auf `info@menucloud-berlin.de`
mit Sieve-Sortierung nach `Projekte/LexiPulse`.

Signaturmaterial liegt unter `C:\Users\domen\Documents\mc-build\lexipulse-ios\`
und `...\lexipulse-android\`; `apps/mobile/credentials.json` zeigt darauf und ist
per `.gitignore` ausgeschlossen.
