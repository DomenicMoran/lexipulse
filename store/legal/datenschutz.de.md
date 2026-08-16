---
title: Datenschutzerklärung
description: Wie LexiPulse mit Daten umgeht. Kurz gesagt: Dokumente bleiben auf dem Gerät, es gibt kein Tracking und kein Nutzerkonto.
lang: de
updated: 2026-08-16
---

# Datenschutzerklärung

Stand: 16. August 2026

## 1. Das Wichtigste zuerst

LexiPulse ist so gebaut, dass möglichst gar keine personenbezogenen Daten anfallen.

- Sie brauchen kein Konto und keine Registrierung.
- Ihre Bücher, PDFs, Artikel und Notizen werden ausschließlich auf Ihrem eigenen Gerät
  verarbeitet und gespeichert. Wir laden sie nicht hoch und haben keinen Zugriff darauf.
- Es gibt kein Tracking, keine Analyse-Werkzeuge, keine Werbung und keine
  Werbe-Identifikatoren.
- Es werden keine Cookies gesetzt, die nicht technisch notwendig sind. Deshalb gibt es
  auch kein Cookie-Banner.
- Die einzige Funktion, die überhaupt einen Server anspricht, ist der Import eines
  Web-Artikels über eine URL. Details dazu in Abschnitt 5.

## 2. Verantwortlicher

Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO ist:

**MenuCloud Berlin**
Inhaber: Domenic Moran
Heidelberger Str. 36
12059 Berlin
Deutschland

Telefon: +49 30 767 645 46
E-Mail: lexipulse@menucloud-berlin.de

Ein Datenschutzbeauftragter ist nicht bestellt, weil die Voraussetzungen des Art. 37
DSGVO und des § 38 BDSG nicht erfüllt sind.

## 3. Verarbeitung auf Ihrem Gerät

Wenn Sie ein EPUB, ein PDF, eine Text- oder Markdown-Datei importieren, Text aus der
Zwischenablage einfügen oder einen Web-Artikel öffnen, geschieht Folgendes vollständig
lokal:

- Die Datei wird im Browser oder in der App eingelesen und in Text zerlegt.
- Der Text wird in Wörter zerlegt, für die Anzeige aufbereitet und in der lokalen
  Datenbank abgelegt.
- Lesefortschritt, Lesezeichen, Einstellungen und Statistik werden ebenfalls nur lokal
  gespeichert.

Technisch wird dafür in der Web-App **IndexedDB** im Browser genutzt, in den mobilen
Apps eine lokale **SQLite**-Datenbank im privaten App-Verzeichnis des Geräts.

Diese Daten verlassen Ihr Gerät nicht. Es findet keine Übermittlung an uns oder an
Dritte statt. Da wir darauf keinen Zugriff haben, können wir diese Inhalte weder lesen
noch wiederherstellen, wenn Sie sie löschen.

**Löschung:** Sie löschen einzelne Dokumente in der Bibliothek. Alle Daten auf einmal
entfernen Sie, indem Sie in der Web-App die Website-Daten Ihres Browsers löschen oder in
den mobilen Apps die App deinstallieren beziehungsweise deren Daten zurücksetzen.

## 4. Aufruf der Website lexipulse.de (Hosting)

Die Web-App und die Website werden bei der **Vercel Inc.**, 440 N Barranca Ave #4133,
Covina, CA 91723, USA, gehostet. Für Nutzerinnen und Nutzer aus der EU stellt die
**Vercel Germany GmbH** die Leistung bereit.

Beim Aufruf der Seite verarbeitet Vercel als Auftragsverarbeiter technisch notwendige
Verbindungsdaten in Server-Logfiles:

- IP-Adresse des anfragenden Geräts
- Datum und Uhrzeit der Anfrage
- aufgerufene URL und übertragene Datenmenge
- HTTP-Statuscode
- Referrer-URL, sofern übermittelt
- Browsertyp und Betriebssystem (User-Agent)

**Zweck:** Auslieferung der Seite, Betriebssicherheit, Erkennung und Abwehr von
Missbrauch und Angriffen.
**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist der
sichere und störungsfreie Betrieb des Angebots.
**Speicherdauer:** Vercel speichert diese Logs kurzfristig zur Missbrauchsabwehr. Wir
werten sie nicht personenbezogen aus und führen sie nicht mit anderen Daten zusammen.

