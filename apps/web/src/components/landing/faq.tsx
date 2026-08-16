import * as React from 'react';
import { ChevronDownIcon } from '@/components/icons';

interface QuestionAnswer {
  question: string;
  answer: React.ReactNode;
}

const ITEMS: QuestionAnswer[] = [
  {
    question: 'Funktioniert LexiPulse offline?',
    answer: (
      <>
        Ja. Nach dem ersten Aufruf liegt die Web-App im Cache des Browsers und startet
        ohne Netzverbindung. Import von Dateien, Player, Bibliothek und Statistik laufen
        vollständig lokal. Die einzige Ausnahme ist der Import über eine Internetadresse:
        dafür muss die fremde Seite abgerufen werden.
      </>
    ),
  },
  {
    question: 'Werden meine Dokumente hochgeladen?',
    answer: (
      <>
        Nein. EPUB-, PDF-, Text- und Markdown-Dateien werden im Browser eingelesen und in
        der IndexedDB Ihres Geräts abgelegt. Sie verlassen das Gerät nicht. Beim Import
        über eine Adresse ruft unser Server die fremde Seite ab, gibt nur den Artikeltext
        zurück und speichert dabei weder die Adresse noch den Text.
      </>
    ),
  },
  {
    question: 'Welche Formate kann ich importieren?',
    answer: (
      <>
        EPUB, PDF, TXT, Markdown und HTML als Datei oder per Drag-and-drop. Dazu Text aus
        der Zwischenablage und Artikel über eine Internetadresse. PDFs ohne Textebene —
        also reine Scans — lassen sich nicht lesen; dafür brauchen Sie vorher eine
        Texterkennung.
      </>
    ),
  },
  {
    question: 'Ist RSVP für jeden geeignet?',
    answer: (
      <>
        Nein. RSVP nimmt Ihnen die Möglichkeit, im Satz zurückzuspringen, und genau das
        tun geübte Leserinnen und Leser bei schwierigen Stellen. Für Romane, Artikel und
        Berichte funktioniert es gut, für Fachtexte, Verträge, Lyrik oder Formeln eher
        nicht. Wenn beim Lesen Augenbelastung oder Kopfschmerzen auftreten, reduzieren Sie
        das Tempo oder machen Sie eine Pause. LexiPulse ist ein Anzeigewerkzeug, kein
        Medizinprodukt und keine Trainingsmethode.
      </>
    ),
  },
  {
    question: 'Was ist mit dem Datenschutz?',
    answer: (
      <>
        Es gibt kein Konto, kein Tracking, keine Analyse-Werkzeuge, keine Werbung und
        keine Werbe-Identifikatoren. Gesetzt werden nur die lokalen Speicher, die die App
        zum Funktionieren braucht — deshalb erscheint auch kein Cookie-Banner. Alle lokal
        gespeicherten Daten können Sie im Reader als JSON-Datei exportieren und wieder
        einspielen. Die Einzelheiten stehen in der Datenschutzerklärung.
      </>
    ),
  },
  {
    question: 'Warum kostet die App Geld, die Web-App aber nicht?',
    answer: (
      <>
        Die Web-App verursacht kaum laufende Kosten und ist damit die ehrlichste Art,
        LexiPulse auszuprobieren. Die mobilen Apps kosten 4,99 Euro einmalig — kein Abo,
        keine In-App-Käufe, keine Werbung. Das deckt Entwicklung und Pflege der beiden
        Store-Fassungen.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
        <div>
          <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
            FAQ
          </p>
          <h2 className="text-[31px] font-semibold tracking-[-0.03em] sm:text-[39px]">
            Häufige Fragen
          </h2>
          <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-[var(--lx-text-muted)]">
            Etwas offen geblieben? Schreiben Sie an{' '}
            <a
              href="mailto:info@menucloud-berlin.de"
              className="text-[var(--lx-accent-text)] underline underline-offset-[3px]"
            >
              info@menucloud-berlin.de
            </a>
            .
          </p>
        </div>

        {/*
          Native disclosure elements: keyboard operable, announced correctly by screen
          readers and usable before a single byte of JavaScript has run.
        */}
        <div className="flex flex-col">
          {ITEMS.map((item) => (
            <details
              key={item.question}
              className="group border-b border-[var(--lx-border)] first:border-t"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium text-[var(--lx-text)] marker:hidden [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDownIcon
                  className="shrink-0 text-[var(--lx-text-muted)] transition-transform duration-140 group-open:rotate-180"
                  width={18}
                  height={18}
                />
              </summary>
              <div className="max-w-[62ch] pb-6 text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
