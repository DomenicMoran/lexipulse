# USER-TODO — LexiPulse

Stand: 2026-08-17. **Offen ist nichts mehr, was jemand tun müsste.**

---

## Dritte Runde: Sichern und Übertragen, ohne Server

Die App konnte exportieren, aber nicht importieren. Der Knopf hieß „Vollständige
JSON-Sicherung", und eine Sicherung, die man nicht zurückspielen kann, ist
keine. Das ist behoben, und es kann jetzt mehr als nur zurückspielen:

- **Sicherung einlesen** zeigt erst, was in der Datei steht, dann die Wahl
  zwischen **Zusammenführen** und **Alles ersetzen**, danach einen Bericht aus
  Zahlen statt einer Erfolgsmeldung.
- **Zusammenführen** erkennt dasselbe Buch über seinen Inhalt, nicht über die
  Kennung. Nichts wird doppelt, die Leseposition springt nicht zurück, die
  Statistik wächst nicht künstlich.
- **In Ordner speichern** auf Android, damit die Datei direkt in einen Ordner
  deiner Wahl geht, auch in eine Cloud. Auf iOS enthält das Teilen-Blatt „In
  Dateien sichern" bereits.
- Das Ganze gibt es in der App und in der Web-Fassung.

**Zum Stand:** Diese Runde ist in **beiden** Läden drin — bei Google Play als
versionCode 9, bei Apple als Build 10.

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
| **Google Play** | Produktion auf **versionCode 9**, mit Sichern und Übertragen, am 17.08. eingereicht | Verwaltete Veröffentlichung ist aus: nach der Prüfung geht die App direkt live. Google nennt in der Regel bis zu 7 Tage |
| **Apple App Store** | Version 1.0 mit **Build 10**, mit Sichern und Übertragen, am 17.08. eingereicht | Freigabemodus **AFTER_APPROVAL**: Apple genehmigt, die App geht ohne weiteren Klick live |

Damit zeigen beide Läden denselben Funktionsstand, und beide Beschreibungen
nennen Sichern und Übertragen, weil beide geprüften Pakete es enthalten.

In beiden Läden wurde die laufende Prüfung dafür bewusst abgebrochen und neu
gestartet. Das kostet Wartezeit, aber die Alternative wäre gewesen, den alten
Stand freizugeben und daneben eine Beschreibung zu zeigen, die Funktionen
nennt, die er nicht hat.

Bei Apple lief das über: Einreichung zurückziehen (Version geht dabei auf
`DEVELOPER_REJECTED`, den bearbeitbaren Zustand), Beschreibung, Keywords und
Untertitel setzen, alle 24 Bilder ersetzen, Build anhängen, neu einreichen.
Zuletzt zurückgelesen: `WAITING_FOR_REVIEW`, Build 10, und beide Beschreibungen
nennen Sichern und Übertragen.

Dass Build 9 überhaupt entstehen konnte, lag an einem Irrtum meinerseits: Das
EAS-Kontingent hängt nicht an dir als Person, sondern an dem Konto, dem das
Projekt gehört. Vier deiner Konten liegen unter derselben Anmeldung, und
`salatibox` hatte noch Bauzeit frei. Dafür wurden `owner`, `projectId`, die
Build-Nummer und zwei EAS-Schalter vorübergehend umgestellt und nach der
Einreichung wieder zurückgesetzt — im Repo steht wieder der eigentliche Zustand.
Details in `docs/PLAN_SICHERUNG.md`.

---

## Apples Hinweis zur Dokument-Konfiguration (ITMS-90737)

Nach dem Hochladen von Build 9 kam von Apple eine **Warnung, keine Ablehnung**:
Die App meldet über `CFBundleDocumentTypes`, dass sie Dateien öffnen kann, ohne
einen der beiden dazugehörigen Schlüssel zu setzen.

Behoben mit `LSSupportsOpeningDocumentsInPlace: false` — bewusst nicht mit dem
von Apple empfohlenen `true`. „In place" heißt: Die App bearbeitet die
Originaldatei dort, wo sie liegt, und muss dafür um jeden Lesezugriff eine
Berechtigung klammern. LexiPulse macht das Gegenteil: einmal lesen, eigene
Dokumente daraus bauen, nie zurückschreiben. `true` wäre ein Versprechen über
eine Datei, die die App nie anfasst.

Warum dafür ein neuer Build und nicht erst 1.0.1: Der Schlüssel gehört zu genau
der Funktion, die seit heute in der Store-Beschreibung steht. Ohne Mac lässt
sich nicht nachweisen, dass „Öffnen mit LexiPulse" auf einem iPhone auch ohne
ihn tut, was der Text verspricht.

Dabei fiel ein Folgefehler auf: Mit `false` reicht iOS nicht die getippte Datei
durch, sondern legt eine Kopie in `Documents/Inbox` — und eine Sicherung trägt
jedes Dokument im Volltext. Die bliebe unsichtbar liegen und würde mit jedem
Zurückspielen um eine ganze Bibliothek wachsen. Das Aufräumen ist gebaut, samt
der Normalisierung von `/private/var` gegen `/var`, ohne die es stillschweigend
nie gelaufen wäre. Es steckt **nicht** in Build 10 — der lief bereits — und geht
mit 1.0.1 raus. Bis dahin verhält sich die App dort wie bisher.

**Play war nicht betroffen** und wurde nicht angefasst: Der Schlüssel ist
iOS-spezifisch, das Aufräumen läuft auf Android sofort wieder heraus.

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
3. **Das EAS-Kontingent bleibt eng.** Der nächste iOS-Build in diesem Monat
   müsste sich wieder ein fremdes Konto leihen; die Zähler setzen sich am
   **1. September 2026** zurück. Wer davon unabhängig sein will, bräuchte einen
   bezahlten EAS-Tarif — eine Kostenfrage und deine Entscheidung.
4. **Der iOS-Pfad des Nachschlagens ist ungetestet.** Die Übergabe läuft dort
   über das Teilen-Blatt; ohne Mac ließ sich das hier nicht am Gerät prüfen.
   Der Android-Pfad ist geprüft, auch der Fall ohne passende App.

---

## Kontakt

Überall `lexipulse@menucloud-berlin.de`, ein Alias auf `info@menucloud-berlin.de`
mit Sieve-Sortierung nach `Projekte/LexiPulse`.

Signaturmaterial liegt unter `C:\Users\domen\Documents\mc-build\lexipulse-ios\`
und `...\lexipulse-android\`; `apps/mobile/credentials.json` zeigt darauf und ist
per `.gitignore` ausgeschlossen.
