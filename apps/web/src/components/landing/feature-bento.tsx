import { SPEED_PRESETS, THEME_LABELS } from '@lexipulse/core';
import { BentoCell, BentoGrid, BentoHeading, Kbd } from '@lexipulse/ui';
import * as React from 'react';

/**
 * The feature grid.
 *
 * Every cell describes something that is implemented — no roadmap items dressed up as
 * features, no numbers we cannot back up.
 */
export function FeatureBento() {
  return (
    <section id="funktionen" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:py-28">
      <div className="mb-12 max-w-[52ch]">
        <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
          Funktionen
        </p>
        <h2 className="text-[31px] font-semibold tracking-[-0.03em] sm:text-[39px]">
          Alles, was ein Reader haben muss.
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--lx-text-muted)]">
          Import, Suche, Markierungen, Lesehilfen, Bibliothek und Statistik gehören
          zusammen. Alles läuft im Browser, auch ohne Netz.
        </p>
      </div>

      <BentoGrid rowHeight={190}>
        <BentoCell span={3} rows={1}>
          <BentoHeading
            title="Suchen, markieren, wiederfinden"
            description="Volltextsuche über das ganze Dokument, umlauttolerant: „fur“ findet „für“. Markierungen in fünf Farben mit Notiz, eine Liste aller Stellen, ein Tippen springt hin. Ausgabe als Markdown, nach Kapiteln geordnet."
          />
          <div className="mt-auto flex items-end gap-1 pt-6">
            <span
              className="text-[34px] leading-none"
              style={{ fontFamily: 'var(--lx-font-mono-ui)' }}
            >
              <span className="text-[var(--lx-text-faint)]">Fi</span>
              <span className="text-[var(--lx-accent)]">x</span>
              <span className="text-[var(--lx-text-faint)]">ierung</span>
            </span>
          </div>
        </BentoCell>

        <BentoCell span={3} rows={1}>
          <BentoHeading
            title="Smart-Filter für PDFs"
            description="Kopf- und Fußzeilen, Seitenzahlen, Inhaltsverzeichnis-Punktlinien und Tabellenzeilen fliegen raus. Getrennte Wörter am Zeilenende werden wieder zusammengesetzt, harte Umbrüche zu Absätzen verbunden."
          />
          <p className="mt-auto pt-6 text-[13px] text-[var(--lx-text-muted)]">
            Nach dem Import sehen Sie, was entfernt wurde. Die Originalseite bleibt daneben
            unberührt.
          </p>
        </BentoCell>

        <BentoCell span={2} rows={1}>
          <BentoHeading
            title="Lesehilfen"
            description="Bionic-Hervorhebung, Leselineal, sechs Farbfilter und OpenDyslexic — mitgeliefert, nicht nachgeladen."
          />
          <p className="mt-auto pt-6 text-[13px] text-[var(--lx-text-muted)]">
            Jede Textfarbe in jedem Theme über 4,5:1 geprüft.
          </p>
        </BentoCell>

        <BentoCell span={2} rows={1}>
          <BentoHeading
            title="Pacing-Matrix"
            description="Jedes Wort bekommt seine eigene Anzeigedauer — nach Länge, Ziffern und Satzzeichen."
          />
          <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
            {SPEED_PRESETS.map((preset) => (
              <span
                key={preset.id}
                className="rounded-full border border-[var(--lx-border)] px-2.5 py-1 font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]"
              >
                {preset.label} {preset.wpm}
              </span>
            ))}
          </div>
        </BentoCell>

        <BentoCell span={2} rows={1}>
          <BentoHeading
            title="Vier Themes, drei Akzente"
            description="Von OLED-Schwarz bis Sepia. Die Akzentfarbe markiert den Erkennungspunkt."
          />
          <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
            {Object.values(THEME_LABELS).map((label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--lx-border)] px-2.5 py-1 text-[12px] text-[var(--lx-text-muted)]"
              >
                {label}
              </span>
            ))}
          </div>
        </BentoCell>

        <BentoCell span={2} rows={1}>
          <BentoHeading
            title="Bibliothek mit Schlagwörtern"
            description="Suchen, sortieren, filtern und auf Schlagwörter legen. Dokumente, Fortschritt, Lesezeichen und Markierungen liegen in der Datenbank Ihres Browsers."
          />
          <p className="mt-auto pt-6 text-[13px] text-[var(--lx-text-muted)]">
            Sichern und auf ein anderes Gerät übertragen — ohne Konto, ohne Server.
          </p>
        </BentoCell>

        <BentoCell span={2} rows={1}>
          <BentoHeading
            title="Formate"
            description="PDF, EPUB 2 und 3, FictionBook, TXT, Markdown und HTML per Datei oder Drag-and-drop. Dazu Text einfügen und Web-Artikel per Adresse, ohne Menüs und Bannerspalten."
          />
          <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
            {['EPUB', 'PDF', 'TXT', 'MD', 'HTML', 'URL'].map((format) => (
              <span
                key={format}
                className="rounded-full border border-[var(--lx-border)] px-2.5 py-1 font-mono text-[12px] text-[var(--lx-text-muted)]"
              >
                {format}
              </span>
            ))}
          </div>
        </BentoCell>

        <BentoCell span={2} rows={1}>
          <BentoHeading
            title="Statistik ohne Server"
            description="Gelesene Wörter, Lesezeit, Durchschnittstempo, Serie und eine Heatmap der letzten zwölf Wochen — berechnet auf Ihrem Gerät."
          />
        </BentoCell>

        <BentoCell span={2} rows={1}>
          <BentoHeading
            title="Vollständig per Tastatur"
            description="Abspielen, Springen, Tempo, Kapitel und Lesezeichen ohne Maus."
          />
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-6">
            <Kbd>Leer</Kbd>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <Kbd>[</Kbd>
            <Kbd>]</Kbd>
            <Kbd>B</Kbd>
            <Kbd>?</Kbd>
          </div>
        </BentoCell>
      </BentoGrid>
    </section>
  );
}
