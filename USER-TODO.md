# USER-TODO — LexiPulse

Stand: 2026-08-25. Erledigtes steht in [`ERLEDIGT.md`](./ERLEDIGT.md), nicht hier.

**Store-Stand (zuletzt geprüft 2026-08-17/19, danach nicht erneut verifiziert):**

| | Stand | Danach |
|---|---|---|
| Apple | 1.1, Build 11, `WAITING_FOR_REVIEW` | Freigabe `AFTER_APPROVAL` — geht ohne weiteren Klick live |
| Play | 1.1.0, versionCode 10, Produktionsspur | Verwaltete Veröffentlichung war für 1.0 aus und wurde nicht angefasst — geht nach der Prüfung direkt live |

---

## 1. App-Privacy-Antwort vor der nächsten Apple-Einreichung gegenprüfen

Emulator-Durchgang 2026-08-23 (`docs/archive/EMULATOR-LEXIPULSE-2026-08-23.md`) fand per
Netzwerkmitschnitt und Quelltextprüfung: Die mobilen Apps rufen beim URL-Import die
eingegebene Adresse **direkt vom Gerät** ab (kein `/api/extract` — das nutzt nur die
Web-App). Der Betreiber der fremden Seite sieht dabei die Geräte-IP.
`store/metadata/app-privacy.md` und `store/legal/datenschutz.de.md`/`privacy.en.md` sind
bereits auf diesen tatsächlichen Mechanismus korrigiert. Die Schlussfolgerung „No, we do
not collect data from this app" in App Store Connect dürfte weiter halten (die App selbst
speichert nichts, sie leitet nur technisch weiter wie ein Browser) — das ist aber eine
Rechtseinschätzung, kein Beleg aus App Store Connect selbst.

**Schritte, vor der nächsten Einreichung:**
1. App Store Connect öffnen → App Privacy → Data collection practices.
2. Die dort hinterlegte Antwort mit `store/metadata/app-privacy.md` abgleichen.
3. Prüfen, ob „No, we do not collect data from this app" angesichts des
   Geräte-Direktabrufs weiterhin korrekt ist, oder ob eine Rechtseinschätzung nötig ist.
4. Nur bei Unstimmigkeit ändern — sonst nichts tun.

## 2. Play-Pflichterklärung „Behörden-App" in der Console prüfen

Diese Pflichterklärung wurde hausweit als offen genannt; für LexiPulse gibt es dazu aber
keinen Beleg aus der Play Console selbst — nur einen Hinweis aus einem projektübergreifenden
Audit. Ein Prüfversuch in dieser Sitzung scheiterte an der Chrome-Anmeldung: Das Profil war
bei `salatibox@gmail.com` angemeldet (ein fremdes Projekt-Konto) und leitete auf die
Play-Console-Registrierungsseite um statt auf das LexiPulse-Dashboard.

**Schritte:**
1. In der Play Console mit dem **richtigen** Google-Konto anmelden (nicht `salatibox@gmail.com`).
2. `app-content/overview` für die Play-App-ID `4975711440100028027` öffnen.
3. Status der Pflichterklärung „Behörden-App" ablesen.
4. Nur ausfüllen, falls sie dort tatsächlich als offen markiert ist — sonst nichts tun.

## 3. Entscheiden, ob ein bezahlter EAS-Tarif kommt

Der nächste iOS-Bau in diesem Monat müsste sich wieder ein fremdes Konto leihen; die
Zähler setzen sich am **1. September 2026** von selbst zurück.

Zahlen (`expo.dev/pricing`, Stand 19.08.2026):

| Tarif | Preis | Enthalten | Gleichzeitige Bauten |
|---|---|---|---|
| Free | 0 $ | 15 Android **und** 15 iOS je Monat, je Konto | 1 |
| Starter | 19 $/Monat | 45 $ Bauguthaben, danach nach Verbrauch | 1 (je 50 $ eine mehr) |
| Production | 199 $/Monat | 225 $ Bauguthaben | 2 |

Vier Expo-Konten liegen unter derselben Anmeldung, das Kontingent hängt am Konto, dem das
**Projekt** gehört — macht 4 × 15 = 60 kostenlose iOS-Bauten im Monat. Ein bezahlter Tarif
kauft hier keine zusätzliche Kapazität, sondern nur Ordnung: Das Ausleihen eines fremden
Kontos verlangt jedes Mal, `owner`, `projectId`, Build-Nummer und zwei EAS-Schalter
umzustellen und danach wieder zurückzusetzen (Ablauf: `docs/PLAN_SICHERUNG.md`) — genau
dieser Handgriff hat bei einem anderen Projekt (Salati) 20 Tage stille Fehlschläge erzeugt,
weil Manifest und Konfiguration danach auf verschiedene Projekte zeigten, ohne Fehlermeldung.

**Empfehlung, falls keine lange Abwägung gewünscht:** jetzt nichts kaufen.

**Schritte:**
1. Entscheiden: Free-Tarif behalten (Empfehlung) oder Starter/Production kaufen.
2. Falls vor dem 01.09.2026 ein weiterer iOS-Bau nötig wird: eines der vier eigenen
   Expo-Konten wie gehabt ausleihen, dabei `owner`/`projectId`/Build-Nummer/EAS-Schalter nach
   dem Bau wieder zurücksetzen (siehe `docs/PLAN_SICHERUNG.md`) — nicht vergessen, sonst
   drohen stille Fehlschläge wie bei Salati.
3. Ab 01.09.2026 ist das eigene Kontingent automatisch zurückgesetzt — dann ist ohnehin
   keine Entscheidung mehr nötig, außer bei dauerhaft mehr als 15 iOS-Bauten/Monat am
   **eigenen** Konto.

---

## Kontakt

`lexipulse@domenicmoran.de` (nicht `@menucloud-berlin.de` — diese Regel ist zurückgenommen,
siehe `ERLEDIGT.md`). Belegt in `store/legal/impressum.de.md:26`.

## Ablage

Signaturmaterial liegt unter `C:\Users\domen\Documents\90_Werkstatt\mc-build\lexipulse-ios\`
und `...\lexipulse-android\`; `apps/mobile/credentials.json` zeigt darauf und ist per
`.gitignore` ausgeschlossen.
