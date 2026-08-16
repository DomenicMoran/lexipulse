import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACCENT_LABELS,
  SPEED_PRESETS,
  THEME_LABELS,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  applyPreset,
  type AccentName,
  type ThemeName,
} from '@lexipulse/core';

import {
  Divider,
  Row,
  Screen,
  ScreenTitle,
  Section,
  Segmented,
  Slider,
  Switch,
  T,
} from '../../src/components/ui';
import { t } from '../../src/i18n';
import { store } from '../../src/lib/store';
import { useLibrary } from '../../src/state/library';
import { useReader } from '../../src/state/reader';
import { useSettings, useTheme } from '../../src/state/settings';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update, replace, reset } = useSettings();
  const { refresh } = useLibrary();
  const { close } = useReader();

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.space[4] }}>
      <ScreenTitle>{t('settings.title')}</ScreenTitle>

      {/* ------------------------------------------------------------------ speed */}
      <Section title={t('settings.section.speed')}>
        <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T>{t('settings.wpm')}</T>
            <T tone="accent" variant="mono">
              {settings.wpm}
            </T>
          </View>
          <Slider
            value={settings.wpm}
            min={WPM_MIN}
            max={WPM_MAX}
            step={WPM_STEP}
            onChange={(wpm) => update({ wpm })}
          />
        </View>
        <Divider />
        <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
          <T variant="small" tone="muted">
            {t('settings.presets')}
          </T>
          <Segmented
            options={SPEED_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
            value={activePreset(settings.wpm)}
            onChange={(id) => replace(applyPreset(settings, id))}
          />
        </View>
        <Divider />
        <Stepper
          label={t('settings.warmup')}
          hint={t('settings.warmup.hint')}
          value={settings.warmupTokens}
          min={0}
          max={40}
          step={2}
          onChange={(warmupTokens) => update({ warmupTokens })}
        />
        <Divider />
        <Stepper
          label={t('settings.rewind')}
          hint={t('settings.rewind.hint')}
          value={settings.rewindTokens}
          min={1}
          max={50}
          step={1}
          onChange={(rewindTokens) => update({ rewindTokens })}
        />
        <Divider />
        <Row
          label={t('settings.pauseOnParagraph')}
          hint={t('settings.pauseOnParagraph.hint')}
          right={
            <Switch
              value={settings.pauseOnParagraph}
              onChange={(pauseOnParagraph) => update({ pauseOnParagraph })}
            />
          }
        />
      </Section>

      {/* ------------------------------------------------------------- appearance */}
      <Section title={t('settings.section.appearance')}>
        <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
          <T variant="small" tone="muted">
            {t('settings.theme')}
          </T>
          <Segmented
            options={(Object.keys(THEME_LABELS) as ThemeName[]).map((name) => ({
              value: name,
              label: THEME_LABELS[name],
            }))}
            value={settings.theme}
            onChange={(themeName) => update({ theme: themeName })}
          />
        </View>
        <Divider />
        <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
          <T variant="small" tone="muted">
            {t('settings.accent')}
          </T>
          <Segmented
            options={(Object.keys(ACCENT_LABELS) as AccentName[]).map((name) => ({
              value: name,
              label: ACCENT_LABELS[name],
            }))}
            value={settings.accent}
            onChange={(accent) => update({ accent })}
          />
        </View>
        <Divider />
        <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T>{t('settings.fontSize')}</T>
            <T tone="accent" variant="mono">
              {settings.fontSize}
            </T>
          </View>
          <Slider
            value={settings.fontSize}
            min={20}
            max={96}
            step={2}
            onChange={(fontSize) => update({ fontSize })}
          />
        </View>
      </Section>

      {/* ----------------------------------------------------------------- player */}
      <Section title={t('settings.section.player')}>
        <Row
          label={t('settings.focusGuides')}
          hint={t('settings.focusGuides.hint')}
          right={
            <Switch
              value={settings.showFocusGuides}
              onChange={(showFocusGuides) => update({ showFocusGuides })}
            />
          }
        />
        <Divider />
        <Stepper
          label={t('settings.contextWords')}
          hint={t('settings.contextWords.hint')}
          value={settings.contextWords}
          min={0}
          max={4}
          step={1}
          onChange={(contextWords) => update({ contextWords })}
        />
        <Divider />
        <Row
          label={t('settings.showProgress')}
          right={
            <Switch
              value={settings.showProgress}
              onChange={(showProgress) => update({ showProgress })}
            />
          }
        />
        <Divider />
        <Row
          label={t('settings.showStats')}
          right={
            <Switch value={settings.showStats} onChange={(showStats) => update({ showStats })} />
          }
        />
        <Divider />
        <Row
          label={t('settings.reduceMotion')}
          hint={t('settings.reduceMotion.hint')}
          right={
            <Switch
              value={settings.reduceMotion}
              onChange={(reduceMotion) => update({ reduceMotion })}
            />
          }
        />
        <Divider />
        <Row
          label={t('settings.keepAwake')}
          hint={t('settings.keepAwake.hint')}
          right={
            <Switch value={settings.keepAwake} onChange={(keepAwake) => update({ keepAwake })} />
          }
        />
      </Section>

      {/* ------------------------------------------------------------------ audio */}
      <Section title={t('settings.section.audio')}>
        <Row
          label={t('settings.sound')}
          right={
            <Switch
              value={settings.soundEnabled}
              onChange={(soundEnabled) => update({ soundEnabled })}
            />
          }
        />
        <Divider />
        <Row
          label={t('settings.tts')}
          hint={t('settings.tts.hint')}
          right={
            <Switch value={settings.ttsEnabled} onChange={(ttsEnabled) => update({ ttsEnabled })} />
          }
        />
        {settings.ttsEnabled ? (
          <>
            <Divider />
            <VoicePicker
              value={settings.ttsVoice}
              onChange={(ttsVoice) => update({ ttsVoice })}
            />
          </>
        ) : null}
      </Section>

      {/* ------------------------------------------------------------------- data */}
      <Section title={t('settings.section.data')}>
        <ExportRow />
        <Divider />
        <Row
          label={t('settings.wipe')}
          hint={t('settings.wipe.hint')}
          icon="trash-outline"
          danger
          onPress={() => {
            Alert.alert(t('settings.wipe.confirm.title'), t('settings.wipe.confirm.body'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    close();
                    await store.clearAll();
                    reset();
                    await refresh();
                    Alert.alert(t('settings.wipe.done'));
                  })();
                },
              },
            ]);
          }}
        />
      </Section>

      {/* ------------------------------------------------------------------ about */}
      <Section title={t('settings.section.about')}>
        <View style={{ padding: theme.space[4], gap: theme.space[1] }}>
          <T tone="muted">{t('settings.about.privacy')}</T>
          <T tone="muted">{t('settings.about.offline')}</T>
          <T variant="small" tone="faint" style={{ marginTop: theme.space[2] }}>
            {t('settings.about.version', {
              version: Constants.expoConfig?.version ?? '1.0.0',
            })}
          </T>
        </View>
        <Divider />
        <Row
          label={t('settings.about.website')}
          icon="globe-outline"
          onPress={() => void WebBrowser.openBrowserAsync('https://lexipulse.de')}
        />
      </Section>
    </Screen>
  );
}

