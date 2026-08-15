import * as React from 'react';
import { cn } from '../cn.js';

/* -------------------------------------------------------------------------- Slider */

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  /** Rendered to the right of the label, e.g. "480 WPM". */
  valueLabel?: React.ReactNode;
  onValueChange: (value: number) => void;
}

/**
 * Range input styled as a hairline track with an accent fill.
 * Native `<input type="range">` on purpose: it comes with keyboard support, screen
 * reader semantics and touch handling that a div reimplementation always gets wrong.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  label,
  valueLabel,
  onValueChange,
  className,
  id,
  ...props
}: SliderProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={inputId} className="text-[13px] font-medium text-[var(--lx-text-muted)]">
          {label}
        </label>
        {valueLabel !== undefined && (
          <span className="font-mono text-[13px] tabular-nums text-[var(--lx-text)]">
            {valueLabel}
          </span>
        )}
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        className="lx-slider h-6 w-full cursor-pointer appearance-none bg-transparent"
        style={{ ['--lx-slider-fill' as string]: `${percent}%` }}
        {...props}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
  id,
}: SwitchProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={inputId} className="text-[15px] text-[var(--lx-text)]">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-[13px] leading-snug text-[var(--lx-text-muted)]">
            {description}
          </p>
        )}
      </div>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-10 shrink-0 rounded-full border transition-colors duration-140',
          'outline-none focus-visible:ring-2 focus-visible:ring-[var(--lx-accent)]',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lx-bg)]',
          'disabled:pointer-events-none disabled:opacity-40',
          checked
            ? 'border-[var(--lx-accent)] bg-[var(--lx-accent)]'
            : 'border-[var(--lx-border-strong)] bg-[var(--lx-surface)]',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full transition-[left] duration-140',
            checked ? 'left-[18px] bg-[var(--lx-accent-on)]' : 'left-[2px] bg-[var(--lx-text-muted)]',
          )}
        />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- SegmentedControl */

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Optional accessible name when `label` is a swatch or icon. */
  title?: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Radio group rendered as a segmented control.
 * Arrow keys move between options, which is what users expect from a radiogroup and
 * what a row of buttons would not give them.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  label,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (direction === 0) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + direction + options.length) % options.length];
    if (next) onValueChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex gap-1 rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.title}
            title={option.title}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'rounded-[7px] font-medium transition-colors duration-140',
              'outline-none focus-visible:ring-2 focus-visible:ring-[var(--lx-accent)]',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
              selected
                ? 'bg-[var(--lx-surface-hover)] text-[var(--lx-text)]'
                : 'text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ Stepper */

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (value: number) => string;
  onValueChange: (value: number) => void;
  className?: string;
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  label,
  format,
  onValueChange,
  className,
}: StepperProps) {
  const clamp = (n: number) => Math.min(Math.max(n, min), max);
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <span className="text-[15px] text-[var(--lx-text)]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`${label} verringern`}
          disabled={value <= min}
          onClick={() => onValueChange(clamp(value - step))}
          className="h-8 w-8 rounded-[8px] border border-[var(--lx-border)] text-[var(--lx-text-muted)] transition-colors hover:text-[var(--lx-text)] disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-14 text-center font-mono text-[13px] tabular-nums text-[var(--lx-text)]">
          {format ? format(value) : value}
        </span>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          disabled={value >= max}
          onClick={() => onValueChange(clamp(value + step))}
          className="h-8 w-8 rounded-[8px] border border-[var(--lx-border)] text-[var(--lx-text-muted)] transition-colors hover:text-[var(--lx-text)] disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
