import type { Metadata } from 'next';
import Link from 'next/link';
import * as React from 'react';
import { ArrowRightIcon } from '@/components/icons';
import { Faq } from '@/components/landing/faq';
import { FeatureBento } from '@/components/landing/feature-bento';
import { HeroDemo } from '@/components/landing/hero-demo';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pricing } from '@/components/landing/pricing';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/*
 * "Quelltext einsehbar", not "Quelloffen". The repository is public and anyone can read
 * it or build it for themselves, but the licence is PolyForm Noncommercial — selling it
 * or shipping it to a store is not allowed. Calling that open source would be a claim
 * the licence does not back (UWG § 5).
 */
const TRUST = ['Kein Konto', 'Keine Datenerhebung', 'Offline nutzbar', 'Quelltext einsehbar'];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="inhalt">
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-8 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
            <div className="min-w-0">
              <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
                RSVP-Reader für EPUB, PDF und Web
              </p>
              <h1 className="text-[39px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[49px] lg:text-[61px]">
                Lesen, ohne dass die Augen springen.
              </h1>
              <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-[var(--lx-text-muted)] sm:text-[20px]">
                LexiPulse zeigt Ihren Text Wort für Wort an einer festen Position. Der
                farbige Buchstabe markiert den Punkt, an dem das Auge ein Wort erkennt —
                und dieser Punkt bleibt, wo er ist.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/reader"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[var(--lx-accent)] px-6 text-[16px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
                >
                  Reader öffnen
                  <ArrowRightIcon width={18} height={18} />
                </Link>
                <Link
                  href="#so-funktionierts"
                  className="inline-flex h-12 items-center justify-center rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-6 text-[16px] transition-colors duration-140 hover:border-[var(--lx-border-strong)] hover:bg-[var(--lx-surface-hover)]"
                >
                  So funktioniert es
                </Link>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {TRUST.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[14px] text-[var(--lx-text-muted)]"
                  >
                    <span
                      aria-hidden="true"
                      className="block h-1 w-1 rounded-full bg-[var(--lx-accent)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <HeroDemo />
          </div>
        </section>

        <FeatureBento />
        <HowItWorks />
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
