# Datenschutz-Angaben für die Stores

Ausfüllhilfe für Apple „App Privacy" und Google „Data Safety". Grundlage ist der
tatsächliche Funktionsumfang von LexiPulse.

## Faktenlage, auf der alle Antworten beruhen

- Kein Nutzerkonto, keine Registrierung, kein Login.
- Dokumente, Lesefortschritt, Lesezeichen, Einstellungen und Statistik liegen
  ausschließlich lokal auf dem Gerät (SQLite in der App, IndexedDB in der Web-App).
- Keine Analytics-, Crash- oder Werbe-SDKs. Kein Firebase, kein Google Analytics, kein
  Sentry, kein Facebook SDK, kein AdMob, kein Attributions-SDK.
- Kein Zugriff auf IDFA oder Advertising ID, kein App Tracking Transparency-Prompt
  nötig.
- Der URL-Import ruft `/api/extract` auf dem eigenen Server auf. Die URL wird
  weitergereicht, nicht protokolliert und nicht gespeichert. Es entsteht keine
  Verknüpfung zu einer Person oder einem Gerät.
- Keine Werbung, keine In-App-Käufe, kein Abo. Einmalkauf 4,99 Euro über den Store.

Daraus folgt für beide Fragebögen: **es werden keine Daten erhoben.**

---

## Apple App Store Connect: App Privacy

Pfad: App Store Connect → App auswählen → Seitenleiste **App-Datenschutz** →
**Bearbeiten**.

### Frage 1: „Do you or your third-party partners collect data from this app?"

**Antwort: No, we do not collect data from this app.**

Apple blendet danach alle Datenkategorien aus. Es ist keine weitere Kategorie
auszuwählen.

Wichtig für die Begründung im Review-Fall: Apple definiert „collect" als Übertragung vom
Gerät weg in einer Form, die über die reine Bearbeitung der aktuellen Anfrage hinaus
zugänglich bleibt. Der Aufruf von `/api/extract` fällt nicht darunter, weil die URL nur
für die Dauer der Anfrage verarbeitet und nicht gespeichert wird. Diese Formulierung
steht auch so in der Datenschutzerklärung, sodass Angabe und Text zusammenpassen.

### Weitere Felder auf derselben Seite

| Feld | Wert |
|---|---|
| Privacy Policy URL | https://lexipulse.de/datenschutz |
| Privacy Choices URL | leer lassen, es gibt keine Wahlmöglichkeit zu treffen |

### App Tracking Transparency

Kein `NSUserTrackingUsageDescription` in der Info.plist, kein ATT-Dialog. Die App liest
den IDFA nicht aus und verknüpft keine Daten mit Daten Dritter zu Werbezwecken.

### Privacy Manifest (PrivacyInfo.xcprivacy)

Seit Frühjahr 2024 verlangt Apple ein Privacy Manifest, sobald bestimmte APIs genutzt
werden. Für LexiPulse gilt:

| Eintrag | Wert |
|---|---|
| `NSPrivacyTracking` | `false` |
| `NSPrivacyTrackingDomains` | leeres Array |
| `NSPrivacyCollectedDataTypes` | leeres Array |
| `NSPrivacyAccessedAPITypes` | nur die tatsächlich genutzten Kategorien deklarieren |

Bei `NSPrivacyAccessedAPITypes` typischerweise erforderlich, wenn die genannten APIs im
Build vorkommen:

- `NSPrivacyAccessedAPICategoryFileTimestamp`, Grund `C617.1` (Zugriff nur auf Dateien
  im eigenen App-Container)
- `NSPrivacyAccessedAPICategoryDiskSpace`, Grund `E174.1` (Prüfung vor dem Schreiben
  eines Imports)
- `NSPrivacyAccessedAPICategoryUserDefaults`, Grund `CA92.1` (nur eigene Einstellungen)

Vor der Einreichung im fertigen Build gegenprüfen, welche dieser APIs tatsächlich
vorkommen, und nur die zutreffenden Einträge stehen lassen. Falsch deklarierte Einträge
sind ebenso ein Ablehnungsgrund wie fehlende.

### Altersfreigabe (Age Rating)

Alle Inhaltsfragen mit **None** beantworten. Zusätzlich:

| Frage | Antwort |
|---|---|
| Unrestricted Web Access | **Ja** |
| Gambling | Nein |
| Contests | Nein |

