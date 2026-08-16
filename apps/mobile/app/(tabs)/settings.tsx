import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACCENT_LABELS,
  OVERLAYS,
  READER_FONTS,
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
import { useAlert } from '../../src/components/alert';
import { language, t } from '../../src/i18n';
import { OVERLAY_LABELS } from '../../src/reader/typography';
import { store } from '../../src/lib/store';
import { useLibrary } from '../../src/state/library';
import { useReader } from '../../src/state/reader';
import { useSettings, useTheme } from '../../src/state/settings';

export default function SettingsScreen() {
  const alert = useAlert();
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
        <SliderRow
          label={t('settings.wpm')}
          value={settings.wpm}
          min={WPM_MIN}
          max={WPM_MAX}
          step={WPM_STEP}
          onChange={(wpm) => update({ wpm })}
        />
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
        <SliderRow
          label={t('settings.fontSize')}
          value={settings.fontSize}
          min={20}
          max={96}
          step={2}
          onChange={(fontSize) => update({ fontSize })}
        />
      </Section>

      {/* ------------------------------------------------------------- page mode */}
      <Section title={t('settings.section.reader')}>
        <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
          <T variant="small" tone="muted">
            {t('settings.reader.font')}
          </T>
          <Segmented
            options={READER_FONTS.map((font) => ({
              value: font,
              label: t(`settings.reader.font.${font}`),
            }))}
            value={settings.readerFont}
            onChange={(readerFont) => update({ readerFont })}
          />
        </View>
        <Divider />
        <SliderRow
          label={t('settings.reader.size')}
          value={settings.readerFontSize}
          min={12}
          max={42}
          step={1}
          onChange={(readerFontSize) => update({ readerFontSize })}
        />
        <Divider />
        <SliderRow
          label={t('settings.reader.lineHeight')}
          value={settings.readerLineHeight}
          display={settings.readerLineHeight.toFixed(2)}
          min={1.1}
          max={2.6}
          step={0.05}
          // A 0.05 step lands on values like 1.7500000000000002; the reader multiplies the
          // line height by the font size, so the noise would reach the layout.
          onChange={(value) => update({ readerLineHeight: Math.round(value * 100) / 100 })}
        />
        <Divider />
        <SliderRow
          label={t('settings.reader.margin')}
          value={settings.readerMargin}
          min={0}
          max={72}
          step={2}
          onChange={(readerMargin) => update({ readerMargin })}
        />
        <Divider />
        <Row
          label={t('settings.reader.justify')}
          hint={t('settings.reader.justify.hint')}
          right={
            <Switch
              value={settings.readerJustify}
              onChange={(readerJustify) => update({ readerJustify })}
            />
          }
        />
        <Divider />
        <Row
          label={t('settings.reader.paged')}
          hint={t('settings.reader.paged.hint')}
          right={
            <Switch
              value={settings.readerPaged}
              onChange={(readerPaged) => update({ readerPaged })}
            />
          }
        />
        <Divider />
        <SliderRow
          label={t('settings.reader.autoScroll')}
          hint={t('settings.reader.autoScroll.hint')}
          value={settings.readerAutoScroll}
          min={0}
          max={200}
          step={5}
          onChange={(readerAutoScroll) => update({ readerAutoScroll })}
        />
      </Section>

      {/* ----------------------------------------------------------- reading aids */}
      <Section title={t('settings.section.reading-aids')}>
        <Stepper
          label={t('settings.reader.bionic')}
          hint={t('settings.reader.bionic.hint')}
          value={settings.readerBionic}
          min={0}
          max={5}
          step={1}
          onChange={(readerBionic) => update({ readerBionic })}
        />
        <Divider />
        <Stepper
          label={t('settings.reader.ruler')}
          hint={t('settings.reader.ruler.hint')}
          value={settings.readerRuler}
          min={0}
          max={3}
          step={1}
          onChange={(readerRuler) => update({ readerRuler })}
        />
        <Divider />
        <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
          <View style={{ gap: 2 }}>
            <T variant="small" tone="muted">
              {t('settings.reader.overlay')}
            </T>
            <T variant="small" tone="faint">
              {t('settings.reader.overlay.hint')}
            </T>
          </View>
          <SegmentedGrid
            options={OVERLAYS.map((overlay) => ({
              value: overlay,
              label: OVERLAY_LABELS[overlay][language],
            }))}
            value={settings.readerOverlay}
            onChange={(readerOverlay) => update({ readerOverlay })}
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
            alert(t('settings.wipe.confirm.title'), t('settings.wipe.confirm.body'), [
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
                    alert(t('settings.wipe.done'));
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

/** A slider with its label and live value, the way every numeric setting is shown. */
function SliderRow({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  /** Overrides the printed value where the raw number is not what the user thinks in. */
  display?: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T>{label}</T>
        <T tone="accent" variant="mono">
          {display ?? value}
        </T>
      </View>
      {hint ? (
        <T variant="small" tone="faint">
          {hint}
        </T>
      ) : null}
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
    </View>
  );
}

/**
 * A segmented control that wraps onto several rows.
 *
 * Segments share the width evenly, so past four options the labels start eliding — the
 * seven colour filters would read as "Pfir…", "Him…". Splitting them across rows keeps
 * every option legible; only the row holding the current value shows a selection.
 */
function SegmentedGrid<Value extends string>({
  options,
  value,
  onChange,
  perRow = 4,
}: {
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (next: Value) => void;
  perRow?: number;
}) {
  const theme = useTheme();
  const rows: { value: Value; label: string }[][] = [];
  for (let index = 0; index < options.length; index += perRow) {
    rows.push(options.slice(index, index + perRow));
  }
  return (
    <View style={{ gap: theme.space[2] }}>
      {rows.map((row) => (
        <Segmented
          key={row.map((option) => option.value).join('|')}
          options={row}
          value={value}
          onChange={onChange}
        />
      ))}
    </View>
  );
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
  const alert = useAlert();
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
        alert(t('settings.export.failed'), String(error));
      } finally {
        setBusy(false);
      }
    })();
  }, [alert]);

  return (
    <Row
      label={t('settings.export')}
      hint={t('settings.export.hint')}
      icon="download-outline"
      onPress={busy ? undefined : onExport}
    />
  );
}
