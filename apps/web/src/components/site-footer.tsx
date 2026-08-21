import Link from 'next/link';
import * as React from 'react';
import { GithubIcon } from './icons';
import { Wordmark } from './wordmark';

const PRODUCT = [
  { href: '/reader', label: 'Reader' },
  { href: '/reader/library', label: 'Bibliothek' },
  { href: '/reader/stats', label: 'Statistik' },
];

const LEGAL = [
  { href: '/impressum', label: 'Impressum' },
  { href: '/datenschutz', label: 'Datenschutz' },
  { href: '/agb', label: 'Nutzungsbedingungen' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--lx-border)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Wordmark className="text-[15px] font-semibold" />
          <p className="max-w-[28ch] text-[14px] leading-relaxed text-[var(--lx-text-muted)]">
            RSVP-Reader für EPUB, PDF und Web-Artikel. Alles bleibt auf Ihrem Gerät.
          </p>
        </div>

        <nav aria-label="Produkt" className="flex flex-col gap-2">
          <h2 className="mb-1 text-[13px] font-medium text-[var(--lx-text)]">Produkt</h2>
          {PRODUCT.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="w-fit rounded-[6px] text-[14px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:text-[var(--lx-text)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Rechtliches" className="flex flex-col gap-2">
          <h2 className="mb-1 text-[13px] font-medium text-[var(--lx-text)]">Rechtliches</h2>
          {LEGAL.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="w-fit rounded-[6px] text-[14px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:text-[var(--lx-text)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2">
          <h2 className="mb-1 text-[13px] font-medium text-[var(--lx-text)]">Quellcode</h2>
          <a
            href="https://github.com/DomenicMoran/lexipulse"
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex w-fit items-center gap-2 rounded-[6px] text-[14px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:text-[var(--lx-text)]"
          >
            <GithubIcon />
            GitHub
          </a>
          <a
            href="mailto:lexipulse@domenicmoran.de"
            className="w-fit rounded-[6px] text-[14px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:text-[var(--lx-text)]"
          >
            lexipulse@domenicmoran.de
          </a>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-[var(--lx-border)] px-5 py-6 text-[13px] text-[var(--lx-text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>MenuCloud Berlin — Inhaber Domenic Moran, Heidelberger Str. 36, 12059 Berlin</span>
        <span>Kein Konto. Kein Tracking. Keine Cloud.</span>
      </div>
    </footer>
  );
}