Begründung für „Unrestricted Web Access": Der URL-Import lädt beliebige, von der Nutzerin
oder dem Nutzer gewählte Internetseiten. Auch wenn nur der Textinhalt angezeigt wird,
ist das nach Apples Auslegung uneingeschränkter Webzugriff. Wird diese Frage mit Nein
beantwortet und Apple bemerkt die Funktion, folgt eine Ablehnung nach Guideline 2.3.

---

## Google Play Console: Data safety

Pfad: Play Console → App auswählen → **Richtlinie und Programme** →
**App-Inhalte** → **Datensicherheit**.

### Abschnitt „Datenerhebung und -sicherheit"

| Frage | Antwort |
|---|---|
| Erhebt oder teilt deine App eine der erforderlichen Nutzerdatentypen? | **Nein** |
| Werden alle erhobenen Nutzerdaten bei der Übertragung verschlüsselt? | entfällt, da keine Erhebung. Falls das Feld dennoch erscheint: **Ja** (alle Serveraufrufe laufen ausschließlich über TLS) |
| Können Nutzer die Löschung ihrer Daten beantragen? | **Ja**, Daten können in der App gelöscht werden |
| URL für Löschanfragen | https://lexipulse.de/datenschutz |
| Datenschutzerklärung | https://lexipulse.de/datenschutz |

Wenn „Nein" bei der Erhebung gewählt wird, überspringt die Console den gesamten Katalog
der Datentypen. Keine Kategorie ankreuzen bei: Standort, Personenbezogene Daten,
Finanzinformationen, Gesundheit und Fitness, Nachrichten, Fotos und Videos,
Audiodateien, Dateien und Dokumente, Kalender, Kontakte, App-Aktivitäten, Web-Browsing,
App-Informationen und -Leistung, Geräte- oder andere IDs.

Besonders wichtig: **Dateien und Dokumente nicht ankreuzen.** Die App liest zwar
Dokumente, aber Google fragt ausschließlich nach Erhebung, also nach Übertragung vom
Gerät weg. Lokale Verarbeitung ist ausdrücklich keine Erhebung.

### Abschnitt „Datensicherheitspraktiken"

| Frage | Antwort |
|---|---|
| Verpflichtet sich die App auf die Play Families Policy? | Nein, die App richtet sich nicht an Kinder |
| Unabhängige Sicherheitsprüfung | Nein |

### Weitere Pflichtangaben unter „App-Inhalte"

| Formular | Antwort |
|---|---|
| Anzeigen | **Diese App enthält keine Werbung** |
| Zielgruppe und Inhalte | Altersgruppen ab 13, kein Kinder-Targeting |
| Inhaltsklassifizierung (IARC) | Kategorie „Referenz, Nachrichten oder Bildung". Alle Inhaltsfragen mit Nein. Bei „Nutzer können auf beliebige Websites zugreifen" **Ja** angeben, wegen des URL-Imports |
| Regierungs-App | Nein |
| Finanzfeatures | Keine |
| Gesundheits-App | Nein |
| Datensicherheit | siehe oben |
| Kontokündigung und Datenlöschung | Kein Konto vorhanden. Löschung erfolgt durch Löschen der Dokumente in der App oder Deinstallation |

---

## Konsistenzprüfung vor dem Einreichen

Beide Fragebögen müssen deckungsgleich mit den Rechtstexten sein. Vor jeder Einreichung
prüfen:

1. Steht in `store/legal/datenschutz.de.md` und `store/legal/privacy.en.md` weiterhin,
   dass keine Daten erhoben werden? Wenn die App künftig ein SDK bekommt, das Daten
   überträgt, müssen zuerst die Rechtstexte und dann die Fragebögen geändert werden.
2. Ist die Datenschutz-URL erreichbar und liefert sie Statuscode 200? Apple und Google
   prüfen das automatisiert; eine 404 blockiert die Einreichung.
3. Enthält der Release-Build wirklich kein Analytics- oder Crash-SDK? Vor der
   Einreichung die Abhängigkeitsliste durchsehen. Eine falsche Angabe im Fragebogen ist
   ein Verstoß gegen die Store-Richtlinien und kann zur Entfernung der App führen.
4. Zeigt die App wirklich keine Werbung? Die Antwort „keine Werbung" bei Google gilt
   auch für Eigenwerbung auf andere kostenpflichtige Produkte.
