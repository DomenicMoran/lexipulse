import type { ExpoConfig } from 'expo/config';

/**
 * LexiPulse mobile.
 *
 * The app is deliberately permission-free: it reads files the user hands it through the
 * system document picker (which needs no permission of its own) and stores everything in
 * its own sandbox. Every Expo module that ships a permission we do not use is stripped
 * again in `plugins/with-lean-manifest.js`.
 */
const config: ExpoConfig = {
  name: 'LexiPulse',
  slug: 'lexipulse',
  owner: 'menucloudberlin',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'lexipulse',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  // No `newArchEnabled` flag either: SDK 57 removed it because the New Architecture is
  // the only architecture. Setting it would now be a config error, not a no-op.
  primaryColor: '#FF4D4D',
  // Native only. The web reader is a separate Next.js app that shares the engine but not
  // the UI, so pulling react-native-web in here would ship a second, worse web build —
  // and `expo export --platform all` would fail on a dependency nothing needs.
  platforms: ['ios', 'android'],
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'de.lexipulse.app',
    // No `buildNumber`: `eas.json` sets appVersionSource to remote, so EAS owns the
    // build number. A value here would be ignored by the build and still show up in
    // `Constants.expoConfig`, which is exactly how a wrong version ends up on a screen.
    // Read `Application.nativeBuildVersion` at runtime instead.
    // No tablet-specific layout exists, so claiming iPad support would ship a stretched
    // phone UI — App Review rejects exactly that.
    supportsTablet: false,
    icon: './assets/icon.png',
    infoPlist: {
      // The player is a full-screen reading surface; the home indicator competes with it.
      UIStatusBarStyle: 'UIStatusBarStyleLightContent',
      ITSAppUsesNonExemptEncryption: false,
      CFBundleLocalizations: ['de', 'en'],
      CFBundleDevelopmentRegion: 'de',
      // "Open with LexiPulse" for a backup file sitting in Files, iCloud or Dropbox.
      // Viewer, not Editor: the app reads the file once and never writes back into it,
      // and Editor would make iOS offer LexiPulse as a place to save JSON.
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'LexiPulse backup',
          CFBundleTypeRole: 'Viewer',
          LSItemContentTypes: ['public.json'],
          // Alternate rather than Owner: `public.json` is a system type LexiPulse does
          // not own, and claiming Owner would make it the default handler for every
          // JSON file on the device.
          LSHandlerRank: 'Alternate',
        },
      ],
    },
  },
  android: {
    package: 'de.lexipulse.app',
    // No `versionCode` — see the note on iOS `buildNumber` above.
    // No `edgeToEdgeEnabled` flag: SDK 57 dropped it because edge-to-edge is now always
    // on, which is why every screen pads itself with `useSafeAreaInsets`.
    predictiveBackGestureEnabled: false,
    /*
     * "Open with LexiPulse" for a backup file in a file manager or a cloud app.
     *
     * Only `content`. Since API 24 an app that hands out a `file://` URI to another app
     * throws FileUriExposedException, so nothing on a current Android sends one; the
     * scheme would only make LexiPulse appear in the chooser for files it then cannot
     * read, because the app deliberately holds no storage permission. A chooser entry
     * that always ends in "not a backup" is worse than no entry.
     *
     * `application/json` only, for the same reason: several providers report an unknown
     * type for a `.json` file, but claiming `application/octet-stream` would offer
     * LexiPulse for every unrecognised binary on the device. Those files still reach the
     * app through Settings, where the picker does accept the wider list.
     */
    intentFilters: [
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [{ scheme: 'content', mimeType: 'application/json' }],
      },
    ],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
    },
    // VIBRATE is the only one we actually use (long-press bookmark confirmation). It is
    // a normal permission, so it never prompts. Everything a dependency drags in is
    // blocked below and verified against the generated manifest.
    permissions: ['android.permission.VIBRATE'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.CAMERA',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-web-browser',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    ],
    // JetBrains Mono is loaded through `useFonts()` rather than the expo-font config
    // plugin on purpose: native embedding derives the family name from the file name on
    // Android and from the PostScript name on iOS. A mismatch would silently fall back to
    // a proportional face, and with a proportional face the ORP column drifts — which is
    // the one thing the player cannot survive. `useFonts` names the family explicitly and
    // identically on both platforms; the TTF is still bundled, nothing is fetched.
    [
      'expo-audio',
      {
        // We only ever play a 40 ms click. Declining the microphone here keeps
        // NSMicrophoneUsageDescription out of Info.plist.
        microphonePermission: false,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // Backups would sync the reading database to Google servers — the product
          // promise is that nothing leaves the device.
          usesCleartextTraffic: false,
          // R8 off is the Expo default, and it costs twice: five dex files instead of
          // two, and Play warning that the bundle ships no mapping file. With minify on
          // the mapping file rides along inside the bundle, so crash reports stay
          // readable. Resource shrinking only runs when minify does; the plugin refuses
          // the combination otherwise.
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          // R8 reaches these three only through reflection or JNI, so it cannot see the
          // reference and would strip them. The failure is a release-only crash, which
          // is exactly the kind that ships. `proguard-rules.pro` is regenerated by
          // prebuild, so the rules live here rather than in the file.
          extraProguardRules: [
            // Native modules are looked up by class name from C++.
            '-keep class expo.modules.** { *; }',
            '-keep class com.facebook.react.turbomodule.** { *; }',
            '-keep class com.facebook.jni.** { *; }',
            // Worklets are compiled to classes Reanimated resolves at runtime.
            '-keep class com.swmansion.reanimated.** { *; }',
            '-keep class com.swmansion.worklets.** { *; }',
          ].join('\n'),
        },
        // No iOS deployment target override: SDK 57's floor is already 16.4, and pinning
        // it here would only mean a second place to update.
      },
    ],
    './plugins/with-lean-manifest.js',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },
  /*
   * Written by hand: `eas init` cannot edit a TypeScript config, so it prints the id and
   * stops. The project lives at expo.dev/accounts/menucloudberlin/projects/lexipulse.
   *
   * There is deliberately no `updates` block and no `expo-updates` dependency. Over-the-air
   * updates would have the app contact Expo's servers on every launch, and the privacy
   * policy states that the only network call the app ever makes is the URL import the
   * user starts themselves. Shipping a fix through the stores is slower; saying something
   * untrue about where the data goes is worse.
   */
  extra: {
    eas: {
      projectId: '5aebaf91-fab9-4402-8b53-1a30052c9f14',
    },
  },
};

export default config;
