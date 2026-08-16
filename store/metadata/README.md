# Store-Metadaten LexiPulse

Diese Dateien sind die Quelle der Wahrheit für alle Store-Einträge. Wer etwas in App
Store Connect oder in der Play Console ändert, ändert es zuerst hier und kopiert es dann
hinüber. Sonst laufen die Fassungen auseinander.

Sprachen:

- `de-DE/` deutsche Fassung (App Store: Deutsch; Play: Deutsch (Deutschland))
- `en-US/` englische Fassung (App Store: English (U.S.); Play: English (United States),
  gleichzeitig die Standardsprache in beiden Stores)

## Wohin gehört welche Datei

| Datei | Apple App Store Connect | Google Play Console | Limit |
|---|---|---|---|
| `title.txt` | App-Informationen → Name | Store-Eintrag → App-Name | Apple 30, Google 30 |
| `subtitle.txt` | App-Informationen → Untertitel | wird bei Google **nicht** verwendet | Apple 30 |
| `short_description.txt` | wird bei Apple **nicht** verwendet | Store-Eintrag → Kurzbeschreibung | Google 80 |
| `full_description.txt` | Version → Beschreibung | Store-Eintrag → Vollständige Beschreibung | Apple 4000, Google 4000 |
| `keywords.txt` | Version → Keywords | wird bei Google **nicht** verwendet | Apple 100 |
| `release_notes.txt` | Version → Neue Funktionen | Produktionsspur → Versionshinweise | Apple 4000, **Google 500** |

Das Google-Limit von 500 Zeichen für Versionshinweise ist die engste Grenze bei den
Release Notes. `release_notes.txt` bleibt deshalb unter 500 Zeichen, damit derselbe Text
in beiden Stores funktioniert.

## Aktuelle Zeichenzahl (gemessen 2026-08-17)

| Datei | de-DE | en-US |
|---|---|---|
| title | 23 / 30 | 23 / 30 |
| subtitle | 30 / 30 | 27 / 30 |
| short_description | 79 / 80 | 73 / 80 |
| keywords | 94 / 100 | 94 / 100 |
| full_description | 3984 / 4000 | 3706 / 4000 |
| release_notes | 475 / 500 | 453 / 500 |

Nach jeder Textänderung neu messen:

```powershell
Get-ChildItem store/metadata/*/*.txt | ForEach-Object {
  "{0,-45} {1}" -f $_.FullName.Replace((Get-Location).Path + '\',''), (Get-Content $_ -Raw).TrimEnd("`r","`n").Length
}
```

## Regeln, die beim Ausfüllen gelten

**Apple.** Der Suchindex wird aus Name, Untertitel und dem Keyword-Feld gebildet. Ein
Wort, das schon im Namen oder Untertitel steht, gehört nicht noch einmal ins
Keyword-Feld, das wäre verschenkter Platz. Deshalb enthält `keywords.txt` weder
„Speed" noch „Reader" (aus dem Namen) und weder „EPUB" noch „PDF" noch „RSVP" (aus dem
Untertitel). Keywords werden kommagetrennt und ohne Leerzeichen nach dem Komma
eingetragen; jedes Leerzeichen kostet eines der 100 Zeichen. Die Beschreibung fließt bei
Apple **nicht** in den Suchindex ein, sie dient allein der Überzeugung auf der
Produktseite.

**Google.** Hier gibt es kein Keyword-Feld. Der Suchindex speist sich aus App-Name,
Kurzbeschreibung und der vollständigen Beschreibung. Die relevanten Begriffe stehen
deshalb in `full_description.txt` in normalen Sätzen. Keyword-Stapel werden von Google
als Spam gewertet und können den Eintrag kosten.

**Keine unbelegten Leistungsversprechen.** Keine Nutzerzahlen, keine
Geschwindigkeitsversprechen wie „dreimal schneller lesen", keine erfundenen Bewertungen.
Solche Angaben sind ohne Beleg eine irreführende geschäftliche Handlung nach § 5 UWG und
verstoßen zusätzlich gegen die Store-Richtlinien. Der Nutzen wird über die Beschreibung
der Funktion transportiert, nicht über eine Zahl.

**Preisangaben.** In den Beschreibungen steht der Preis 4,99 Euro einmalig. Wenn der
Preis geändert wird, müssen `full_description.txt` in beiden Sprachen mitgeändert
werden, sonst ist die Angabe falsch.

## Nicht in diesem Ordner

- Screenshots und Feature-Grafik liegen unter `store/screenshots/`
- Datenschutz-Fragebögen der Stores: `store/metadata/app-privacy.md`
- Rechtstexte für die Store-Pflichtfelder: `store/legal/`

## Store-Pflichtfelder, die auf die Rechtstexte zeigen

| Feld | Wert |
|---|---|
| Privacy Policy URL (Apple und Google, Pflicht) | https://lexipulse.de/datenschutz |
| Terms of Use / EULA URL | https://lexipulse.de/agb |
| Support URL | https://lexipulse.de |
| Marketing URL | https://lexipulse.de |
| Copyright (Apple) | 2026 Domenic Moran |
| Kontakt-E-Mail (Play, öffentlich sichtbar) | lexipulse@menucloud-berlin.de |
