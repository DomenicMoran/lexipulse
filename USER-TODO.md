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

## Vercel-Tarif — erledigt, der Stand hier war veraltet

Das Projekt liegt im Team `domenicmos-projects`, und dieses Team steht auf **Pro**.
Am 16.08.2026 über die API gegengelesen (`/v2/teams` meldet `billing.plan = pro`,
`/v9/projects` führt `lexipulse` in genau diesem Team; es gibt kein zweites Team).
Damit ist die Fair-Use-Frage vom Tisch: Kommerzielle Nutzung ist auf Pro
ausdrücklich erlaubt.

Der Eintrag stand hier noch auf „Hobby", weil der Tarif für ein anderes Projekt
umgestellt wurde und ein Team allen gemeinsam ist. Das ist die Lehre daraus: Ein
Tarif gehört dem Team, nicht dem Projekt, und eine Notiz je Projekt veraltet
still, sobald ein Nachbarprojekt zahlt.

---

## Ein fertiger Stand wartet auf deine Entscheidung

Die Play-Warnung „keine Offenlegungsdatei verknüpft" ist behoben, und bei der Prüfung
kamen zwei Fehler heraus, die schwerer wiegen als die Warnung selbst. Alles ist
committet, getestet und auf einem Gerät nachgewiesen — aber es wirkt erst mit einem
neuen Build.

**Was drin ist**

1. **R8 eingeschaltet.** Damit liegt die Mapping-Datei im Bundle
   (`BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`), die Warnung
   entfällt, und aus fünf dex-Dateien werden drei (48,1 → 18,8 MB).
2. **Seitennavigation landete im Lesetext.** Der Wikipedia-Artikel über Schnelllesen —
   genau die Adresse, auf die Apples Prüfteam hingewiesen wird — begann mit 31
   Sprachnamen und enthielt achtmal „[Bearbeiten | Quelltext bearbeiten]".
3. **Satzzeichen wurden zu eigenen Wörtern.** `<a>Fähigkeit</a>,` kam als „Fähigkeit ,"
   an; 87 der 1832 Tokens waren ein alleinstehendes Komma oder ein Punkt, die der
   Player als eigenes Wort zeigt.

Auf derselben Seite: 1832 Tokens auf 1680, kein Marker mehr, Textbeginn beim ersten
echten Satz. Auf lexipulse.de ist das bereits live, weil die Web-App denselben Parser
benutzt.

**Entschieden am 16.08.2026: Wir warten und schieben 1.0.1 nach.** Beide Läden
behalten ihre Warteposition, und der fertige Stand geht als erstes Update
hinterher.

Die Begründung ist eine Messung aus einem Nachbarprojekt vom selben Tag: Bei
Dartile lief die Google-Prüfung seit dem 12.08., und ein Schreibvorgang am
Ladeneintrag hat sie **abgebrochen** und eine neue gestartet — in der Console
unter „Aktivität bei der Einreichung" als *Einreichung 1: Abgebrochen* und
*Einreichung 2: Wird überprüft* nachlesbar. Vier Tage Wartezeit waren weg.

Dem steht gegenüber, was die drei Fixes wirklich sind: kein Absturz, kein
fehlendes Feature, keine falsche Angabe. Die Navigation im Lesetext und die
alleinstehenden Satzzeichen sind Qualitätsmängel im Ergebnis, und die
Mapping-Datei ist eine Warnung. Nichts davon ist ein Ablehnungsgrund nach
Richtlinie 2.1; ein Prüfer sieht eine funktionierende App.

Damit ist der Tausch klar: sicherer Verlust von mehreren Tagen gegen einen
kosmetischen Gewinn in der ersten Fassung, die ohnehin binnen Tagen ersetzt wird.

**Beide Läden veröffentlichen nach der Freigabe von selbst.** Sobald 1.0.0
draußen ist, geht 1.0.1 als versionCode 3 hinterher — dann ohne Wartekosten,
weil keine laufende Prüfung mehr abgebrochen wird.

Für Apple gilt dasselbe und aus demselben Grund: Ein neuer Build würde Version
1.0 aus der Schlange werfen.

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
