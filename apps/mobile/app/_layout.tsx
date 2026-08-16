import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlertProvider } from '../src/components/alert';
import { t } from '../src/i18n';
import { PdfBridgeProvider } from '../src/pdf/bridge';
import { LibraryProvider } from '../src/state/library';
import { ReaderProvider } from '../src/state/reader';
import { SettingsProvider, useSettings } from '../src/state/settings';
import { MONO_BOLD, MONO_REGULAR } from '../src/theme';

// The splash stays up until the settings are read and the font is registered. Painting
// the library in the default theme first and then repainting it in the user's theme is
// the kind of flash that makes an app feel unfinished.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // These keys are the family names the player uses. Registering them here rather than
    // through native font embedding is what keeps the name identical on both platforms —
    // and the ORP column depends on actually getting the monospace face.
    [MONO_REGULAR]: require('../assets/fonts/JetBrainsMono-Regular.ttf') as number,
    [MONO_BOLD]: require('../assets/fonts/JetBrainsMono-Bold.ttf') as number,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <LibraryProvider>
            <ReaderProvider>
              <PdfBridgeProvider>
                <AlertProvider>
                  <Shell ready={fontsLoaded || fontError !== null} />
                </AlertProvider>
              </PdfBridgeProvider>
            </ReaderProvider>
          </LibraryProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell({ ready }: { ready: boolean }) {
  const { theme, loading, settings } = useSettings();
  const canShow = ready && !loading;
  // "Reduced motion" has to mean the whole app, not just the one component that happens
  // to animate — screen transitions are the largest movement in it.
  const animation = settings.reduceMotion ? 'none' : 'fade';

  // The window background has to match the theme too, or a fast scroll reveals a white
  // strip behind the list on Android.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => undefined);
  }, [theme.colors.bg]);

  const onLayout = useCallback(() => {
    if (canShow) void SplashScreen.hideAsync().catch(() => undefined);
  }, [canShow]);

  // Not `null`: an empty tree lets the window's own white background show through, which
  // reads as a broken app on a cold start. A themed plate is indistinguishable from the
  // splash screen it replaces.
  if (!canShow) return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }} onLayout={onLayout}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="import"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('import.title'),
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.text,
          }}
        />
      </Stack>
    </View>
  );
}
