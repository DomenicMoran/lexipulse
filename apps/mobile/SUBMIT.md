# Einreichen

Das EAS-Projekt ist `@menucloudberlin/lexipulse`
(`5aebaf91-fab9-4402-8b53-1a30052c9f14`).

## Bauen

```bash
cd apps/mobile
pnpm exec eas build --platform android --profile preview     # APK zum Ausprobieren
pnpm exec eas build --platform all --profile production      # AAB + IPA für die Stores
```

`appVersionSource` steht auf `remote`: `versionCode` und `buildNumber` zählt EAS hoch,
`version` (1.0.0) steht in `app.config.ts`.

**Achtung beim Auslesen zur Laufzeit:** Mit `appVersionSource: remote` zeigt
`Constants.expoConfig.ios.buildNumber` weiterhin den Wert aus der Config, nicht die
Nummer, die EAS tatsächlich vergeben hat. Für eine Anzeige im UI gehört
`Application.nativeBuildVersion` aus `expo-application` genommen.

## Einreichen

```bash
pnpm exec eas submit --platform android --profile production
pnpm exec eas submit --platform ios --profile production --apple-team-id <TEAM_ID>
```

Die Apple Team ID steht bewusst **nicht** in `eas.json`, weil dieses Repository
öffentlich ist. Sie liegt in den `.env`-Dateien der anderen Projekte
(`APPLE_TEAM_ID`) und wird als Flag übergeben oder beim interaktiven Lauf abgefragt.

Für Google Play braucht `eas submit` einen Service-Account-Schlüssel. Der gehört
ebenfalls nicht ins Repository; hinterlege ihn über `eas credentials` oder gib den Pfad
mit `--service-account-key-path` an.

## Erste Einreichung

Beide Stores verlangen den App-Eintrag, bevor `eas submit` etwas hochladen kann. Die
Schritte dafür stehen in `USER-TODO.md`, die fertigen Texte in `store/metadata/`.

Reihenfolge, die funktioniert:

1. App-Eintrag in App Store Connect bzw. Play Console anlegen, Preis 4,99 € setzen
2. `eas build --platform all --profile production`
3. `eas submit` für beide Plattformen
4. Metadaten, Screenshots und die Datenschutz-Angaben aus `store/` eintragen
5. Zur Prüfung einreichen
