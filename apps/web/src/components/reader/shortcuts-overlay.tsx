'use client';

import { IconButton, Kbd } from '@lexipulse/ui';
import * as React from 'react';
import { CloseIcon } from '@/components/icons';

interface Shortcut {
  keys: string[];
  action: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: ['Leertaste'], action: 'Abspielen / Pause' },
  { keys: ['Klick auf die Bühne'], action: 'Abspielen / Pause' },
  { keys: ['←'], action: '10 Wörter zurück' },
  { keys: ['→'], action: '10 Wörter vor' },
  { keys: ['Shift', '←'], action: 'Ein Satz zurück' },
  { keys: ['Shift', '→'], action: 'Ein Satz vor' },
  { keys: ['↑'], action: 'Tempo +10 WPM' },
  { keys: ['↓'], action: 'Tempo −10 WPM' },
  { keys: ['['], action: 'Vorheriges Kapitel' },
  { keys: [']'], action: 'Nächstes Kapitel' },
  { keys: ['B'], action: 'Lesezeichen an dieser Stelle' },
  { keys: ['?'], action: 'Diese Übersicht' },
  { keys: ['Esc'], action: 'Overlay oder Einstellungen schließen' },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--lx-overlay)] p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lx-shortcuts-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-[14px] border border-[var(--lx-border-strong)] bg-[var(--lx-surface)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.36)] outline-none"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="lx-shortcuts-title" className="text-[20px] font-semibold tracking-[-0.015em]">
              Tastatursteuerung
            </h2>
            <p className="mt-1 text-[14px] text-[var(--lx-text-muted)]">
              Der Reader lässt sich vollständig ohne Maus bedienen.
            </p>
          </div>
          <IconButton label="Schließen" variant="ghost" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        <dl className="flex flex-col">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.action + shortcut.keys.join('+')}
              className="flex items-center justify-between gap-6 border-b border-[var(--lx-border)] py-2.5 last:border-b-0"
            >
              <dt className="text-[14px] text-[var(--lx-text-muted)]">{shortcut.action}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key, position) => (
                  <React.Fragment key={key}>
                    {position > 0 && (
                      <span className="text-[12px] text-[var(--lx-text-muted)]">+</span>
                    )}
                    <Kbd className="px-2">{key}</Kbd>
                  </React.Fragment>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
