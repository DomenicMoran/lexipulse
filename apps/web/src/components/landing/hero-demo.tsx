'use client';

import {
  ACCENT_LABELS,
  ACCENTS,
  DEFAULT_SETTINGS,
  RsvpEngine,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  effectiveWpmFor,
  tokenize,
  type AccentName,
  type EngineStatus,
} from '@lexipulse/core';
import { RsvpStage, SegmentedControl, Slider } from '@lexipulse/ui';
import * as React from 'react';
import { useSettings } from '@/components/settings-provider';
import { PauseIcon, PlayIcon } from '@/components/icons';
import { DEMO_MAX_WORD_LENGTH, DEMO_TEXT } from '@/lib/demo-text';
import { formatNumber } from '@/lib/format';
import { useFittedFontSize } from '@/lib/use-fitted-font-size';

const ACCENT_SWATCH: Record<AccentName, string> = {
  coral: '#FF4D4D',
  amber: '#FFB020',
  cyber: '#22E584',
};

/**
 * The live demo in the hero.
 *
 * It runs the shipping `RsvpEngine` over a real German text — not a canned animation.
 * Whatever the visitor sees here, including the pacing at sentence boundaries, is
 * literally what the reader does with their own documents.
 */
export function HeroDemo() {
  const { settings, update } = useSettings();

  const [tokens] = React.useState(
    () =>
      tokenize(DEMO_TEXT, {
        wpm: DEFAULT_SETTINGS.wpm,
        maxWordLength: DEMO_MAX_WORD_LENGTH,
      }).tokens,
  );

  // Lazy state initialiser rather than a ref assigned during render: it runs exactly once
  // and hands back a stable instance, without writing to anything mid-render.
  const [engine] = React.useState(() => new RsvpEngine({ tokens, settings: DEFAULT_SETTINGS }));

  const [index, setIndex] = React.useState(0);
  const [status, setStatus] = React.useState<EngineStatus>('idle');

  const stageRef = React.useRef<HTMLDivElement>(null);
  const fittedSize = useFittedFontSize(stageRef, {
    maxWordLength: DEMO_MAX_WORD_LENGTH,
    min: 22,
    max: 60,
    initial: 46,
  });

  // Engine events drive the render; the animation frame only advances the clock.
  React.useEffect(() => {
    return engine.subscribe((event) => {
      if (event.type === 'token') setIndex(event.index);
      else if (event.type === 'status') setStatus(event.status);
      else if (event.type === 'finish') {
        // The hero loops: a demo that stops on the last word tells a visitor who
        // arrived thirty seconds late nothing at all.
        engine.seek(0);
        engine.play();
      }
    });
  }, [engine]);

  // Derived, not stored: `effectiveWpmFor` computes the rate the stream would run at
  // without touching the tokens, so there is no effect-then-setState round trip and no
  // window in which the number on screen belongs to the previous speed.
  const effective = React.useMemo(
    () => Math.round(effectiveWpmFor(tokens, settings.wpm)),
    [tokens, settings.wpm],
  );

  React.useEffect(() => {
    engine.setWpm(settings.wpm);
  }, [engine, settings.wpm]);

  React.useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0;
    const loop = () => {
      engine.update();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine, status]);

  // Start on its own, but never against an explicit reduced-motion preference, and
  // never while the section is off screen or the tab is in the background.
  const autoStarted = React.useRef(false);
  const autoPaused = React.useRef(false);
  React.useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const reduced =
      settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible) {
          if (!autoStarted.current) {
            autoStarted.current = true;
            engine.play();
          } else if (autoPaused.current) {
            autoPaused.current = false;
            engine.play();
          }
        } else if (engine.getStatus() === 'playing') {
          autoPaused.current = true;
          engine.pause();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [engine, settings.reduceMotion]);

  const token = tokens[index];
  const percent = tokens.length > 1 ? index / (tokens.length - 1) : 0;
  const playing = status === 'playing';

  return (
    <div className="min-w-0 rounded-[20px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-4 sm:p-6">
      <div
        ref={stageRef}
        onClick={() => engine.toggle()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            engine.toggle();
          }
        }}
        aria-label={playing ? 'Demo pausieren' : 'Demo abspielen'}
        className="flex h-[168px] w-full min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-[14px] bg-[var(--lx-stage)] sm:h-[196px]"
      >
        <RsvpStage
          text={token?.text ?? ''}
          orp={token?.orp ?? 0}
          fontSize={fittedSize}
          maxWordLength={DEMO_MAX_WORD_LENGTH}
          showFocusGuides={settings.showFocusGuides}
        />
      </div>

      <div
        className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-[var(--lx-border)]"
        role="progressbar"
        aria-label="Fortschritt der Demo"
        aria-valuenow={Math.round(percent * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[var(--lx-accent)]"
          style={{ width: `${percent * 100}%` }}
        />
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
        <button
          type="button"
          onClick={() => engine.toggle()}
          aria-label={playing ? 'Demo pausieren' : 'Demo abspielen'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--lx-accent)] text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
        >
          {playing ? <PauseIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
        </button>

        <Slider
          className="flex-1"
          label="Tempo"
          min={WPM_MIN}
          max={WPM_MAX}
          step={WPM_STEP}
          value={settings.wpm}
          valueLabel={`${formatNumber(settings.wpm)} WPM`}
          onValueChange={(value) => update({ wpm: value })}
        />

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-[var(--lx-text-muted)]">Akzent</span>
          <SegmentedControl<AccentName>
            label="Akzentfarbe"
            value={settings.accent}
            options={ACCENTS.map((accent) => ({
              value: accent,
              title: ACCENT_LABELS[accent],
              label: (
                <span
                  className="block h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: ACCENT_SWATCH[accent] }}
                />
              ),
            }))}
            onValueChange={(accent) => update({ accent })}
          />
        </div>
      </div>

      <p className="mt-4 text-[13px] text-[var(--lx-text-muted)]">
        Effektiv{' '}
        <span className="font-mono tabular-nums text-[var(--lx-text-muted)]">
          {formatNumber(effective)}
        </span>{' '}
        WPM — die Pausen an Satz- und Absatzenden sind eingerechnet.
      </p>
    </div>
  );
}
