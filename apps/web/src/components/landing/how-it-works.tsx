import { DEFAULT_PACING, splitAtOrp } from '@lexipulse/core';
import * as React from 'react';

const MULTIPLIER = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EXAMPLES = ['Lesen', 'Fixierung', 'Aufmerksamkeit'];

const PACING_ROWS: { rule: string; value: string; effect: string }[] = [
  {
    rule: 'Grundtakt',
    value: '60 000 ÷ WPM',
    effect: 'Ausgangsdauer für jedes Wort',
  },
  {
    rule: `Langes Wort (über ${DEFAULT_PACING.longWordThreshold} Zeichen)`,
    value: `× ${MULTIPLIER.format(DEFAULT_PACING.longWord)}`,
    effect: 'mehr Zeit zum Zerlegen',
  },
  {
    rule: 'Kurzes Wort (bis 3 Zeichen)',
    value: `× ${MULTIPLIER.format(DEFAULT_PACING.shortWord)}`,
    effect: 'Artikel und Präpositionen laufen schneller',
  },
  {
    rule: 'Wort mit Ziffer',
    value: `× ${MULTIPLIER.format(DEFAULT_PACING.numeric)}`,
    effect: 'Zahlen liest niemand im Takt von Wörtern',
  },
  {
    rule: 'Teilsatz-Ende (, ; : —)',
    value: `× ${MULTIPLIER.format(DEFAULT_PACING.clauseEnd)}`,
    effect: 'Atempause innerhalb des Satzes',
  },
  {
    rule: 'Satzende (. ! ? …)',
    value: `× ${MULTIPLIER.format(DEFAULT_PACING.sentenceEnd)}`,
    effect: 'Zeit, den Satz abzuschließen',
  },
  {
    rule: 'Absatzende',
    value: `× ${MULTIPLIER.format(DEFAULT_PACING.paragraphEnd)}`,
    effect: 'deutlicher Einschnitt vor dem nächsten Gedanken',
  },
  {
    rule: 'Grenzen',
    value: `${DEFAULT_PACING.minDurationMs}–${DEFAULT_PACING.maxDurationMs} ms`,
    effect: 'kein Wort blitzt, keines blockiert den Strom',
  },
];

function OrpExample({ word }: { word: string }) {
  const parts = splitAtOrp(word);
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        aria-hidden="true"
        className="block h-3 w-px bg-[var(--lx-rail)]"
        style={{ marginLeft: `${(parts.index + 0.5 - Array.from(word).length / 2) * 0.6}em` }}
      />
      <span
        className="text-[28px] leading-none whitespace-pre sm:text-[34px]"
        style={{ fontFamily: 'var(--lx-font-mono-ui)' }}
      >
        <span className="text-[var(--lx-text)]">{parts.before}</span>
        <span className="text-[var(--lx-accent)]">{parts.pivot}</span>
        <span className="text-[var(--lx-text)]">{parts.after}</span>
      </span>
      <span
        aria-hidden="true"
        className="block h-3 w-px bg-[var(--lx-rail)]"
        style={{ marginLeft: `${(parts.index + 0.5 - Array.from(word).length / 2) * 0.6}em` }}
      />
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="so-funktionierts" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:py-28">
      <div className="mb-12 max-w-[52ch]">
        <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
          So funktioniert es
        </p>
        <h2 className="text-[31px] font-semibold tracking-[-0.03em] sm:text-[39px]">
          Zwei Mechanismen, mehr nicht.
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--lx-text-muted)]">
          Ein fester Fixierpunkt, damit das Auge stillsteht. Und eine Zeitverteilung, die
          sich am Satzbau orientiert statt an einem Metronom.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-6 sm:p-8">
          <h3 className="text-[20px] font-semibold tracking-[-0.015em]">
            Der Erkennungspunkt
          </h3>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
            In jedem Wort gibt es eine Stelle, an der das Auge es am schnellsten
            identifiziert — bei kurzen Wörtern der erste, bei längeren der zweite bis
            fünfte Buchstabe. LexiPulse färbt diesen Buchstaben und schiebt jedes Wort so,
            dass er immer auf derselben Spalte liegt.
          </p>

          <div className="mt-8 flex flex-col items-center gap-7 rounded-[10px] bg-[var(--lx-stage)] py-8">
            {EXAMPLES.map((word) => (
              <OrpExample key={word} word={word} />
            ))}
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
            Die Markierung wandert im Wort, nicht auf dem Bildschirm. Deshalb muss das Auge
            zwischen zwei Wörtern nicht mehr springen.
          </p>
        </div>

        <div className="min-w-0 rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-6 sm:p-8">
          <h3 className="text-[20px] font-semibold tracking-[-0.015em]">Die Pacing-Matrix</h3>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
            Gleich lange Anzeigezeiten für jedes Wort sind der Grund, warum die meisten
            RSVP-Werkzeuge nach zwei Absätzen unlesbar werden. LexiPulse rechnet jedem
            Wort seine eigene Dauer aus. Die Faktoren multiplizieren sich.
          </p>

          {/* Grid children default to min-width:auto, so without min-w-0 the table's
              min-width would push the whole page sideways instead of scrolling here. */}
          <div className="mt-6 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[14px]">
              <caption className="sr-only">
                Faktoren der Pacing-Matrix in der Standardeinstellung
              </caption>
              <thead>
                <tr className="border-b border-[var(--lx-border)]">
                  <th scope="col" className="py-2 pr-4 text-left font-medium text-[var(--lx-text-muted)]">
                    Regel
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium text-[var(--lx-text-muted)]">
                    Faktor
                  </th>
                  <th scope="col" className="py-2 text-left font-medium text-[var(--lx-text-muted)]">
                    Wirkung
                  </th>
                </tr>
              </thead>
              <tbody>
                {PACING_ROWS.map((row) => (
                  <tr key={row.rule} className="border-b border-[var(--lx-border)]">
                    <td className="py-2.5 pr-4 align-top text-[var(--lx-text)]">{row.rule}</td>
                    <td className="py-2.5 pr-4 text-right align-top font-mono tabular-nums whitespace-nowrap text-[var(--lx-text)]">
                      {row.value}
                    </td>
                    <td className="py-2.5 align-top text-[var(--lx-text-muted)]">{row.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
            Weil die Pausen mitzählen, liegt das tatsächliche Tempo immer unter dem
            eingestellten. Der Reader zeigt beide Werte an.
          </p>
        </div>
      </div>
    </section>
  );
}
