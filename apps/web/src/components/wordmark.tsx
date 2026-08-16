import * as React from 'react';

/**
 * The wordmark: the product name in the player's monospace face, with the ORP dot
 * sitting over the letter the eye lands on. It is the same idea the app is built on,
 * so it does not need a separate logo.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontFamily: 'var(--lx-font-mono-ui)' }}
      aria-label="LexiPulse"
    >
      <span aria-hidden="true" className="text-[var(--lx-text)]">
        Le
      </span>
      <span aria-hidden="true" className="text-[var(--lx-accent)]">
        x
      </span>
      <span aria-hidden="true" className="text-[var(--lx-text)]">
        iPulse
      </span>
    </span>
  );
}
