# USER-TODO — LexiPulse

Aufgaben, die nur du erledigen kannst. Stand: 2026-08-16.

## 1. DNS für lexipulse.de auf Vercel zeigen lassen

Sobald das Vercel-Projekt steht, trage bei deinem Domain-Anbieter ein:

```
A     @      76.76.21.21
CNAME www    cname.vercel-dns.com
```

Danach in Vercel unter Project → Settings → Domains `lexipulse.de` und `www.lexipulse.de`
hinzufügen. Vercel stellt das Zertifikat automatisch aus.

## 2. E-Mail-Postfach unter lexipulse.de

Die Rechtstexte nennen aktuell `info@menucloud-berlin.de` und
`datenschutz@menucloud-berlin.de`, weil das die einzigen belegbar existierenden Postfächer
sind. Eine im Impressum genannte, nicht erreichbare Adresse ist nach § 5 Abs. 1 Nr. 2 TMG
angreifbar — deshalb steht dort bewusst keine erfundene LexiPulse-Adresse.

Wenn du `kontakt@lexipulse.de` und `datenschutz@lexipulse.de` in Mailcow anlegst, sag
Bescheid, dann tausche ich die Adressen in allen fünf Rechtstexten aus.

## 3. Apple: App-Eintrag anlegen

In App Store Connect ein neues App-Record anlegen:

- Name: **LexiPulse**
- Bundle-ID: `de.lexipulse.app` (vorher unter Certificates → Identifiers registrieren)
- SKU: `lexipulse-ios-001`
- Primärsprache: Deutsch
- Preisstufe: **4,99 €** (Tier je nach aktueller Apple-Preistabelle)
- Verfügbarkeit: alle Länder, in denen du verkaufen willst

Texte, Keywords und die Datenschutz-Antworten liegen fertig unter `store/metadata/`.

## 4. Google Play: App-Eintrag anlegen

In der Play Console eine neue App anlegen:

- Name: **LexiPulse**
- Standardsprache: Deutsch (Deutschland)
- App-Typ: App, **kostenpflichtig**, 4,99 €
- Danach: Zahlungsprofil verknüpfen (ohne das lässt sich kein Preis setzen)

## 5. Prüfen und freigeben

Bevor du einreichst: die Screenshots unter `store/screenshots/` ansehen und die
Beschreibungen in `store/metadata/` gegenlesen. Das ist der Text, der später im Store
steht — nichts davon lässt sich nach der Freigabe schnell korrigieren.
