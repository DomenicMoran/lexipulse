# Betreiberdaten (Rohdaten, recherchiert aus MenuCloud)

Stand: 2026-08-16. Alle Angaben sind aus dem produktiven MenuCloud-Repository gelesen
(read-only). Quelle jeweils mit Dateipfad und Zeilennummer belegt.

## Diensteanbieter / Inhaber

| Feld | Wert | Quelle |
|---|---|---|
| Unternehmen | MenuCloud Berlin | `C:\Users\domen\Documents\MenuCloud\src\app\impressum\page.jsx:45` |
| Inhaber | Domenic Moran | `...\impressum\page.jsx:49` |
| Straße | Heidelberger Str. 36 | `...\impressum\page.jsx:53` |
| PLZ / Ort | 12059 Berlin | `...\impressum\page.jsx:53` |
| Land | Deutschland | `...\impressum\page.jsx:53` |

## Kontakt

| Feld | Wert | Quelle |
|---|---|---|
| Telefon | +49 30 767 645 46 | `...\impressum\page.jsx:68` |
| E-Mail (allgemein) | lexipulse@domenicmoran.de | Projektadresse der Dachmarke, `DomenicMoran\marke\adressen.json` |
| E-Mail (Datenschutz) | lexipulse@domenicmoran.de | dieselbe Adresse, siehe unten |
| Website (MenuCloud) | menucloud-berlin.de | `...\impressum\page.jsx:76` |

## Steuerliches

| Feld | Wert | Quelle |
|---|---|---|
| Kleinunternehmerregelung | Gemäß § 19 UStG wird keine Umsatzsteuer berechnet | `...\impressum\page.jsx:91` |
| USt-IdNr. | DE461628017 | `...\impressum\page.jsx:95` |
| Bankverbindung | wird nur auf direkte Anfrage per E-Mail herausgegeben (Phishing-Prävention) | `...\impressum\page.jsx:102` |

## Verantwortlich nach § 18 Abs. 2 MStV

Domenic Moran, Heidelberger Str. 36, 12059 Berlin
Quelle: `...\impressum\page.jsx:113-114`

## Verantwortlicher im Sinne der DSGVO (Art. 4 Nr. 7)

Domenic Moran, MenuCloud Berlin, Heidelberger Str. 36, 12059 Berlin,
Telefon +49 30 767 645 46, E-Mail lexipulse@domenicmoran.de
Quelle: `...\datenschutz\page.jsx:70-92`

## Streitschlichtung

- EU-Plattform zur Online-Streitbeilegung: https://ec.europa.eu/consumers/odr/
  Quelle: `...\impressum\page.jsx:125`
- Verbraucherschlichtung: nicht bereit und nicht verpflichtet zur Teilnahme an
  Verfahren vor einer Verbraucherschlichtungsstelle (§ 36 VSBG)
  Quelle: `...\impressum\page.jsx:130`

## Zuständige Datenschutz-Aufsichtsbehörde

Berliner Beauftragte für Datenschutz und Informationsfreiheit
Friedrichstr. 219, 10969 Berlin
Telefon +49 30 13889-0
E-Mail mailbox@datenschutz-berlin.de
Web https://www.datenschutz-berlin.de
Quelle: `...\datenschutz\page.jsx:376-381`

## Nicht übernommen (gilt nur für MenuCloud, nicht für LexiPulse)

- Hosting Hetzner Online GmbH, Rechenzentrum Helsinki (`...\datenschutz\page.jsx:141-144`).
  LexiPulse läuft auf Vercel, deshalb eigener Hosting-Abschnitt.
- Stripe, Stripe Connect, SumUp, Apify, Chat-Widget, KI-Mailantworten.
  Keiner dieser Dienste ist in LexiPulse im Einsatz.
- Der KI-Hinweis nach EU AI Act aus dem MenuCloud-Impressum entfällt, weil LexiPulse
  keine generative KI in der Nutzerkommunikation einsetzt.

## Kontaktweg

Die Rechtstexte nennen `lexipulse@domenicmoran.de` — für allgemeine Anfragen und
für Datenschutzanfragen dieselbe Adresse.

**Nachgetragen am 23.08.2026, Store-Audit-Korrekturlauf:** Der Absatz an dieser
Stelle behauptete bis heute, die Post laufe über Cloudflare Email Routing in ein
privates Gmail-Postfach. Das war der Stand vom Vormittag des 19.08.2026 und ist
überholt — nachweisbar per DNS, ohne dass dafür ein anderes Repository geöffnet
werden musste:

```
> nslookup -type=MX domenicmoran.de
domenicmoran.de   MX preference = 10, mail exchanger = mail.menucloud-berlin.de

> nslookup -type=TXT domenicmoran.de
domenicmoran.de   text = "v=spf1 include:spf.brevo.com a:mail.menucloud-berlin.de ~all"
```

Der MX-Eintrag zeigt auf denselben Mailcow-Server, über den auch die anderen
Projektadressen der Dachmarke laufen — nicht auf Cloudflares Routing-Server. Der
SPF-Eintrag gibt sowohl Brevo als auch `mail.menucloud-berlin.de` als zulässige
Absender frei, es kommt also kein Google/Gmail-Empfänger mehr vor. `store/legal/
datenschutz.de.md` (Abschnitt 10/11) und `privacy.en.md` sind entsprechend
korrigiert: Empfang über Mailcow, Antwort über Mailcow oder Brevo, keine
Drittlandübermittlung mehr für den Mail-Weg.

Offen — außerhalb der Reichweite dieses Repositories und daher nicht in diesem Lauf
geprüft: die genaue interne Zustellung auf dem Mailcow-Server selbst (eigenes
Postfach für `lexipulse@domenicmoran.de` oder Alias auf ein bestehendes Postfach mit
Sieve-Sortierung, analog zum Stand vor dem 18.08.2026). Das lässt sich nur aus der
Mailcow-Verwaltung selbst beantworten, die zu einem anderen Projekt gehört. Für die
Rechtstexte reicht die verifizierte Außensicht (MX + SPF): Empfänger ist der
Mailcow-Server, nicht Cloudflare/Google.

Ein eigenes Postfach unter `lexipulse.de` ist nicht nötig. Wer die Adresse umstellen
will, ändert sie zuerst in `DomenicMoran\marke\adressen.json`, lässt aus
`DomenicMoran` `node werkzeug/brevo-absender.mjs --setzen` laufen, prüft mit
`node werkzeug/mail-pruefen.mjs`, dass Post ankommt, und tauscht sie erst danach in
`store/legal/*.md` aus. Eine im Impressum genannte, aber nicht erreichbare Adresse ist
ein Abmahnrisiko nach § 5 Abs. 1 Nr. 2 TMG.
