import * as React from 'react';

/**
 * The three surfaces, side by side.
 *
 * This section exists because the product was being read as a speed-reading toy. It is
 * three ways of looking at the same file, and the word stream is the third one — the
 * unusual one, not the whole product. Saying that first is the difference between "a
 * gimmick" and "a reader I could live in".
 */

interface Surface {
  name: string;
  claim: string;
  body: string;
  points: string[];
}

const SURFACES: Surface[] = [
  {
    name: 'Original',
    claim: 'Die Seite, wie sie gesetzt wurde',
    body: 'Abbildungen, Tabellen, Formeln und Formulare bleiben, wo sie hingehören. Zoom, Miniaturen, Gliederung, Volltextsuche und eine dunkle Darstellung fürs Lesen am Abend.',
    points: ['Markieren und kommentieren', 'Formulare ausfüllen', 'Unterschreiben', 'Seiten ordnen'],
  },
  {
    name: 'Seite',
    claim: 'Fließtext in Ihrer Schrift',
    body: 'Dasselbe Dokument ohne fremdes Layout: Schriftgröße, Zeilenabstand, Ränder und Blocksatz stellen Sie ein. Vier Schriften sind dabei, darunter OpenDyslexic.',
    points: ['Blättern oder scrollen', 'Auto-Scroll', 'Bionic-Hervorhebung', 'Leselineal und Farbfilter'],
  },
  {
    name: 'Wortstrom',
    claim: 'Ein Wort an fester Stelle',
    body: 'Wenn es schnell gehen muss: 100 bis 1200 Wörter pro Minute, jedes Wort am Erkennungspunkt fixiert. Das Auge springt nicht mehr — genau das kostet beim Lesen die meiste Zeit.',
    points: ['Dynamische Standzeiten', 'Warm-up nach jedem Start', 'Vorlesen im Takt', 'Zurück um zehn Wörter'],
  },
];

export function Surfaces() {
  return (
    <section
      id="ansichten"
      className="border-y border-[var(--lx-border)] bg-[var(--lx-surface)]/40"
    >
      <div className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:py-28">
        <div className="mb-12 max-w-[54ch]">
          <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
            Drei Ansichten
          </p>
          <h2 className="text-[31px] font-semibold tracking-[-0.03em] sm:text-[39px]">
            Ein Dokument, drei Arten es zu lesen.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--lx-text-muted)]">
            Die Leseposition ist in allen dreien dieselbe. Sie springen aus der Seite in den
            Wortstrom und zurück, ohne Ihre Stelle zu verlieren.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-3">
          {SURFACES.map((surface, index) => (
            <li
              key={surface.name}
              className="flex flex-col rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-bg)] p-6"
            >
              <span className="font-mono text-[12px] tabular-nums text-[var(--lx-text-faint)]">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.02em]">{surface.name}</h3>
              <p className="mt-1 text-[15px] text-[var(--lx-accent-text)]">{surface.claim}</p>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
                {surface.body}
              </p>
              <ul className="mt-5 flex flex-col gap-2 pt-1">
                {surface.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-center gap-2.5 text-[14px] text-[var(--lx-text-muted)]"
                  >
                    <span
                      aria-hidden="true"
                      className="block h-1 w-1 shrink-0 rounded-full bg-[var(--lx-accent)]"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