Mit Vercel besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Für
Übermittlungen in die USA gelten die EU-Standardvertragsklauseln; Vercel Inc. ist
zusätzlich unter dem EU-US Data Privacy Framework zertifiziert.
Datenschutzhinweise von Vercel: https://vercel.com/legal/privacy-policy

## 5. Import von Web-Artikeln über eine URL

Wenn Sie eine Internetadresse in LexiPulse einfügen, kann Ihr Browser die fremde Seite
aus Sicherheitsgründen nicht direkt auslesen. Deshalb ruft die Web-App die Adresse an
unseren Endpunkt `/api/extract`. Dieser Endpunkt lädt die angegebene Seite serverseitig,
löst den Artikeltext heraus und gibt nur diesen Text an Ihr Gerät zurück, wo er lokal
gespeichert wird.

- **Verarbeitete Daten:** die von Ihnen eingegebene URL sowie technisch die IP-Adresse
  Ihrer Anfrage im Rahmen der allgemeinen Server-Logs nach Abschnitt 4.
- **Keine Speicherung:** Die aufgerufene URL wird nicht protokolliert, nicht gespeichert
  und keinem Nutzer zugeordnet. Der abgerufene Artikeltext wird nicht auf dem Server
  abgelegt, sondern nur weitergereicht und danach verworfen.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO, da die Verarbeitung zur Erbringung
  der von Ihnen ausdrücklich angeforderten Funktion erforderlich ist.
- **Hinweis:** Der Betreiber der von Ihnen aufgerufenen fremden Seite erhält die Anfrage
  von unserem Server. Ihre eigene IP-Adresse wird dabei nicht an ihn übermittelt.

Wer keinen Server einbinden möchte, nutzt statt des URL-Imports den Import über Datei,
Zwischenablage oder Text. Diese Wege sind vollständig offline.

## 6. Vorlesefunktion (TTS)

Die Vorlesefunktion nutzt die Sprachausgabe Ihres Betriebssystems oder Browsers. Der
vorzulesende Text wird dabei an diese Systemfunktion übergeben. Ob Ihr Gerät die
Sprachausgabe lokal berechnet oder dafür einen Dienst des Geräteherstellers anspricht,
hängt von Ihrem Betriebssystem und Ihren Systemeinstellungen ab. Darauf haben wir keinen
Einfluss. Wenn Sie das vermeiden möchten, nutzen Sie LexiPulse ohne die Vorlesefunktion.

## 7. Cookies und lokale Speicher

Wir setzen keine Cookies zu Analyse-, Marketing- oder Profilbildungszwecken. Verwendet
werden ausschließlich lokale Speicher, die für den Betrieb unbedingt erforderlich sind:

| Speicher | Inhalt | Zweck |
|---|---|---|
| IndexedDB | importierte Dokumente, Lesefortschritt, Lesezeichen, Statistik | Kernfunktion der App |
| localStorage | Theme, Akzentfarbe, WPM, Anzeigeeinstellungen | Ihre Einstellungen bleiben erhalten |
| Service-Worker-Cache | Programmdateien der Web-App | Offline-Nutzung |

Der Zugriff auf diese Speicher ist nach § 25 Abs. 2 Nr. 2 TDDDG einwilligungsfrei, weil
er für die von Ihnen ausdrücklich gewünschte Funktion unbedingt erforderlich ist. Ein
Cookie-Banner ist deshalb nicht erforderlich und wird nicht angezeigt.

## 8. Kauf über App Store und Google Play

Die mobilen Apps werden über den Apple App Store und Google Play vertrieben. Kauf,
Bezahlung, Rechnungsstellung und Lizenzverwaltung wickeln allein Apple und Google ab.
Diese Unternehmen sind für die dabei anfallenden Daten eigenständig Verantwortliche im
Sinne von Art. 4 Nr. 7 DSGVO.

Wir erhalten von Apple und Google keine personenbezogenen Käuferdaten. In den
Entwicklerkonsolen sehen wir ausschließlich aggregierte, nicht personenbezogene
Statistiken wie Anzahl der Downloads pro Land oder Umsatzsummen.

- Apple Media Services Datenschutz: https://www.apple.com/legal/privacy/data/de/apple-media-services/
- Google Play Datenschutzerklärung: https://policies.google.com/privacy

