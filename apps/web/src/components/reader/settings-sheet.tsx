'use client';

import {
  ACCENT_LABELS,
  ACCENTS,
  FONT_LABELS,
  FONTS,
  SPEED_PRESETS,
  THEME_LABELS,
  THEMES,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  applyPreset,
  type AccentName,
  type FontKey,
  type ThemeName,
} from '@lexipulse/core';
import { Divider, IconButton, SegmentedControl, Slider, Stepper, Switch } from '@lexipulse/ui';
import * as React from 'react';
import { CloseIcon } from '@/components/icons';
import { useSettings } from '@/components/settings-provider';
import { formatNumber } from '@/lib/format';
import { speechSupported, useVoices } from '@/lib/tts';

const ACCENT_SWATCH: Record<AccentName, string> = {
  coral: '#FF4D4D',
  amber: '#FFB020',
  cyber: '#22E584',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-mono text-[11px] tracking-[0.08em] text-[var(--lx-text-muted)] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-[var(--lx-text-muted)]">{label}</span>
      {children}
    </div>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  const voices = useVoices();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const activePreset = SPEED_PRESETS.find(
    (preset) => preset.wpm === settings.wpm && preset.warmupTokens === settings.warmupTokens,
  );

  return (
    <div
      // Marker for the store-screenshot driver; see the note in reader-app.tsx.
      data-lexipulse-screen="04-settings"
      className="fixed inset-0 z-50 flex justify-end bg-[var(--lx-overlay)]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lx-settings-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-[26rem] flex-col overflow-y-auto border-l border-[var(--lx-border)] bg-[var(--lx-surface)] outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--lx-border)] bg-[var(--lx-surface)] px-5 py-4">
          <h2 id="lx-settings-title" className="text-[17px] font-semibold tracking-[-0.015em]">
            Einstellungen
          </h2>
          <IconButton label="Einstellungen schließen" variant="ghost" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="flex flex-col gap-8 px-5 py-6">
          <Section title="Tempo">
            <Field label="Voreinstellung">
              <div className="flex flex-wrap gap-1.5">
                {SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.description}
                    onClick={() => update(applyPreset(settings, preset.id))}
                    className={
                      'rounded-[8px] border px-3 py-1.5 text-[13px] transition-colors duration-140 ' +
                      (activePreset?.id === preset.id
                        ? 'border-[var(--lx-accent)] bg-[var(--lx-accent-soft)] text-[var(--lx-text)]'
                        : 'border-[var(--lx-border)] text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]')
                    }
                  >
                    {preset.label}{' '}
                    <span className="font-mono tabular-nums">{preset.wpm}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Slider
              label="Wörter pro Minute"
              min={WPM_MIN}
              max={WPM_MAX}
              step={WPM_STEP}
              value={settings.wpm}
              valueLabel={formatNumber(settings.wpm)}
              onValueChange={(wpm) => update({ wpm })}
            />

            <Slider
              label="Warm-up-Rampe"
              min={0}
              max={40}
              step={1}
              value={settings.warmupTokens}
              valueLabel={
                settings.warmupTokens === 0 ? 'aus' : `${settings.warmupTokens} Wörter`
              }
              onValueChange={(warmupTokens) => update({ warmupTokens })}
            />

            <Stepper
              label="Rewind-Distanz"
              min={1}
              max={50}
              step={1}
              value={settings.rewindTokens}
              format={(value) => `${value} W.`}
              onValueChange={(rewindTokens) => update({ rewindTokens })}
            />

            <Switch
              label="Am Absatzende pausieren"
              description="Der Strom hält nach jedem Absatz an."
              checked={settings.pauseOnParagraph}
              onCheckedChange={(pauseOnParagraph) => update({ pauseOnParagraph })}
            />
          </Section>

          <Divider />

          <Section title="Darstellung">
            <Field label="Theme">
              <SegmentedControl<ThemeName>
                className="flex-wrap"
                label="Theme"
                value={settings.theme}
                options={THEMES.map((theme) => ({ value: theme, label: THEME_LABELS[theme] }))}
                onValueChange={(theme) => update({ theme })}
                size="sm"
              />
            </Field>

            <Field label="Akzent">
              <SegmentedControl<AccentName>
                label="Akzentfarbe"
                value={settings.accent}
                options={ACCENTS.map((accent) => ({
                  value: accent,
                  title: ACCENT_LABELS[accent],
                  label: (
                    <span className="flex items-center gap-2">
                      <span
                        className="block h-3 w-3 rounded-full"
                        style={{ backgroundColor: ACCENT_SWATCH[accent] }}
                      />
                      {ACCENT_LABELS[accent]}
                    </span>
                  ),
                }))}
                onValueChange={(accent) => update({ accent })}
                size="sm"
              />
            </Field>

            <Field label="Schriftart im Player">
              <select
                aria-label="Schriftart im Player"
                value={settings.fontFamily}
                onChange={(event) => update({ fontFamily: event.target.value as FontKey })}
                className="h-9 rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-bg)] px-2 text-[14px] text-[var(--lx-text)]"
              >
                {FONTS.map((font) => (
                  <option key={font} value={font}>
                    {FONT_LABELS[font]}
                  </option>
                ))}
              </select>
            </Field>

            <Slider
              label="Schriftgröße"
              min={20}
              max={120}
              step={2}
              value={settings.fontSize}
              valueLabel={`${settings.fontSize} px`}
              onValueChange={(fontSize) => update({ fontSize })}
            />

            <Stepper
              label="Kontextwörter"
              min={0}
              max={4}
              step={1}
              value={settings.contextWords}
              format={(value) => (value === 0 ? 'aus' : String(value))}
              onValueChange={(contextWords) => update({ contextWords })}
            />

            <Switch
              label="Fokuslinien"
              description="Zwei Haarlinien markieren die Spalte des Erkennungspunkts."
              checked={settings.showFocusGuides}
              onCheckedChange={(showFocusGuides) => update({ showFocusGuides })}
            />

            <Switch
              label="Fortschrittsbalken"
              checked={settings.showProgress}
              onCheckedChange={(showProgress) => update({ showProgress })}
            />

            <Switch
              label="Live-Werte"
              description="Restzeit, effektives Tempo und Wortposition unter dem Player."
              checked={settings.showStats}
              onCheckedChange={(showStats) => update({ showStats })}
            />
          </Section>

          <Divider />

          <Section title="Ton und Sprache">
            <Switch
              label="Klick am Satzende"
              checked={settings.soundEnabled}
              onCheckedChange={(soundEnabled) => update({ soundEnabled })}
            />

            <Switch
              label="Vorlesen"
              description={
                speechSupported()
                  ? 'Die Sprachausgabe Ihres Systems liest jeden Satz mit.'
                  : 'Dieser Browser bietet keine Sprachausgabe an.'
              }
              disabled={!speechSupported()}
              checked={settings.ttsEnabled}
              onCheckedChange={(ttsEnabled) => update({ ttsEnabled })}
            />

            {settings.ttsEnabled && (
              <Field label="Stimme">
                <select
                  aria-label="Stimme für die Vorlesefunktion"
                  value={settings.ttsVoice ?? ''}
                  onChange={(event) =>
                    update({ ttsVoice: event.target.value === '' ? null : event.target.value })
                  }
                  className="h-9 rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-bg)] px-2 text-[14px] text-[var(--lx-text)]"
                >
                  <option value="">Systemstandard</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Section>

          <Divider />

          <Section title="Gerät und Bewegung">
            <Switch
              label="Bildschirm wach halten"
              description="Verhindert das Abdunkeln während der Wiedergabe, sofern der Browser es erlaubt."
              checked={settings.keepAwake}
              onCheckedChange={(keepAwake) => update({ keepAwake })}
            />

            <Switch
              label="Reduzierte Bewegung"
              description="Schaltet Übergänge ab und startet die Demo nicht automatisch."
              checked={settings.reduceMotion}
              onCheckedChange={(reduceMotion) => update({ reduceMotion })}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
