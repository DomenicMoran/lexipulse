import Link from 'next/link';
import * as React from 'react';

/**
 * What LexiPulse does with a PDF beyond reading it.
 *
 * Written as a list of verbs, because that is what people type into a search field:
 * "PDF ausfüllen", "PDF unterschreiben", "Seiten löschen". Each line names something the
 * app actually does — the two limits at the bottom are there for the same reason.
 */

interface Group {
  title: string;
  items: string[];
}

export const TOOL_GROUPS: Group[] = [
  {
    title: 'Markieren und kommentieren',
    items: [
      'Text markieren, unterstreichen, durchstreichen — entlang der Zeile, nicht als Kasten',
      'Freihand zeichnen, Stärke und Farbe frei',
      'Rechteck, Ellipse, Linie und Pfeil',
      'Textfelder an jeder Stelle, in jeder Größe',
      'Notizzettel, die auch andere Programme anzeigen',
    ],
  },
  {
    title: 'Ausfüllen und unterschreiben',
    items: [
      'Formularfelder lesen und ausfüllen: Text, Haken, Auswahl, Mehrfachauswahl',
      'Antworten festschreiben, damit sie niemand mehr ändert',
      'Unterschrift zeichnen, tippen oder als Foto einsetzen',
      'Weißes Papier im Foto wird transparent, die Tinte bleibt',
      'Halb ausgefüllt zumachen und morgen weitermachen',
    ],
  },
  {
    title: 'Seiten und Dateien',
    items: [
      'Seiten drehen, löschen, verschieben',
      'Leere Seite, eine andere PDF oder ein Bild einfügen',
      'Geschütztes PDF mit Kennwort öffnen',
      'Gescannte PDFs ohne Textebene öffnen und bearbeiten',
      'Fotos werden zu einer PDF — abfotografieren, unterschreiben, zurückschicken',
      'Als neue Datei speichern oder das Original ersetzen',
      'Schwärzen, das den Text wirklich entfernt — nicht nur überdeckt',
    ],
  },
];

export function PdfToolkit() {
  return (
    <section id="pdf-werkzeuge" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:py-28">
      <div className="mb-12 max-w-[54ch]">
        <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
          PDF-Werkzeuge
        </p>
        <h2 className="text-[31px] font-semibold tracking-[-0.03em] sm:text-[39px]">
          Nicht nur lesen. Auch machen.
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--lx-text-muted)]">
          Alles läuft in Ihrem Browser. Keine Datei wird hochgeladen, kein Dienst schaut mit,
          und es funktioniert ohne Internetverbindung.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TOOL_GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-surface)] p-6"
          >
            <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{group.title}</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-[14px] leading-relaxed text-[var(--lx-text-muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[0.55em] block h-1 w-1 shrink-0 rounded-full bg-[var(--lx-accent)]"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 rounded-[14px] border border-[var(--lx-border)] p-6 md:grid-cols-2">
        <div>
          <h3 className="text-[15px] font-semibold">Was hier bewusst fehlt</h3>
          <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-[var(--lx-text-muted)]">
            Umwandlung nach Word und serverseitiges Verkleinern gibt es nicht: beides
            bedeutet, die Datei hochzuladen. Und die gezeichnete Unterschrift ist ein Bild
            Ihrer Unterschrift — wie ein unterschriebener, eingescannter Ausdruck. Eine
            qualifizierte elektronische Signatur nach eIDAS ist sie nicht, und wir nennen
            sie auch nicht so.
          </p>
        </div>
        <div className="flex items-end md:justify-end">
          <Link
            href="/reader"
            className="inline-flex h-11 items-center rounded-[10px] bg-[var(--lx-accent)] px-5 text-[15px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
          >
            PDF öffnen und ausprobieren
          </Link>
        </div>
      </div>
    </section>
  );
}
