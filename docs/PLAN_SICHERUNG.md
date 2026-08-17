# Sichern, Übertragen, Zusammenführen — ohne Server

Stand: 2026-08-17, **umgesetzt und am Gerät belegt**. Ziel: Zwei Geräte nebeneinander benutzen und ein Gerät
wechseln können, ohne dass irgendwo ein Server steht.

---

## Warum das nicht schon geht

Die App kann **exportieren, aber nicht importieren**. `importAll` liegt fertig
und getestet in `packages/core`, aufgerufen wird es nur von der Web-Fassung. Der
Knopf heißt „Vollständige JSON-Sicherung", und eine Sicherung, die man nicht
zurückspielen kann, ist keine.

Dazu kommt: `importAll` ist ein **Wiederherstellen**, kein Zusammenführen.

| Was | Heutiges Verhalten | Folge bei zwei Geräten |
|---|---|---|
| Einstellungen | werden ersetzt | Schriftgröße des anderen Geräts gewinnt |
| Statistik | wird komplett überschrieben | gelesene Wörter des Zielgeräts verschwinden |
| Fortschritt | nach `documentId` überschrieben | Leseposition springt zurück |
| Dokumente | nach `id` überschrieben | Kennung trägt Zeitstempel und Zufall, dasselbe Buch wird **doppelt** |

Für „neues Handy, alles zurückholen" ist das genau richtig. Für „zwei Geräte,
die ich beide benutze" wäre es Datenverlust. Deshalb braucht es beides, als
bewusste Wahl des Nutzers.

---

## Die zwei Betriebsarten

**Zusammenführen** ist die Voreinstellung und die sichere Wahl. Nichts geht
verloren, im Zweifel gewinnt das Neuere.

**Alles ersetzen** ist für das frische Gerät und nach einem Zurücksetzen. Es
verwirft, was da ist, und stellt den Stand der Datei her. Es fragt vorher
ausdrücklich nach.

---

## Regeln für das Zusammenführen

Jede Regel folgt derselben Leitlinie: **nie mehr behaupten, als belegt ist.**

### Dokumente: Fingerabdruck statt Kennung

`createDocumentId` baut die Kennung aus Titel, Zeitstempel und Zufall. Dasselbe
Buch, auf zwei Geräten einzeln importiert, hat also zwei Kennungen. Ein
Zusammenführen über die Kennung würde jedes Buch verdoppeln.

Erkannt wird stattdessen über einen Fingerabdruck aus dem Inhalt: Wortzahl plus
Streuwert über den zusammengesetzten Kapiteltext. Zwei Geräte, die dieselbe
Datei importiert haben, kommen damit auf denselben Wert, ohne dass etwas
gespeichert oder migriert werden müsste.

Passt ein eingehendes Dokument auf ein vorhandenes, wird es **nicht** ersetzt.
Der lokale Datensatz bleibt, und alles, was am eingehenden hängt (Fortschritt,
Lesezeichen, Markierungen, Schlagwörter), wird auf die **lokale** Kennung
umgeschrieben. Sonst zeigen Markierungen auf ein Dokument, das es hier nicht
gibt.

### Fortschritt: das Neuere gewinnt

`ReadingProgress.updatedAt` entscheidet. Steht das lokale weiter vorn, bleibt
es. Nur so kann die Leseposition nicht rückwärts springen.

### Lesezeichen und Markierungen: vereinigen

Beide tragen stabile Kennungen, die Vereinigung ist also einfach. Zusätzlich
wird über die Stelle entdoppelt (Dokument plus Position), damit zweimal
importierte Sicherungen nicht zwei Marken an derselben Stelle hinterlassen.

### Schlagwörter: vereinigen

Die Listen beider Seiten werden zusammengelegt und über `normalizeTags`
entdoppelt, das faltet Groß- und Kleinschreibung sowie Umlaute ohnehin schon.

### Einstellungen: bleiben lokal

Beim Zusammenführen **nicht** übernommen. Schriftgröße, Ränder und Farbschema
gehören zum Gerät, nicht zur Bibliothek; ein Tablet mit den Werten eines
Telefons ist kein gutes Ergebnis. Beim Ersetzen werden sie übernommen, denn dort
ist der Zweck gerade, das Gerät wiederherzustellen.

### Statistik: Tag für Tag, und lieber zu wenig

Je Tag wird das **Maximum** beider Seiten genommen, nicht die Summe.

Die Summe wäre in einem Fall richtig (zwei Geräte, beide haben heute gelesen)
und in einem häufigeren falsch: Wer dieselbe Sicherung zweimal einliest, hätte
plötzlich doppelt so viel gelesen. Eine Lesestatistik, die zu hoch steht, ist
eine Lüge über den eigenen Fortschritt. Das Maximum untertreibt im seltenen
Fall und übertreibt nie.

Die Serie wird aus den zusammengeführten Tageswerten **neu berechnet**, nicht
übernommen. Der Durchschnitt ebenso.

---

## Was gebaut wird

### 1. Kern (`packages/core`)

