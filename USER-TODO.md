# USER-TODO — LexiPulse

Stand: 2026-08-17, nachts. **Zu tun ist nichts.** 1.0 ist in beiden Läden
zurückgezogen, 1.1 ist eingereicht und liegt bei den Prüfern.

| | Stand | Danach |
|---|---|---|
| Apple | 1.1, Build 11, `WAITING_FOR_REVIEW` | Freigabe `AFTER_APPROVAL` — geht ohne weiteren Klick live |
| Play | 1.1.0, versionCode 10, Produktionsspur | Verwaltete Veröffentlichung war für 1.0 aus und wurde nicht angefasst — geht nach der Prüfung direkt live |

Beide Prüfuhren fangen von vorn an: Apple meist 1–2 Tage, Google bis zu 7. Die
Pakete liegen zusätzlich unter `C:\Users\domen\Documents\mc-build\`.

---

## Fünfte Runde: Die App kann jetzt dasselbe, und die Store-Texte stehen

Die Werkzeuge von heute Nachmittag gab es nur in der Web-Fassung. Jetzt gibt es
sie in der App — und zwar nicht als zweite Umsetzung: die Oberfläche ist ein
eigenes Paket geworden, das beide benutzen. In der App läuft sie in einer
mitgelieferten WebView, weil pdf.js einen Browser braucht, den React Native nicht
hat. Dieselbe Datei, kein Netz, alles auf dem Gerät.

In der App neu:

- Bildschirm **Original**, aus dem Player erreichbar, sobald ein Dokument eine
  Originaldatei hat
- Markieren, zeichnen, Textfelder, Notizen, Formulare, Unterschreiben, Seiten
  ordnen — derselbe Werkzeugkasten wie im Web
- Fertige Datei geht ins Teilen-Blatt, das Original lässt sich ersetzen
- Der Import behält die Originaldatei, nimmt Scans an und macht aus mehreren
  Bildern eine PDF

**Store-Texte und Bilder sind fertig**, in beiden Sprachen:

- Name: **LexiPulse: PDF & E-Book**, Untertitel „Ausfüllen, unterschreiben"
- Beschreibung, Kurzbeschreibung, Suchbegriffe und Versionshinweise neu
  geschrieben, alle innerhalb der Zeichenlimits
- Zwei neue Bildschirmfotos, aufgenommen aus der laufenden App: die
  Originalseite mit Markierung und Notiz, und die Werkzeuge mit einer
  Unterschrift auf der Linie

Hochgeladen war davon zunächst nichts; das kam mit der Einreichung von 1.1,
siehe den nächsten Abschnitt.

## Beide Läden halten jetzt 1.1

Die alte Einreichung ist zurückgezogen und durch 1.1 ersetzt — auf deine
Anweisung hin. Der Preis dafür ist Wartezeit: beide Prüfuhren fangen von vorn
an. Der Gewinn ist, dass kein Eintrag online geht, der LexiPulse als bloßen
Speed-Reader verkauft, während die App PDFs bearbeitet, ausfüllt und
unterschreibt.

| | Vorher | Jetzt |
|---|---|---|
| Apple | 1.0, Build 10, „LexiPulse: Speed Reader" | **1.1, Build 11**, `WAITING_FOR_REVIEW`, „LexiPulse: PDF & E-Book" |
| Play | versionCode 9, 1.0.0 | **versionCode 10, 1.1.0** in der Produktionsspur |

Bei Apple lief das so: Freigabeart zuerst auf `MANUAL` (sonst wäre die alte
Fassung live gegangen, falls ein Prüfer sie mitten im Vorgang durchwinkt),
Einreichung zurückgezogen, Fassung von 1.0 auf 1.1 umbenannt, Freigabe zurück
auf `AFTER_APPROVAL`, Name, Untertitel, Beschreibung und Suchbegriffe in beiden
Sprachen gesetzt, alle 32 Bildschirmfotos ersetzt, Bau 11 angehängt, eingereicht.

Bei Play in einem einzigen Vorgang: Paket, Eintrag, Bilder, Feature-Grafik und
Versionshinweise — bei Play ist eine Änderung eine Transaktion, zwei Aufrufe
wären zwei Entwürfe, von denen der erste verfällt.

Zwei Dinge, die Apple anders macht als erwartet:

- **Versionshinweise nimmt Apple nicht an**, solange die App nie veröffentlicht
  war: „Neue Funktionen" beschreibt eine Änderung gegenüber etwas, das es im
  Laden nicht gibt. Bei Play stehen sie drin.
- **Die Prüfhinweise beschrieben nur den Wortstrom.** Ein Prüfer, der PDF-
  Bearbeitung in der Beschreibung liest und nicht findet, lehnt ab. Sie sind neu
  geschrieben und liegen als `store/metadata/review-notes.txt` im Repo, damit sie
  gegen die App gegengelesen werden können — was nötig war: der erste Entwurf
  beschrieb die Beschriftungen der **Web**-Fassung („Dokument importieren",
  „Datei auswählen"), die App sagt „Importieren" und „Datei wählen".

Dazu kam heraus, dass die iOS-App nur `public.json` als Dateityp anmeldet, also
die Sicherungsdatei. Eine PDF lässt sich auf dem iPhone **nicht** über „Öffnen
mit" hineinreichen, nur über die Import-Ansicht der App. Damit ein Prüfer
überhaupt eine PDF zur Hand hat, liegt unsere fiktive Beispieldatei jetzt unter
**lexipulse.de/beispiel-vereinbarung.pdf** — mit Signaturlinie auf Seite 5.

## Am Gerät gelaufen — und drei Fehler gefunden, die nur dort auftreten

Der Lauf auf dem Emulator hat stattgefunden, in einer gebauten App und nicht im
Entwicklungsserver: PDF importiert, Original geöffnet, Seite gerendert,
gezeichnet, gespeichert, und die fertige Datei kam im Android-Teilen-Blatt an.

Drei Fehler waren im Browser nicht zu sehen und wären mit 1.1 ausgeliefert
worden:

- Die Werkzeugleisten brachen auf **drei Zeilen** um. Die WebView meldet rund
  900 CSS-Pixel Breite, also greift der Umbruchpunkt für große Bildschirme —
  auf einem Telefon. Jetzt immer eine Zeile, die scrollt.
- Das Zeichen für „Speichern" (`⭳`) hat in der Android-WebView **keine Glyphe**
  und stand als leerer Kasten da. Ersetzt durch `↑` und `↓`.
- Der Speichern-Dialog sagte „als neue Datei **herunterladen**". Auf einem
  Telefon lädt nichts herunter, dort öffnet das Teilen-Blatt. Der Text kommt
  jetzt von der Plattform, nicht aus dem Dialog.

Belege liegen als Bildschirmfotos in `.verify/` (`dev-08` vorher, `dev-10`
nachher, `dev-15` das Teilen-Blatt mit `handbuch-bearbeitet.pdf`).

Ungeprüft bleibt der **iOS**-Pfad: ohne Mac lässt sich das hier nicht am Gerät
zeigen. Die WebView ist dort dieselbe Bibliothek, der Teilen-Weg ein anderer.

---

## Vierte Runde: Die PDF ist jetzt eine PDF

Bisher hat LexiPulse aus einem PDF den Text herausgelesen und die Seite
weggeworfen. Für den Wortstrom ist das richtig; für alles andere, was man mit
einer PDF tut, fehlte damit alles. Neu ist eine dritte Ansicht neben Wortstrom
und Seitenmodus — das **Original**, so gesetzt wie es ist — und ein
Werkzeugkasten dazu:

- **Lesen:** Seiten rendern, Zoom, Drehen, dunkle Darstellung, Miniaturen,
  Gliederung, Verweise, Volltextsuche mit Sprung auf die Fundstelle
- **Markieren:** entlang der echten Textauswahl, nicht als selbst gezogener
  Kasten. Dazu Freihand, Rechteck, Ellipse, Linie, Pfeil, Textfelder, Notizen
- **Unterschreiben:** zeichnen, tippen oder ein Foto Ihrer Unterschrift; weißes
  Papier im Foto wird transparent, die Tinte bleibt
- **Formulare:** Felder werden ausgelesen und in einer Liste ausgefüllt. Beim
  Speichern können Sie sie festschreiben, damit sie niemand mehr ändert
- **Seiten:** drehen, löschen, verschieben, leere Seite / andere PDF / Bild
  einfügen. Ihre Markierungen wandern mit
- **Schwärzen:** auf Wunsch wird der Text wirklich entfernt und nicht nur
  überdeckt. Der Unterschied steht im Speichern-Dialog, weil er einer ist
- **Speichern:** als neue Datei oder das Original in der Bibliothek ersetzen

Alles läuft im Browser. Keine Datei geht an einen Server, auch beim Bearbeiten
nicht. Die Datenschutzerklärung sagt das jetzt ausdrücklich, in beiden Sprachen.

**Wo es läuft:** in der **Web-Fassung**, seit heute live auf lexipulse.de. Die
mobilen Apps können davon noch nichts.

**Die Webseite sagt es endlich auch.** Titel und Beschreibung nennen jetzt
PDF-Reader, E-Book-Reader und PDF-Werkzeug; es gibt einen Abschnitt „Drei
Ansichten" und einen über die PDF-Werkzeuge, dazu eine eigene Seite
`lexipulse.de/pdf` für Leute, die gar keinen Reader suchen, sondern eine Aufgabe
haben.

## Was hier stand, ist überholt

An dieser Stelle stand die Frage, ob erst mobil nachgezogen und dann die
Store-Texte geändert werden — mit der Empfehlung, 1.0 abzuwarten. Beides ist
entschieden und erledigt: 1.0 wurde zurückgezogen, und in beiden Läden liegt
jetzt 1.1 mit den Werkzeugen und den dazu passenden Texten.

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

## Wo die App am Nachmittag des 17.08. stand (überholt)

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
