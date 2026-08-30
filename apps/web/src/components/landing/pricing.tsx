import Link from 'next/link';
import * as React from 'react';
import { CheckIcon } from '@/components/icons';

const WEB_FEATURES = [
  'Alle drei Ansichten: Original, Seite, Wortstrom',
  'PDF markieren, ausfüllen, unterschreiben, Seiten ordnen',
  'Alle Formate: PDF, EPUB, FB2, TXT, Markdown, HTML, URL',
  'Bibliothek, Suche, Lesehilfen, Statistik, Datenexport',
  'Offline nutzbar, als App installierbar',
];

const APP_FEATURES = [
  'Alles aus der Web-App, nativ auf dem Gerät',
  'Dateien direkt aus dem System öffnen, Teilen-Blatt inklusive',
  'Vorlesen mit den Stimmen des Betriebssystems',
  'Gesten und Haptik: Tippen zum Starten, Wischen zum Zurückspringen',
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
          Kein Abo, keine Werbung, keine Datenerhebung. Es gibt nichts, was wir über dich
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
            Jetzt im Browser öffnen
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
              Die beiden Läden geben eine App nie am selben Tag frei. Play führt
              de.lexipulse.app seit dem 17.08.2026 öffentlich (nachgemessen:
              play.google.com/store/apps/details?id=de.lexipulse.app antwortet mit
              200 und dem Listing "LexiPulse: PDF & E-Book", 4,99 €). Apple steht
              noch auf WAITING_FOR_REVIEW. Ein Knopf, der "Jetzt laden" verspricht
              und ins Leere führt, ist irreführende Werbung nach § 5 UWG — deshalb
              bleibt der Apple-Knopf ein Feld ohne Verweis, bis die echte Adresse
              feststeht.
            */}
            <a
              href="https://play.google.com/store/apps/details?id=de.lexipulse.app"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] bg-[var(--lx-accent)] px-5 text-[15px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
            >
              Bei Google Play
            </a>
            <a
              href="#"
              aria-disabled="true"
              tabIndex={-1}
              className="pointer-events-none inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-[var(--lx-border)] px-5 text-[15px] text-[var(--lx-text-faint)]"
            >
              Bald im App Store
            </a>
          </div>
          <p className="mt-3 text-[13px] text-[var(--lx-text-muted)]">
            Bei Google Play jetzt verfügbar. Im App Store prüft Apple noch; bis dahin
            nutzt du die Web-App.
          </p>
        </div>
      </div>
    </section>
  );
}
