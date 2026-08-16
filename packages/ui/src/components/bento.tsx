import * as React from 'react';
import { cn } from '../cn.js';

/**
 * Bento grid.
 *
 * A 6-column grid on desktop that collapses to 2 columns on tablet and 1 on phone.
 * Cells declare how many columns and rows they claim; the grid does not try to be
 * clever about packing, because an unpredictable layout is worse than a plain one.
 */

export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Row height on desktop. Cells span multiples of it. */
  rowHeight?: number;
}

export function BentoGrid({ className, rowHeight = 180, style, ...props }: BentoGridProps) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6', className)}
      style={{ gridAutoRows: `minmax(${rowHeight}px, auto)`, ...style }}
      {...props}
    />
  );
}

export type BentoSpan = 1 | 2 | 3 | 4 | 5 | 6;

export interface BentoCellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Columns claimed on the `lg` breakpoint. */
  span?: BentoSpan;
  /** Rows claimed on the `lg` breakpoint. */
  rows?: 1 | 2 | 3;
  /** Highlights the cell with the accent tint. Use for at most one cell per grid. */
  featured?: boolean;
  interactive?: boolean;
}

const COL_SPAN: Record<BentoSpan, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6 sm:col-span-2',
};

const ROW_SPAN: Record<1 | 2 | 3, string> = {
  1: 'lg:row-span-1',
  2: 'lg:row-span-2',
  3: 'lg:row-span-3',
};

export function BentoCell({
  className,
  span = 2,
  rows = 1,
  featured = false,
  interactive = false,
  ...props
}: BentoCellProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[14px] border p-6',
        featured
          ? 'border-[var(--lx-accent)]/30 bg-[var(--lx-accent-soft)]'
          : 'border-[var(--lx-border)] bg-[var(--lx-surface)]',
        interactive &&
          'transition-colors duration-140 hover:border-[var(--lx-border-strong)] hover:bg-[var(--lx-surface-hover)]',
        COL_SPAN[span],
        ROW_SPAN[rows],
        className,
      )}
      {...props}
    />
  );
}

export interface BentoHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function BentoHeading({
  eyebrow,
  title,
  description,
  className,
  ...props
}: BentoHeadingProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      {eyebrow && (
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--lx-accent)]">
          {eyebrow}
        </span>
      )}
      <h3 className="text-[20px] font-semibold tracking-[-0.015em] text-[var(--lx-text)]">
        {title}
      </h3>
      {description && (
        <p className="text-[15px] leading-relaxed text-[var(--lx-text-muted)]">{description}</p>
      )}
    </div>
  );
}

/** Big number with a caption — the stat tile used in the dashboard bento. */
export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  caption: string;
  hint?: string;
}

export function StatTile({ value, caption, hint, className, ...props }: StatTileProps) {
  return (
    <div className={cn('flex flex-col justify-between gap-2', className)} {...props}>
      <span className="font-mono text-[39px] leading-none tracking-[-0.03em] text-[var(--lx-text)] tabular-nums">
        {value}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-[var(--lx-text-muted)]">{caption}</span>
        {/* `hint` carries real information, so it uses the muted tier, not a fainter one. */}
        {hint && <span className="text-[12px] text-[var(--lx-text-muted)] opacity-80">{hint}</span>}
      </div>
    </div>
  );
}