- `documentFingerprint(doc)` — Wortzahl plus Streuwert über den Kapiteltext
- `inspectBackup(json)` — liest eine Sicherung, **ohne** etwas zu ändern, für
  die Rückfrage vor dem Einlesen
- `mergeStats(local, incoming)` — Tageswerte, Serie neu, Durchschnitt neu
- `store.importAll(json, { mode })` — `merge` als Voreinstellung, `replace` auf
  Verlangen; liefert einen Bericht statt einer nackten Zahl
- Tests für jede Regel oben, je einer pro Richtung

### 2. App (`apps/mobile`)

- Abschnitt „Sichern und Übertragen" in den Einstellungen
- **Sicherung erstellen**: wie bisher teilen, dazu auf Android „In Ordner
  speichern" über `StorageAccessFramework`. Auf iOS enthält das Teilen-Blatt
  bereits „In Dateien sichern", dort ist nichts zu bauen.
- **Sicherung einlesen**: Datei wählen, dann eine Übersicht, was drinsteht und
  von wann, dann die Wahl zwischen Zusammenführen und Ersetzen, dann ein
  Bericht, was wirklich passiert ist.
- Fehlerfälle mit klarer Ansage: falsche Datei, kaputtes JSON, neuere
  Schema-Fassung als diese App kennt.

### 3. Web (`apps/web`)

Dieselbe Wahl und dieselbe Übersicht. Die Web-Fassung kann heute nur ersetzen,
ohne es zu sagen.

### 4. Texte

- Der Knopf heißt nicht mehr nur „Sicherung", sondern sagt, was er tut
- Datenschutzerklärung: ein Satz, dass eine Sicherungsdatei die vollständigen
  Dokumente enthält und damit selbst schützenswert ist
- Store-Beschreibung: Sichern und Übertragen als Funktion nennen

---

## Was bewusst nicht gebaut wird

**Kopplungscode im lokalen Netz.** Expo bringt keinen HTTP-Server mit, das
hieße ein natives Modul. WebRTC bräuchte trotzdem einen Signalisierungs-Server,
„ohne Server" stimmt dort also nicht. Beide Geräte müssten gleichzeitig im
selben WLAN sein. Gegenüber einer Datei in der eigenen Cloud ist der Gewinn
klein und der Aufwand um ein Vielfaches größer.

**Automatischer Abgleich.** Ohne Server gibt es keinen Auslöser. Ein Abgleich,
der nur läuft, wenn der Nutzer daran denkt, sollte auch so heißen.

---

## Was noch fehlt, damit es rund ist

Zwei Dinge, die ein Ablauf ohne Server braucht und die beim ersten Durchgang
nicht gebaut wurden.

### Die Sicherung aus einer anderen App öffnen

Heute führt der einzige Weg über Einstellungen, Sicherung einlesen, Datei
wählen. Wer die Datei in seiner Cloud-App vor sich hat, erwartet, sie antippen
zu können und in LexiPulse zu landen.

Dafür braucht es eine Dateiverknüpfung: unter Android ein `intentFilter` für
`application/json` samt `content`-Schema, unter iOS ein `CFBundleDocumentTypes`.
Beides gehört in `app.config.ts`, nicht in die erzeugten Ordner, sonst ist es
beim nächsten `prebuild` weg. Die App muss den eingehenden Verweis abfangen und
in dieselbe Vorschau führen wie der Weg über die Einstellungen; ein zweiter
Ablauf für dasselbe wäre eine zweite Fehlerquelle.

### Daran erinnern, dass eine Sicherung fällig ist

Ohne Server trägt der Nutzer die Verantwortung für seine Daten. Eine App, die
das nie erwähnt, lässt ihn damit allein und wirkt erst dann unvollständig, wenn
das Telefon weg ist.

Also: den Zeitpunkt der letzten Sicherung merken und ihn im Abschnitt zeigen.
„Zuletzt gesichert vor drei Monaten" ist eine Auskunft, keine Mahnung. Kein
Hinweis auf anderen Bildschirmen, keine Abzeichen, keine roten Punkte. Wer nie
gesichert hat, sieht „Noch nie gesichert", und das reicht.

---

## Was daraus geworden ist

Alles oben ist gebaut, in App und Web, und am Gerät nachgewiesen.

Zwei Fehler kamen erst beim Bauen zum Vorschein, beide hätten still Daten
gekostet:

**`saveProgress` überschrieb `updatedAt` mit der aktuellen Zeit.** Damit ließ
sich ein Lesestand nie mit seinem echten Zeitstempel wiederherstellen, und „das
Neuere gewinnt" hätte zwei erfundene Zeiten verglichen. Alle drei Aufrufer
setzen den Zeitstempel ohnehin selbst.

**`clearAll` löschte den Schema-Schlüssel mit** und schrieb ihn nicht zurück.
Nach einem Ersetzen hätte der nächste Start jede Migration gegen bereits
aktuelle Daten laufen lassen. Heute folgenlos, weil die Migration nichts tut;
die erste, die etwas umformt, hätte eine frisch wiederhergestellte Bibliothek
beschädigt.

