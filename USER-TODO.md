# USER-TODO — LexiPulse

Aufgaben, die nur du erledigen kannst. Stand: 2026-08-16.

## 1. Vercel-Tarif prüfen (Hobby vs. Pro)

Das Projekt `lexipulse` liegt im Team `domenicmos-projects`, Tarif **Hobby**. Die Vercel-
Nutzungsbedingungen erlauben auf Hobby keine kommerzielle Nutzung. Die Web-App selbst ist
kostenlos, bewirbt aber eine kostenpflichtige App für 4,99 € — das kann Vercel als
kommerziell werten.

Entweder auf Pro wechseln (20 $/Monat) oder in Kauf nehmen, dass Vercel das Projekt bei
einer Prüfung beanstandet. Deine Entscheidung, ich habe hier nichts geändert.

Erledigt ist dagegen:
- Vercel-Projekt `lexipulse` angelegt, Root `apps/web`, mit GitHub verknüpft
- DNS bei INWX umgestellt: `lexipulse.de` → A 216.198.79.1 + 64.29.17.1,
  `www` → CNAME cname.vercel-dns.com, INWX-Parkeintrag entfernt
- Vercel meldet `misconfigured: false`

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
