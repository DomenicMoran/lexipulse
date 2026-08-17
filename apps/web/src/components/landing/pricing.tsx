import Link from 'next/link';
import * as React from 'react';
import { CheckIcon } from '@/components/icons';

const WEB_FEATURES = [
  'Alle Import-Formate: EPUB, FB2, PDF, TXT, Markdown, HTML, URL',
  'Kompletter Player mit Pacing-Matrix und Tastatursteuerung',
  'Bibliothek, Lesezeichen, Statistik, Datenexport',
  'Offline nutzbar, als App installierbar',
];

const APP_FEATURES = [
  'Alles aus der Web-App, nativ auf dem Gerät',
  'Lokale SQLite-Bibliothek statt Browser-Speicher',
  'Gesten: Tippen zum Starten, Wischen zum Zurückspringen',
  'Einmalzahlung, kein Abo, keine In-App-Käufe',
];

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[15px] leading-snug">
          <CheckIcon
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-[var(--lx-accent-text)]"
          />
          <span className="text-[var(--lx-text-muted)]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Pricing() {
  return (
    <section id="preis" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:py-28">
      <div className="mb-12 max-w-[52ch]">
        <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
          Preis
        </p>
        <h2 className="text-[31px] font-semibold tracking-[-0.03em] sm:text-[39px]">
          Einmal zahlen oder gar nicht.
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--lx-text-muted)]">
          Kein Abo, keine Werbung, keine Datenerhebung. Es gibt nichts, was wir über Sie
          verkaufen könnten — wir erheben nichts.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-7 sm:p-8">
          <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--lx-text-muted)] uppercase">
            Web-App
          </span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-[49px] leading-none tracking-[-0.03em]">0 €</span>
            <span className="text-[15px] text-[var(--lx-text-muted)]">dauerhaft</span>
          </div>
          <p className="mt-4 mb-7 max-w-[42ch] text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
            Läuft in jedem modernen Browser. Kein Konto, keine Anmeldung, kein Testzeitraum.
          </p>
          <FeatureList items={WEB_FEATURES} />
          <Link
            href="/reader"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-[10px] bg-[var(--lx-accent)] px-5 text-[15px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
          >
            Reader jetzt öffnen
          </Link>
        </div>

        <div className="flex flex-col rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-7 sm:p-8">
          <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--lx-text-muted)] uppercase">
            iOS und Android
          </span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-[49px] leading-none tracking-[-0.03em]">4,99 €</span>
            <span className="text-[15px] text-[var(--lx-text-muted)]">einmalig</span>
          </div>
          <p className="mt-4 mb-7 max-w-[42ch] text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
            Endpreis. Als Kleinunternehmer nach § 19 UStG weisen wir keine Umsatzsteuer aus.
          </p>
          <FeatureList items={APP_FEATURES} />

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            {/*
              Both apps are still in development. Linking a store button that leads
              nowhere would be a promise we cannot keep today, so the buttons say what
              they are and are disabled until the listings are actually live.
            */}
            <a
              href="#"
              aria-disabled="true"
              tabIndex={-1}
              className="pointer-events-none inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-[var(--lx-border)] px-5 text-[15px] text-[var(--lx-text-faint)]"
            >
              Bald im App Store
            </a>
            <a
              href="#"
              aria-disabled="true"
              tabIndex={-1}
              className="pointer-events-none inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-[var(--lx-border)] px-5 text-[15px] text-[var(--lx-text-faint)]"
            >
              Bald bei Google Play
            </a>
          </div>
          <p className="mt-3 text-[13px] text-[var(--lx-text-muted)]">
            Die Apps sind noch nicht veröffentlicht. Bis dahin nutzen Sie die Web-App.
          </p>
        </div>
      </div>
    </section>
  );
}
