# USER-TODO — LexiPulse

Aufgaben, die nur du erledigen kannst. Stand: 2026-08-16.

## 1. Google Play: Abrechnungsprofil einrichten — der einzige echte Blocker

Der Play-Eintrag ist fertig bis auf eine Sache: **den Preis.** Play sagt unter
Monetarisierung wörtlich „Richte zuerst dein Abrechnungsprofil ein". Ohne dieses Profil
lässt sich für eine kostenpflichtige App kein Preis setzen und damit auch keine
Produktionsfreigabe starten.

Das mache ich nicht für dich: dafür sind Bankverbindung, Steuerdaten und eine
Identitätsprüfung nötig.

Weg dahin:

1. Play Console → **Einstellungen → Zahlungsprofil** (Menüpunkt „Bestellverwaltung")
2. Google-Zahlungsprofil anlegen: Firmenname, Anschrift, Steuernummer, Bankverbindung
3. Danach App → **Mit Google Play monetarisieren → App-Preise** → 4,99 € setzen und
   „Preise für alle Länder/Regionen festlegen" bestätigen
4. Dann App → **Testen und veröffentlichen → Produktion** → das bereits hochgeladene
   Bundle (versionCode 2) in die Produktion befördern

Alles andere steht:

- App-Eintrag `de.lexipulse.app`, Name „LexiPulse: Speed Reader"
- Store-Eintrag DE und EN: Titel, Kurz- und Volltextbeschreibung, Icon, Feature-Grafik,
  je 6 Screenshots
- Alle Erklärungen unter App-Inhalte abgeschlossen: Datenschutzerklärung, Werbung
  („keine"), Anmeldedaten („nicht zugangsbeschränkt"), Werbe-ID („nein"), Behörden-,
  Finanz- und Gesundheits-Apps („nein"), Zielgruppe 18+, Datensicherheit
  („keine Datenerfassung"), Altersfreigabe 3+
- AAB als versionCode 2 im internen Testkanal

## 2. Apple: Vertrag für kostenpflichtige Apps abschließen

**Version 1.0, Build 2 steht auf „Warten auf Prüfung"** — inhaltlich ist alles gesetzt.
Aber verkaufen lässt sich die App noch nicht.

App Store Connect → **Geschäftliches → Verträge** zeigt:

| Vertrag | Status |
|---|---|
| Vertrag für kostenlose Apps | Aktiv (16.07.2026 – 15.04.2027) |
| **Vertrag für gebührenpflichtige Apps** | **„Benutzerinfos ausstehend"** |

Es fehlen zwei Dinge, und beide brauchen deine Daten:

1. **Bankkonto hinzufügen** — IBAN des Geschäftskontos
2. **Steuerformular** — der „Steuerfragebogen für die USA" ist nicht übermittelt
   (für eine deutsche Firma das W-8BEN-E, wird im Formular abgefragt)

Solange dieser Vertrag nicht aktiv ist, kann Apple die App zwar **prüfen und genehmigen**,
sie lässt sich aber **nicht zum Verkauf freigeben**. Der Preis von 4,99 € ist gesetzt und
wartet nur darauf.

Die Prüfung dauert meist ein bis zwei Tage — am besten erledigst du den Vertrag in diesem
Fenster, dann kannst du direkt nach der Genehmigung veröffentlichen.

**Danach:** Die Freigabe steht auf **manuell**. Wenn Apple genehmigt, passiert nichts, bis
du in App Store Connect auf „Diese Version veröffentlichen" drückst.

Gesetzt sind: Bundle-ID `de.lexipulse.app`, App-Eintrag `6801979644`, Kategorien
Produktivität und Bücher, Titel und Untertitel DE+EN, Beschreibungen, Keywords,
24 Screenshots (6,9" und 6,5", je DE und EN), Preis 4,99 € (Erlös 3,56 €),
Altersfreigabe 4+, App-Datenschutz „Keine Daten erfasst" (veröffentlicht, nicht nur
gespeichert), Prüfhinweise mit Testanleitung, Copyright.

Falls ein Prüfer den URL-Import doch als unbeschränkten Webzugriff wertet: in den
App-Informationen die Altersfreigabe-Frage „Unrestricted Web Access" auf Ja setzen,
dann steht dort 17+. Bis dahin gilt 4+, wie besprochen.

## 3. Vercel-Tarif (deine Entscheidung, ich habe nichts geändert)

Das Projekt `lexipulse` liegt im Team `domenicmos-projects`, Tarif **Hobby**. Die
Vercel-Nutzungsbedingungen erlauben auf Hobby keine kommerzielle Nutzung. Die Web-App
ist kostenlos, bewirbt aber eine kostenpflichtige App — das kann Vercel als kommerziell
werten.

Erledigt: Projekt angelegt (Root `apps/web`, GitHub-verknüpft), DNS bei INWX auf Vercel
umgestellt, Parkeintrag und Wildcard entfernt, `misconfigured: false`, Seite live.

## 4. Kontaktadresse — erledigt, nichts zu tun

Überall steht **`info@menucloud-berlin.de`**, und zwar als einzige Adresse: Impressum,
Datenschutzerklärung (deutsch und englisch), AGB, Footer und FAQ der Webseite,
Play-Store-Kontaktdaten, Apple-Prüfhinweise, IARC-Formular.

`datenschutz@menucloud-berlin.de` ist raus. Ein Postfach, das gelesen wird, ist mehr wert
als zwei, von denen eins vielleicht nicht geöffnet wird — und bei Datenschutzanfragen
läuft sonst eine Frist gegen ein totes Postfach.

Ein eigenes Postfach unter `lexipulse.de` wird bewusst nicht angelegt.

## 5. Eine Sache, die ich nicht prüfen konnte

**Sprachausgabe auf dem Gerät.** Du hast gesagt, sie ist geprüft — für die Akte: mein
eigener Nachweis fehlt, weil Playwright-Chromium keine Stimmen installiert hat und der
Android-Emulator keinen Ton ausgibt. Der Code-Pfad, die Stimmenliste und der Abbruch bei
Pause und Sprung sind implementiert und typgeprüft.

## 6. Signaturmaterial (nur zur Kenntnis)

Liegt außerhalb des Repositorys, weil `DomenicMoran/lexipulse` öffentlich ist:

- `C:\Users\domen\Documents\mc-build\lexipulse-ios\distribution.p12` — vorhandenes
  Apple-Verteilzertifikat `BY94XCS595`, gültig bis 2027-07-17. Wiederverwendet, weil das
  Team bereits drei Zertifikate hat und Apple keine vier erlaubt.
- `C:\Users\domen\Documents\mc-build\lexipulse-ios\lexipulse-appstore.mobileprovision` —
  neu angelegtes Profil `TNXJUGLT72` für `de.lexipulse.app`
- `apps/mobile/credentials.json` zeigt auf beide und ist per `.gitignore` ausgeschlossen
  (mit `git check-ignore -v` belegt)