Wenn Sie eine Absturzmeldung an Apple oder Google senden, geschieht das über deren
Systemfunktion. Wir erhalten daraus nur anonymisierte technische Berichte, keine
Klarnamen und keine Geräte-Identifikatoren.

## 9. Kontaktaufnahme per E-Mail

Wenn Sie uns schreiben, verarbeiten wir Ihre E-Mail-Adresse und den Inhalt Ihrer
Nachricht, um die Anfrage zu bearbeiten.
**Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO bei vertragsbezogenen Anfragen, sonst
Art. 6 Abs. 1 lit. f DSGVO mit dem berechtigten Interesse an der Beantwortung.
**Speicherdauer:** bis zur abschließenden Bearbeitung, danach nach den gesetzlichen
Aufbewahrungsfristen, soweit solche greifen.

## 10. Empfänger und Drittlandübermittlung

Außer dem in Abschnitt 4 genannten Hoster Vercel setzen wir keine Auftragsverarbeiter
ein. Es gibt kein Analyse-Werkzeug, kein Werbenetzwerk, keinen Fehler-Tracker und keinen
Chat-Dienst. Eine Übermittlung Ihrer Dokumentinhalte in Drittländer findet nicht statt,
weil diese Inhalte Ihr Gerät nicht verlassen.

## 11. Ihre Rechte

Sie haben nach der DSGVO folgende Rechte:

- **Auskunft** über die zu Ihnen verarbeiteten Daten (Art. 15)
- **Berichtigung** unrichtiger Daten (Art. 16)
- **Löschung** (Art. 17)
- **Einschränkung der Verarbeitung** (Art. 18)
- **Datenübertragbarkeit** (Art. 20)
- **Widerspruch** gegen Verarbeitungen, die auf Art. 6 Abs. 1 lit. f DSGVO beruhen
  (Art. 21)

Zur Ausübung genügt eine formlose Nachricht an lexipulse@menucloud-berlin.de.

**Hinweis zur Reichweite:** Weil Ihre Dokumente, Einstellungen und Statistiken
ausschließlich auf Ihrem Gerät liegen, haben wir dazu keine Daten, über die wir Auskunft
erteilen könnten. Ein Auskunftsersuchen kann sich nur auf Daten beziehen, die uns
tatsächlich vorliegen, etwa eine E-Mail-Korrespondenz.

## 12. Datenexport nach Art. 20 DSGVO

LexiPulse enthält eine Exportfunktion, mit der Sie sämtliche lokal gespeicherten Daten
als JSON-Datei sichern: Bibliothek, Lesefortschritt, Lesezeichen, Einstellungen und
Statistik. Der Export läuft vollständig auf Ihrem Gerät, die Datei wird direkt dort
abgelegt. Damit können Sie Ihre Daten jederzeit selbst mitnehmen, ohne uns
kontaktieren zu müssen.

## 13. Beschwerderecht bei einer Aufsichtsbehörde

Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer personenbezogenen Daten gegen die
DSGVO verstößt, können Sie sich nach Art. 77 DSGVO bei einer Aufsichtsbehörde
beschweren. Für uns zuständig ist:

**Berliner Beauftragte für Datenschutz und Informationsfreiheit**
Friedrichstr. 219
10969 Berlin
Telefon: +49 30 13889-0
E-Mail: mailbox@datenschutz-berlin.de
Web: https://www.datenschutz-berlin.de

## 14. Verschlüsselung

Die Website und alle Serveraufrufe laufen ausschließlich über TLS. Eine verschlüsselte
Verbindung erkennen Sie an „https://" in der Adresszeile und am Schlosssymbol Ihres
Browsers.

## 15. Keine automatisierte Entscheidungsfindung

Es findet keine automatisierte Entscheidungsfindung einschließlich Profiling nach
Art. 22 DSGVO statt.

## 16. Kinder

LexiPulse richtet sich nicht gezielt an Kinder unter 16 Jahren. Da wir keine Daten
erheben, entsteht auch für diese Altersgruppe kein Datenbestand bei uns.

## 17. Änderungen dieser Erklärung

Wir passen diese Datenschutzerklärung an, wenn sich die Funktionen von LexiPulse oder
die Rechtslage ändern. Maßgeblich ist die jeweils auf lexipulse.de veröffentlichte
Fassung. Das Datum der letzten Änderung steht oben.
