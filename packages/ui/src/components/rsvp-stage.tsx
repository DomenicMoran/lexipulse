import { splitAtOrp } from '@lexipulse/core';
import * as React from 'react';
import { cn } from '../cn.js';
import { computeStageGeometry, type StageGeometry } from '../player-geometry.js';

export interface RsvpWordProps {
  /** The token text. */
  text: string;
  /** Code-point index of the ORP character. Recomputed when omitted. */
  orp?: number;
  geometry: StageGeometry;
  /** Player font size in px. */
  fontSize: number;
  className?: string;
}

/**
 * One word, pinned by its ORP.
 *
 * The word is laid out left-aligned and then translated by
 * `(focusColumn - orp)` character widths. On a monospace face `ch` is exactly one
 * advance width, so the pivot lands on the focus column to the pixel — no measuring,
 * no layout thrash, no sub-pixel drift between frames.
 *
 * There is deliberately no transition on the transform: interpolating between two
 * positions is precisely the horizontal smear users describe as "flicker".
 */
export function RsvpWord({ text, orp, geometry, fontSize, className }: RsvpWordProps) {
  const parts = React.useMemo(() => splitAtOrp(text, orp), [text, orp]);
  const shift = geometry.focusColumn - parts.index;

  return (
    <div
      className={cn('relative w-full text-left', className)}
      style={{
        fontFamily: 'var(--lx-font-mono)',
        fontSize: `${fontSize}px`,
        lineHeight: 1.15,
      }}
    >
      <span
        className="inline-block whitespace-pre will-change-transform"
        style={{ transform: `translateX(${shift}ch)` }}
      >
        <span style={{ color: 'var(--lx-text)' }}>{parts.before}</span>
        <span style={{ color: 'var(--lx-accent)' }}>{parts.pivot}</span>
        <span style={{ color: 'var(--lx-text)' }}>{parts.after}</span>
      </span>
    </div>
  );
}

export interface RsvpStageProps {
  text: string;
  orp?: number;
  fontSize: number;
  /** Draw the two hairlines that mark the focus column. */
  showFocusGuides?: boolean;
  /** Longest word the stage must accommodate without reflowing. */
  maxWordLength?: number;
  className?: string;
  /** Rendered above the word — usually the previous words at low opacity. */
  contextBefore?: string;
  /** Rendered below the word. */
  contextAfter?: string;
}

/**
 * The full RSVP stage: focus rails, the word, and optional context lines.
 * Its width is fixed to the worst-case word length so nothing ever reflows mid-stream.
 */
export function RsvpStage({
  text,
  orp,
  fontSize,
  showFocusGuides = true,
  maxWordLength = 22,
  className,
  contextBefore,
  contextAfter,
}: RsvpStageProps) {
  const geometry = React.useMemo(
    () => computeStageGeometry({ maxWordLength }),
    [maxWordLength],
  );

  // Centre of the focus column, as a percentage of the stage width.
  const focusPercent = ((geometry.focusColumn + 0.5) / geometry.columns) * 100;

  return (
    <div
      className={cn('relative select-none', className)}
      style={{
        width: `${geometry.columns}ch`,
        fontFamily: 'var(--lx-font-mono)',
        fontSize: `${fontSize}px`,
      }}
      aria-live="off"
    >
      {showFocusGuides && (
        <>
          <span
            aria-hidden="true"
            className="absolute -translate-x-1/2 bg-[var(--lx-rail)]"
            style={{
              left: `${focusPercent}%`,
              top: `-${fontSize * 0.55}px`,
              width: '1px',
              height: `${fontSize * 0.34}px`,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute -translate-x-1/2 bg-[var(--lx-rail)]"
            style={{
              left: `${focusPercent}%`,
              bottom: `-${fontSize * 0.55}px`,
              width: '1px',
              height: `${fontSize * 0.34}px`,
            }}
          />
        </>
      )}

      {contextBefore !== undefined && (
        <div
          aria-hidden="true"
          className="absolute right-0 left-0 truncate text-center text-[var(--lx-text-faint)]"
          style={{ top: `-${fontSize * 1.6}px`, fontSize: `${Math.round(fontSize * 0.32)}px` }}
        >
          {contextBefore}
        </div>
      )}

      <RsvpWord text={text} orp={orp} geometry={geometry} fontSize={fontSize} />

      {contextAfter !== undefined && (
        <div
          aria-hidden="true"
          className="absolute right-0 left-0 truncate text-center text-[var(--lx-text-faint)]"
          style={{ bottom: `-${fontSize * 1.6}px`, fontSize: `${Math.round(fontSize * 0.32)}px` }}
        >
          {contextAfter}
        </div>
      )}
    </div>
  );
}
