# Sichern, Übertragen, Zusammenführen — ohne Server

Stand: 2026-08-17. Ziel: Zwei Geräte nebeneinander benutzen und ein Gerät
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
