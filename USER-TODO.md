# USER-TODO — LexiPulse

Stand: 2026-08-16. **Offen ist nichts mehr, was jemand tun müsste.** Beide Stores
haben die App zur Prüfung, und beide veröffentlichen nach der Freigabe von selbst.

---

## Wo die App gerade steht

| Store | Stand | Was danach passiert |
|---|---|---|
| **Apple App Store** | Version 1.0 (Build 2), Status „Warten auf Prüfung" | Freigabemodus steht auf **AFTER_APPROVAL**: Apple genehmigt, die App geht ohne weiteren Klick live |
| **Google Play** | 11 Änderungen eingereicht, Produktion 1.0.0 (versionCode 2), vollständiger Roll-out | Verwaltete Veröffentlichung ist **aus**: nach der Prüfung geht die App direkt live. Google nennt in der Regel bis zu 7 Tage |

Der Freigabemodus bei Apple stand vorher auf „manuell". In dem Zustand bleibt eine
genehmigte Version stumm liegen, ohne Warnung. Er ist jetzt umgestellt und
zurückgelesen.

---

## Preise

Beide Stores: **4,99 € inklusive Mehrwertsteuer** für Kundinnen und Kunden in
Deutschland — dasselbe, was der Store-Text und die Website versprechen.

Bei Play ist der eingegebene Betrag der **Netto**-Basispreis; die Endkundenpreise
entstehen daraus mit der jeweiligen Landessteuer. Eingetragen sind deshalb 4,19 €
Basis, woraus mit 19 % genau 4,99 € werden. Die 4,99 € stehen so auch in der
Play Console in der Zeile Deutschland.

Gültig für 172 Länder/Regionen bei Play und alle Länder bei Apple.

---

## Zahlungsvoraussetzungen — erledigt

**Apple:** Vertrag für gebührenpflichtige Apps **aktiv** (15.08.2026 – 15.04.2027),
Bankkonto Finom Payments BV aktiv, W-8BEN und Certificate of Foreign Status aktiv.

**Google Play:** Zahlungsprofil eingerichtet, Händlerkonto steht, der Blocker
„Richte zuerst dein Abrechnungsprofil ein" ist weg.

---

## Eine Entscheidung, kein Blocker: Vercel-Tarif

Das Projekt liegt im Team `domenicmos-projects`, Tarif **Hobby**. Vercel erlaubt auf
Hobby keine kommerzielle Nutzung. Die Web-App ist kostenlos, bewirbt aber eine
kostenpflichtige App — das kann Vercel als kommerziell werten. Pro kostet 20 $/Monat.

---

## Bekannte, bewusst offene Kleinigkeit

Play warnt beim Bundle: „Mit diesem App Bundle ist keine Offenlegungsdatei
verknüpft." Das betrifft nur die Lesbarkeit von Absturzberichten bei verschleiertem
Code, nicht die Prüfung oder die Veröffentlichung. Die Mapping-Datei entsteht beim
EAS-Build und kann bei einem späteren Release nachgereicht werden.

---

## Fertig und nachgeprüft

**Web:** lexipulse.de live, LCP 400 ms, CLS 0,0005, keine Konsolenfehler. Import,
Player, Bibliothek, Statistik, JSON-Export, PWA, Impressum, Datenschutz, AGB.

**Apple:** App-Eintrag 6801979644, Bundle-ID, Kategorien Produktivität und Bücher,
Titel/Untertitel/Beschreibung/Keywords in DE und EN, 24 Screenshots, Preis 4,99 €,
Altersfreigabe 4+, App-Datenschutz „Keine Daten erfasst" (veröffentlicht),
Prüfhinweise, Copyright, Build angehängt, Version eingereicht.

**Google Play:** App-Eintrag `de.lexipulse.app`, Store-Eintrag DE+EN mit Icon,
Feature-Grafik und je 6 Screenshots, alle sieben Erklärungen unter App-Inhalte,
Kategorie Effizienz, Kontaktdaten, 172 Länder/Regionen, AAB als versionCode 2 in
der Produktion.

**Code:** 309 Tests grün, Typecheck und Lint ohne Befund, CI grün, PolyForm
Noncommercial, Signaturmaterial außerhalb des öffentlichen Repos.

**Kontakt:** überall `lexipulse@menucloud-berlin.de`, auch für Datenschutzanfragen.

Signaturmaterial liegt unter `C:\Users\domen\Documents\mc-build\lexipulse-ios\`
(Zertifikat `BY94XCS595` bis 2027-07-17, Profil `TNXJUGLT72`);
`apps/mobile/credentials.json` zeigt darauf und ist per `.gitignore` ausgeschlossen.
