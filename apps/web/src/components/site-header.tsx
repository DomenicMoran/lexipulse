import Link from 'next/link';
import * as React from 'react';
import { Wordmark } from './wordmark';

const LINKS = [
  { href: '/#funktionen', label: 'Funktionen' },
  { href: '/#so-funktionierts', label: 'So funktioniert es' },
  { href: '/#preis', label: 'Preis' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--lx-border)] bg-[var(--lx-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-5">
        <Link
          href="/"
          className="rounded-[6px] text-[15px] font-semibold tracking-[-0.015em]"
        >
          <Wordmark />
        </Link>

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[6px] text-[14px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:text-[var(--lx-text)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/reader"
          className="inline-flex h-9 items-center rounded-[10px] bg-[var(--lx-accent)] px-4 text-[14px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
        >
          Reader öffnen
        </Link>
      </div>
    </header>
  );
}