Dazu drei Stellen in der App, die nicht offensichtlich sind:

- Nach dem Einlesen `discard()` statt `close()`, weil ein späterer Flush sonst
  die alte Leseposition über die eingelesene schreibt.
- Beim Ersetzen die Einstellungen aus dem Speicher zurückholen, sonst schreibt
  der entprellte Write das alte Farbschema zurück.
- Die Vorschau schließt, bevor die Rückfrage aufgeht; zwei native Dialoge
  gleichzeitig sind auf Android unzuverlässig.

Offen bleibt der **iOS-Pfad**: Dort ist für „In Ordner speichern" nichts zu
bauen, weil das Teilen-Blatt „In Dateien sichern" bereits enthält, aber geprüft
werden konnte es ohne Mac nicht.

## Wie Apple doch noch gebaut wurde

Der erste Befund stimmte: Das Kontingent des Kontos `menucloudberlin` ist
aufgebraucht, und `expo-updates` fehlt, ein OTA-Weg existiert also nicht.

Was er uebersah: Unter derselben Anmeldung haengen vier Konten, und das
Kontingent haengt am Konto, dem das Projekt gehoert, nicht an der Person.
`menucloud2` war ebenfalls leer, `salatipro` und `salatibox` nicht. Gebaut wurde
unter `salatibox`.

Dafuer musste dreierlei voruebergehend geaendert werden, und alles davon gehoert
danach zurueckgesetzt:

1. `owner` und `projectId` in `app.config.ts` zeigen auf das andere Konto.
2. `appVersionSource` in `eas.json` von `remote` auf `local`. Ein frisches
   Projekt beginnt seinen Zaehler bei 1, und Apple haelt fuer Version 1.0 schon
   Build 8; eine niedrigere Nummer wird abgelehnt.
3. `autoIncrement` aus, weil EAS das mit einer dynamischen Konfiguration bei
   lokaler Versionsfuehrung nicht zusammenbringt. Die Nummer steht deshalb fest
   im `ios`-Block.

Die iOS-Zugangsdaten kommen aus `credentials.json`, also aus lokalen Dateien.
Sie haengen nicht am EAS-Konto und mussten nicht angefasst werden.

### Android ist der gefaehrlichere Fall

Fuer 1.1 wurde auch das Android-Paket unter dem geliehenen Konto gebaut, und
dabei kam ein vierter Punkt dazu, den der iOS-Lauf nicht gezeigt hatte:

4. `credentialsSource: "local"` auch im `android`-Block. Der Schluessel, den Play
   kennt, liegt auf dem Konto `menucloudberlin`. Ein Bau unter einem fremden
   Konto findet dort keinen und legt sich stillschweigend einen neuen an — der
   Bau gelingt, und erst Play lehnt das Paket beim Hochladen ab, mit einer
   Meldung ueber den Fingerabdruck, die nichts ueber die Ursache sagt.

Der Schluessel liegt unter `C:\Users\domen\Documents\90_Werkstatt\mc-build\lexipulse-android\`.
Nachgewiesen wurde es nicht am Log, sondern am Artefakt: `keytool -printcert
-jarfile` auf das fertige AAB und `keytool -list` auf den Upload-Schluessel
liefern denselben SHA-256. Ebenso stammen `versionCode 10` und `1.1.0` aus dem
Manifest im Bundle, nicht aus der Konfiguration, aus der sie gesetzt wurden.

Zwei Fallen dabei, beide gefunden statt geraten. Der erste Anlauf startete als
Build 1 und waere abgelehnt worden; abgebrochen und die Nummer festgenagelt. Und
die Schleife startete zwei Builds gleichzeitig, unter `salatipro` und unter
`salatibox` — der ueberzaehlige wurde abgebrochen, damit er kein Kontingent
kostet.

Nach der Einreichung wurden alle drei Punkte zurueckgesetzt: `owner` steht wieder
auf `menucloudberlin`, `projectId` auf `5aebaf91-...`, `appVersionSource` auf
`remote`, `autoIncrement` an, und die feste Build-Nummer ist aus dem
`ios`-Block raus. `git status` ist sauber. Das Repo beschreibt damit wieder den
Zustand, der ab dem 1. September gilt, und niemand baut versehentlich weiter
unter einem fremden Konto.

## Warum es ueberhaupt so weit kam

Das EAS-Kontingent des kostenlosen Tarifs ist fuer diesen Monat aufgebraucht und
setzt sich am 1. September 2026 zurueck. Ohne Mac laesst sich iOS nicht lokal
bauen, und `expo-updates` ist nicht eingebunden, ein OTA-Weg existiert also
auch nicht. Geprueft, nicht vermutet.

Solange kein iOS-Build die Funktion enthielt, blieb die Apple-Beschreibung
bewusst unveraendert: Ein Ladeneintrag, der etwas nennt, das im gepruefen Paket
fehlt, ist ein Ablehnungsgrund und gegenueber Kaeufern falsch. Erst mit dem Bau
unter dem anderen Konto durfte sie nachziehen, und zwar zusammen mit dem Build,
nicht davor.
