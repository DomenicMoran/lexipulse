import * as React from 'react';
import { cn } from '../cn.js';

/* -------------------------------------------------------------------------- Button */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium ' +
  'transition-[background-color,border-color,color,opacity] duration-140 ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--lx-accent)] ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lx-bg)] ' +
  'disabled:pointer-events-none disabled:opacity-40 select-none';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--lx-accent)] text-[var(--lx-accent-on)] hover:bg-[var(--lx-accent-strong)] ' +
    'active:brightness-95',
  secondary:
    'bg-[var(--lx-surface)] text-[var(--lx-text)] border border-[var(--lx-border)] ' +
    'hover:bg-[var(--lx-surface-hover)] hover:border-[var(--lx-border-strong)]',
  ghost: 'text-[var(--lx-text-muted)] hover:text-[var(--lx-text)] hover:bg-[var(--lx-surface)]',
  // Theme-scoped: a red tuned for an OLED panel measures about 3:1 on paper.
  danger:
    'bg-transparent text-[var(--lx-danger)] border border-[var(--lx-border)] ' +
    'hover:bg-[var(--lx-danger-soft)] hover:border-[var(--lx-danger)]',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-12 px-6 text-[17px]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
});

/* ------------------------------------------------------------------------ IconButton */

export interface IconButtonProps extends ButtonProps {
  /** Required: an icon-only control is invisible to screen readers without it. */
  label: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, label, size = 'md', ...props }, ref) {
    const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
    return (
      <Button
        ref={ref}
        aria-label={label}
        title={label}
        size={size}
        className={cn('px-0', box, className)}
        {...props}
      />
    );
  },
);

/* ---------------------------------------------------------------------------- Card */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lifts the card on hover. Only for cards that are actually clickable. */
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)]',
        interactive &&
          'transition-colors duration-140 hover:border-[var(--lx-border-strong)] ' +
            'hover:bg-[var(--lx-surface-hover)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-[17px] font-semibold tracking-[-0.015em] text-[var(--lx-text)]', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-[15px] leading-relaxed text-[var(--lx-text-muted)]', className)} {...props} />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

/* --------------------------------------------------------------------------- Badge */

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent';
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ' +
          'tracking-[0.02em] whitespace-nowrap',
        tone === 'accent'
          ? 'bg-[var(--lx-accent-soft)] text-[var(--lx-accent)]'
          : 'border border-[var(--lx-border)] text-[var(--lx-text-muted)]',
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------------------- Kbd */

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border ' +
          'border-[var(--lx-border)] bg-[var(--lx-surface)] px-1.5 font-mono text-[11px] ' +
          'text-[var(--lx-text-muted)]',
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------------- Divider */

export function Divider({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-0 border-t border-[var(--lx-border)]', className)} {...props} />;
}

/* --------------------------------------------------------------------- ProgressBar */

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–1. */
  value: number;
  label?: string;
}

export function ProgressBar({ value, label, className, ...props }: ProgressBarProps) {
  const percent = Math.min(Math.max(value, 0), 1) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Fortschritt'}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-[var(--lx-border)]', className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-[var(--lx-accent)] transition-[width] duration-140 ease-linear"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
