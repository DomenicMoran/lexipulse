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

## 2. Apple: nichts zu tun, wartet auf Prüfung

**Version 1.0, Build 2 — „Warten auf Prüfung".**

Die Freigabe steht auf **manuell**: wenn Apple genehmigt, passiert nichts, bis du in
App Store Connect auf „Diese Version veröffentlichen" drückst.

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

## 4. E-Mail-Postfach unter lexipulse.de

Die Rechtstexte nennen `info@menucloud-berlin.de` und `datenschutz@menucloud-berlin.de`,
weil das die einzigen belegbar existierenden Postfächer sind. Eine im Impressum genannte,
nicht erreichbare Adresse ist nach § 5 Abs. 1 Nr. 2 TMG angreifbar — deshalb steht dort
bewusst keine erfundene LexiPulse-Adresse.

Legst du `kontakt@lexipulse.de` und `datenschutz@lexipulse.de` in Mailcow an, tausche ich
die Adressen in allen fünf Rechtstexten und in den Prüfhinweisen aus.

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
