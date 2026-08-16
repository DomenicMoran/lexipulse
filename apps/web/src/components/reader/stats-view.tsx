'use client';

import { dayKey, type ReadingStats } from '@lexipulse/core';
import { BentoCell, BentoGrid, StatTile } from '@lexipulse/ui';
import * as React from 'react';
import { ReaderNav } from '@/components/reader/reader-nav';
import { formatMinutes, formatNumber } from '@/lib/format';
import { getStore } from '@/lib/store';

const WEEKS = 12;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface HeatCell {
  key: string;
  date: Date;
  count: number;
}

/**
 * Twelve calendar weeks ending with the current one, Monday first.
 *
 * Built from the local day keys the store already writes, so the grid and the streak
 * counter can never disagree about what "today" means.
 */
function buildHeatmap(daily: Record<string, number>, now = Date.now()): HeatCell[][] {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const isoWeekday = (today.getDay() + 6) % 7; // 0 = Monday
  const lastMonday = today.getTime() - isoWeekday * DAY_MS;
  const firstMonday = lastMonday - (WEEKS - 1) * 7 * DAY_MS;

  const weeks: HeatCell[][] = [];
  for (let week = 0; week < WEEKS; week += 1) {
    const column: HeatCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const timestamp = firstMonday + (week * 7 + day) * DAY_MS;
      const key = dayKey(timestamp);
      column.push({ key, date: new Date(timestamp), count: daily[key] ?? 0 });
    }
    weeks.push(column);
  }
  return weeks;
}

function level(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio > 0.66) return 4;
  if (ratio > 0.33) return 3;
  return 2;
}

const LEVEL_STYLE = [
  'bg-[var(--lx-surface-hover)]',
  'bg-[var(--lx-accent)]/25',
  'bg-[var(--lx-accent)]/45',
  'bg-[var(--lx-accent)]/70',
  'bg-[var(--lx-accent)]',
];

const DATE_LABEL = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long' });

export function StatsView() {
  const [stats, setStats] = React.useState<ReadingStats | null>(null);

  React.useEffect(() => {
    void getStore()
      .then((store) => store.getStats())
      .then(setStats)
      .catch(() => undefined);
  }, []);

  const weeks = React.useMemo(() => buildHeatmap(stats?.daily ?? {}), [stats]);
  const max = React.useMemo(
    () => weeks.flat().reduce((peak, cell) => Math.max(peak, cell.count), 0),
    [weeks],
  );
  const activeDays = React.useMemo(
    () => weeks.flat().filter((cell) => cell.count > 0).length,
    [weeks],
  );

  return (
    <>
      <ReaderNav />
      <main id="inhalt" data-lexipulse-screen="06-stats" className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-12">
        <h1 className="text-[31px] font-semibold tracking-[-0.03em]">Statistik</h1>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
          Berechnet aus den Sitzungen auf diesem Gerät. Nichts davon wird übertragen oder
          ausgewertet.
        </p>

        <BentoGrid className="mt-8" rowHeight={150}>
          <BentoCell span={2}>
            <StatTile
              value={formatNumber(stats?.totalTokensRead ?? 0)}
              caption="Gelesene Wörter seit dem ersten Import"
            />
          </BentoCell>
          <BentoCell span={2}>
            <StatTile
              value={formatMinutes(stats?.totalMsRead ?? 0)}
              caption="Lesezeit, reine Wiedergabe"
            />
          </BentoCell>
          <BentoCell span={2}>
            <StatTile
              value={formatNumber(stats?.averageWpm ?? 0)}
              caption="Effektive Wörter pro Minute"
            />
          </BentoCell>

          <BentoCell span={2}>
            <StatTile
              value={`${formatNumber(stats?.streakDays ?? 0)}`}
              caption={
                stats?.streakDays === 1
                  ? 'Tag in Folge gelesen'
                  : 'Tage in Folge gelesen'
              }
            />
          </BentoCell>
          <BentoCell span={2}>
            <StatTile
              value={formatNumber(stats?.documentsStarted ?? 0)}
              caption="Dokumente begonnen"
            />
          </BentoCell>
          <BentoCell span={2}>
            <StatTile
              value={formatNumber(stats?.documentsFinished ?? 0)}
              caption="Dokumente beendet"
            />
          </BentoCell>

          <BentoCell span={6} rows={2}>
            <h2 className="text-[17px] font-semibold tracking-[-0.015em]">
              Aktivität der letzten zwölf Wochen
            </h2>
            <p className="mt-1 text-[13px] text-[var(--lx-text-muted)]">
              {activeDays === 0
                ? 'Noch keine Lesetage erfasst.'
                : `${formatNumber(activeDays)} ${activeDays === 1 ? 'Lesetag' : 'Lesetage'}, Spitzenwert ${formatNumber(max)} Wörter an einem Tag.`}
            </p>

            <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
              <div
                aria-hidden="true"
                className="flex shrink-0 flex-col justify-between py-[1px] text-[10px] text-[var(--lx-text-muted)]"
              >
                {WEEKDAYS.map((day, position) => (
                  <span key={day} className="h-3 leading-3">
                    {position % 2 === 1 ? day : ''}
                  </span>
                ))}
              </div>

              <div className="flex gap-1" aria-hidden="true">
                {weeks.map((column) => (
                  <div key={column[0]?.key} className="flex flex-col gap-1">
                    {column.map((cell) => (
                      <span
                        key={cell.key}
                        title={`${DATE_LABEL.format(cell.date)}: ${formatNumber(cell.count)} Wörter`}
                        className={`block h-3 w-3 rounded-[3px] ${LEVEL_STYLE[level(cell.count, max)]}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <p className="sr-only">
              {activeDays === 0
                ? 'In den letzten zwölf Wochen wurde an keinem Tag gelesen.'
                : `In den letzten zwölf Wochen wurde an ${activeDays} ${activeDays === 1 ? 'Tag' : 'Tagen'} gelesen. Der höchste Tageswert liegt bei ${max} Wörtern.`}
            </p>

            <div className="mt-auto flex items-center gap-2 pt-6 text-[12px] text-[var(--lx-text-muted)]">
              <span>weniger</span>
              {LEVEL_STYLE.map((style, position) => (
                <span
                  key={style}
                  aria-hidden="true"
                  className={`block h-3 w-3 rounded-[3px] ${LEVEL_STYLE[position]}`}
                />
              ))}
              <span>mehr</span>
            </div>
          </BentoCell>
        </BentoGrid>
      </main>
    </>
  );
}
