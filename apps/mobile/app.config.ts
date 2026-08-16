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
    buildNumber: '1',
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
    },
  },
  android: {
    package: 'de.lexipulse.app',
    versionCode: 1,
    // No `edgeToEdgeEnabled` flag: SDK 57 dropped it because edge-to-edge is now always
    // on, which is why every screen pads itself with `useSafeAreaInsets`.
    predictiveBackGestureEnabled: false,
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
};

export default config;
