/**
 * Strips manifest entries that dependencies add silently.
 *
 * `android.blockedPermissions` in app.config only removes `<uses-permission>` nodes that
 * Expo itself knows about; a library's own AndroidManifest.xml is merged by Gradle later
 * and slips past it. Marking the node `tools:node="remove"` makes the merger drop it for
 * good — which is what the store listing "no permissions" has to be able to claim.
 *
 * It also turns off `allowBackup`: the reading database is the user's whole library and
 * the product promise is that it never leaves the device, auto-backup included.
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/** Permissions no LexiPulse feature uses, regardless of which dependency declares them. */
const REMOVE = [
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.CAMERA',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'com.google.android.gms.permission.AD_ID',
  // expo-audio brings these in for lock-screen media controls. LexiPulse plays a 28 ms
  // click and sets `shouldPlayInBackground: false`, so the service is never started —
  // and a declared foreground service costs a separate Play Console justification.
  // If background playback is ever added, these two have to come back.
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

/** Services declared by dependencies that nothing in this app ever starts. */
const REMOVE_SERVICES = ['expo.modules.audio.service.AudioControlsService'];

const withLeanManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const kept = (manifest['uses-permission'] ?? []).filter(
      (node) => !REMOVE.includes(node.$['android:name']),
    );
    manifest['uses-permission'] = [
      ...kept,
      ...REMOVE.map((name) => ({
        $: { 'android:name': name, 'tools:node': 'remove' },
      })),
    ];

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = 'false';

    const services = (application.service ?? []).filter(
      (node) => !REMOVE_SERVICES.includes(node.$['android:name']),
    );
    application.service = [
      ...services,
      ...REMOVE_SERVICES.map((name) => ({
        $: { 'android:name': name, 'tools:node': 'remove' },
      })),
    ];

    return cfg;
  });

module.exports = withLeanManifest;
