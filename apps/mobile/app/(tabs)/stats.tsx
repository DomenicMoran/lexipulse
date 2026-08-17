import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayKey, goalProgress, type ReadingStats } from '@lexipulse/core';

import { Card, EmptyState, Screen, ScreenTitle, T } from '../../src/components/ui';
import { formatHuman, formatNumber, t } from '../../src/i18n';
import { initStore, store } from '../../src/lib/store';
import { useSettings, useTheme } from '../../src/state/settings';

/** Six months is what fits a phone width at a legible cell size. */
const WEEKS = 26;
const DAY_MS = 86_400_000;

export default function StatsScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<ReadingStats | null>(null);

  // Reading happens on another tab, so the numbers have to be re-read on focus rather
  // than once on mount.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        await initStore();
        const next = await store.getStats();
        if (!cancelled) setStats(next);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!stats) return <Screen contentStyle={{ paddingTop: insets.top + theme.space[4] }} />;

  const hasData = stats.totalTokensRead > 0;

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.space[4] }}>
      <ScreenTitle>{t('stats.title')}</ScreenTitle>

      {!hasData ? (
        <EmptyState icon="stats-chart-outline" title={t('stats.empty')} body={t('library.empty.body')} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: theme.space[3], marginBottom: theme.space[3] }}>
            <Tile label={t('stats.words')} value={formatNumber(stats.totalTokensRead)} />
            <Tile label={t('stats.time')} value={formatHuman(stats.totalMsRead)} />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.space[3], marginBottom: theme.space[3] }}>
            <Tile label={t('stats.avgWpm')} value={formatNumber(stats.averageWpm)} accent />
            <Tile
              label={t('stats.streak')}
              value={
                stats.streakDays === 1
                  ? t('stats.streakDay')
                  : t('stats.streakDays', { count: stats.streakDays })
              }
            />
          </View>

          {settings.dailyGoalWords > 0 ? (
            <GoalCard daily={stats.daily} goal={settings.dailyGoalWords} />
          ) : null}

          <Card style={{ padding: theme.space[4], marginBottom: theme.space[3] }}>
            <T variant="label" tone="faint">
              {t('stats.documents')}
            </T>
            <T variant="title" style={{ marginTop: theme.space[2] }}>
              {t('stats.documentsValue', {
                finished: stats.documentsFinished,
                started: stats.documentsStarted,
              })}
            </T>
          </Card>

          <Heatmap daily={stats.daily} />
        </>
      )}
    </Screen>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const theme = useTheme();
  return (
    <Card style={{ flex: 1, padding: theme.space[4] }}>
      <T variant="label" tone="faint">
        {label}
      </T>
      <T
        variant="display"
        tone={accent ? 'accent' : 'default'}
        numberOfLines={1}
        style={{ marginTop: theme.space[2] }}
      >
        {value}
      </T>
    </Card>
  );
}

/**
 * Activity heatmap.
 *
 * Columns are weeks, rows are weekdays, and the intensity is that day's word count
 * relative to the busiest day in the window — an absolute scale would leave the whole grid
 * dark for a casual reader and saturated for a heavy one.
 */
function Heatmap({ daily }: { daily: Record<string, number> }) {
  const theme = useTheme();

  const { columns, max } = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    // Start on the Monday of the earliest week so the rows line up as weekdays.
    const weekdayOffset = (today.getDay() + 6) % 7;
    const lastMonday = today.getTime() - weekdayOffset * DAY_MS;
    const start = lastMonday - (WEEKS - 1) * 7 * DAY_MS;

    const cells: { key: string; value: number; future: boolean }[][] = [];
    let peak = 0;
    for (let week = 0; week < WEEKS; week += 1) {
      const column: { key: string; value: number; future: boolean }[] = [];
      for (let day = 0; day < 7; day += 1) {
        const timestamp = start + (week * 7 + day) * DAY_MS;
        const key = dayKey(timestamp);
        const value = daily[key] ?? 0;
        peak = Math.max(peak, value);
        column.push({ key, value, future: timestamp > today.getTime() });
      }
      cells.push(column);
    }
    return { columns: cells, max: peak };
  }, [daily]);

  const cell = 9;
  const gap = 3;

  return (
    <Card style={{ padding: theme.space[4] }}>
      <T variant="label" tone="faint">
        {t('stats.activity')}
      </T>
      <T variant="small" tone="faint" style={{ marginTop: 2, marginBottom: theme.space[3] }}>
        {t('stats.activityHint')}
      </T>

      <View style={{ flexDirection: 'row', gap }}>
        {columns.map((week, weekIndex) => (
          <View key={weekIndex} style={{ gap }}>
            {week.map((day) => (
              <View
                key={day.key}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 2,
                  backgroundColor: day.future
                    ? 'transparent'
                    : intensityColor(day.value, max, theme.colors.surfaceHover, theme.accent.base),
                }}
              />
            ))}
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: gap,
          marginTop: theme.space[3],
        }}
      >
        <T variant="small" tone="faint">
          {t('stats.less')}
        </T>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => (
          <View
            key={step}
            style={{
              width: cell,
              height: cell,
              borderRadius: 2,
              backgroundColor: intensityColor(
                step,
                1,
                theme.colors.surfaceHover,
                theme.accent.base,
              ),
            }}
          />
        ))}
        <T variant="small" tone="faint">
          {t('stats.more')}
        </T>
      </View>
    </Card>
  );
}

/**
 * Blend the accent over the empty-cell colour.
 *
 * Opacity would let the page background show through and make a cell over a card read
 * differently from one over the page, so the two colours are mixed outright.
 */
function intensityColor(value: number, max: number, empty: string, accent: string): string {
  if (value <= 0) return empty;
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  // A day with any reading at all must be visibly non-empty, hence the floor.
  const weight = 0.28 + 0.72 * ratio;
  const from = parseHex(empty);
  const to = parseHex(accent);
  if (!from || !to) return accent;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * weight);
  return `rgb(${mix(from[0], to[0])}, ${mix(from[1], to[1])}, ${mix(from[2], to[2])})`;
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Today against the daily goal.
 *
 * Only rendered when a goal is set, because an empty bar every day would nag rather than
 * inform. The bar is a plain view rather than an animation: this screen is read, not
 * watched, and a moving bar on a statistics page is decoration.
 */
function GoalCard({ daily, goal }: { daily: Record<string, number>; goal: number }) {
  const theme = useTheme();
  const progress = goalProgress(daily, goal);

  return (
    <Card style={{ padding: theme.space[4], marginBottom: theme.space[3], gap: theme.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}>
        <View style={{ flex: 1 }}>
          <T variant="label" tone="faint">
            {t('stats.goal')}
          </T>
        </View>
        <T variant="small" tone={progress.met ? 'accent' : 'muted'}>
          {progress.met
            ? t('stats.goal.met')
            : t('stats.goal.remaining', { count: formatNumber(progress.remaining) })}
        </T>
      </View>

      <T variant="title">
        {t('stats.goal.progress', {
          read: formatNumber(progress.read),
          goal: formatNumber(progress.goal),
        })}
      </T>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: goal, now: progress.read }}
        style={{
          height: 8,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(progress.ratio * 100)}%`,
            height: '100%',
            backgroundColor: theme.accent.base,
          }}
        />
      </View>
    </Card>
  );
}
