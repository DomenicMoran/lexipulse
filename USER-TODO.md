# USER-TODO — LexiPulse

Stand: 2026-08-16. Es sind noch **zwei** Dinge offen, und beide kann nur der
Kontoinhaber erledigen: sie verlangen Bankverbindung, Steuerformular und
Identitätsprüfung.

Alles andere ist fertig und nachgeprüft.

---

## 1. Apple: Vertrag für gebührenpflichtige Apps

**Warum es klemmt:** Version 1.0 (Build 2) steht auf „Warten auf Prüfung" und ist
inhaltlich vollständig. Apple kann sie prüfen und genehmigen — zum **Verkauf freigeben**
lässt sie sich trotzdem nicht, solange dieser Vertrag nicht aktiv ist. Der Preis von
4,99 € ist gesetzt und wartet nur darauf.

**Wo:** App Store Connect → **Geschäftliches → Verträge**

| Vertrag | Status heute |
|---|---|
| Für kostenlose Apps | Aktiv (16.07.2026 – 15.04.2027) |
| **Für gebührenpflichtige Apps** | **„Benutzerinfos ausstehend"** |

**Was fehlt:**

1. **Bankkonto hinzufügen** — IBAN des Geschäftskontos, Kontoinhaber wie im Impressum
2. **Steuerinformationen hinzufügen** — der „Steuerfragebogen für die USA" ist nicht
   übermittelt. Für eine deutsche Firma ist das W-8BEN-E; abgefragt werden Firmenname,
   Anschrift, Ansässigkeitsstaat Deutschland und die USt-IdNr. DE461628017.

**Wann:** Am besten jetzt, während geprüft wird. Die Prüfung dauert meist ein bis zwei
Tage — ist der Vertrag bis dahin aktiv, kannst du direkt nach der Genehmigung
veröffentlichen.

**Danach:** Freigabe steht auf **manuell**. Nach der Genehmigung passiert nichts, bis du
auf „Diese Version veröffentlichen" drückst.

---

## 2. Google Play: Zahlungsprofil

**Warum es klemmt:** Play sagt unter Monetarisierung wörtlich „Richte zuerst dein
Abrechnungsprofil ein". Ohne dieses Profil lässt sich für eine kostenpflichtige App kein
Preis setzen und damit auch keine Produktionsfreigabe starten.

**Wo:** Play Console (Konto `menucloudberlin@gmail.com`, also `/console/u/2/`) →
**Einstellungen → Zahlungsprofil**

**Was gebraucht wird:** Firmenname und Anschrift wie im Impressum (MenuCloud Berlin,
Heidelberger Str. 36, 12059 Berlin), USt-IdNr. DE461628017, IBAN des Geschäftskontos,
Ausweis für die Verifizierung.

**Sag danach Bescheid, den Rest übernehme ich:** Preis 4,99 € setzen, „Preise für alle
Länder/Regionen festlegen" bestätigen, das hochgeladene Bundle (versionCode 2) aus dem
internen Test in die Produktion befördern und die Freigabe einreichen.

---

## 3. Eine Entscheidung, kein Blocker: Vercel-Tarif

Das Projekt liegt im Team `domenicmos-projects`, Tarif **Hobby**. Vercel erlaubt auf
Hobby keine kommerzielle Nutzung. Die Web-App ist kostenlos, bewirbt aber eine
kostenpflichtige App — das kann Vercel als kommerziell werten.

Pro kostet 20 $/Monat. Ich habe nichts umgestellt, weil das Geld ausgibt und deine
Entscheidung ist.

---

## Fertig und nachgeprüft

**Web:** lexipulse.de live, LCP 400 ms, CLS 0,0005, keine Konsolenfehler. Import,
Player, Bibliothek, Statistik, JSON-Export, PWA, Impressum, Datenschutz, AGB.

**Apple:** App-Eintrag 6801979644, Bundle-ID, Kategorien, Titel/Untertitel/Beschreibung/
Keywords in DE und EN, 24 Screenshots, Preis 4,99 €, Altersfreigabe 4+, App-Datenschutz
„Keine Daten erfasst" (veröffentlicht), Prüfhinweise, Copyright, Build angehängt,
Version eingereicht.

**Google Play:** App-Eintrag `de.lexipulse.app`, Store-Eintrag DE+EN mit Icon,
Feature-Grafik und je 6 Screenshots, alle sieben Erklärungen unter App-Inhalte,
Kontaktdaten, AAB als versionCode 2 im internen Testkanal.

**Code:** 309 Tests grün, Typecheck und Lint ohne Befund, CI grün, PolyForm
Noncommercial, Signaturmaterial außerhalb des öffentlichen Repos.

**Kontakt:** überall `lexipulse@menucloud-berlin.de`, auch für Datenschutzanfragen.

Signaturmaterial liegt unter `C:\Users\domen\Documents\mc-build\lexipulse-ios\`
(Zertifikat `BY94XCS595` bis 2027-07-17, Profil `TNXJUGLT72`);
`apps/mobile/credentials.json` zeigt darauf und ist per `.gitignore` ausgeschlossen.