/** Which preset the current WPM corresponds to, for the segmented control. */
function activePreset(wpm: number): string {
  let closest = SPEED_PRESETS[0]?.id ?? 'read';
  let distance = Number.POSITIVE_INFINITY;
  for (const preset of SPEED_PRESETS) {
    const delta = Math.abs(preset.wpm - wpm);
    if (delta < distance) {
      distance = delta;
      closest = preset.id;
    }
  }
  return closest;
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const theme = useTheme();
  return (
    <Row
      label={label}
      hint={hint}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
          <StepButton label="−" onPress={() => onChange(Math.max(min, value - step))} />
          <T variant="mono" style={{ minWidth: 28, textAlign: 'center' }}>
            {value}
          </T>
          <StepButton label="+" onPress={() => onChange(Math.min(max, value + step))} />
        </View>
      }
    />
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        borderWidth: theme.hairline,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.bg,
      })}
    >
      <Text style={{ color: theme.colors.text, fontSize: 18, lineHeight: 20 }}>{label}</Text>
    </Pressable>
  );
}

function VoicePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (voice: string | null) => void;
}) {
  const theme = useTheme();
  const [voices, setVoices] = useState<Speech.Voice[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = await Speech.getAvailableVoicesAsync().catch(() => []);
      if (cancelled) return;
      // The list can run to a hundred entries; the user's own languages come first
      // because those are the ones that will actually be understandable.
      setVoices(available.slice(0, 40));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (voices.length === 0) {
    return <Row label={t('settings.ttsVoice')} hint={t('settings.ttsVoice.none')} />;
  }

  return (
    <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
      <T variant="small" tone="muted">
        {t('settings.ttsVoice')}
      </T>
      <Row
        label={t('settings.ttsVoice.system')}
        icon={value === null ? 'radio-button-on' : 'radio-button-off'}
        onPress={() => onChange(null)}
      />
      {voices.map((voice) => (
        <Row
          key={voice.identifier}
          label={`${voice.name} · ${voice.language}`}
          icon={value === voice.identifier ? 'radio-button-on' : 'radio-button-off'}
          onPress={() => onChange(voice.identifier)}
        />
      ))}
    </View>
  );
}

/** GDPR Art. 20: the whole library, progress and stats as one JSON file. */
function ExportRow() {
  const [busy, setBusy] = useState(false);

  const onExport = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const json = await store.exportAll();
        const file = new FileSystem.File(
          FileSystem.Paths.cache,
          `lexipulse-export-${new Date().toISOString().slice(0, 10)}.json`,
        );
        if (file.exists) file.delete();
        file.create();
        file.write(json);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/json',
            dialogTitle: t('settings.export'),
            UTI: 'public.json',
          });
        }
      } catch (error) {
        Alert.alert(t('settings.export.failed'), String(error));
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <Row
      label={t('settings.export')}
      hint={t('settings.export.hint')}
      icon="download-outline"
      onPress={busy ? undefined : onExport}
    />
  );
}
