import type { Metadata } from 'next';
import Link from 'next/link';
import * as React from 'react';
import { ArrowRightIcon } from '@/components/icons';
import { PdfToolkit } from '@/components/landing/pdf-toolkit';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'PDF bearbeiten, ausfüllen und unterschreiben — im Browser',
  description:
    'PDF öffnen, markieren, kommentieren, Formulare ausfüllen, unterschreiben, Seiten drehen und löschen. Alles im Browser, keine Datei wird hochgeladen.',
  alternates: { canonical: '/pdf' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: 'https://lexipulse.de/pdf',
    title: 'PDF bearbeiten, ausfüllen und unterschreiben — im Browser',
    description:
      'Markieren, kommentieren, ausfüllen, unterschreiben, Seiten ordnen. Ohne Upload, ohne Konto, offline nutzbar.',
  },
};

/**
 * The page for people who are not looking for a reader at all.
 *
 * Someone typing "PDF ausfüllen" into a search field has a task, not a product in mind,
 * and a landing page about reading speed answers the wrong question. This one answers
 * theirs, and mentions the word stream at the end as the thing they did not know they
 * were also getting.
 */

/**
 * `FAQPage` structured data, and every answer here is one the app can back up.
 *
 * Rich results are a claim in Google's name as much as in ours; an answer that overstates
 * what the app does is a claim we would have to defend twice.
 */
const FAQ: { question: string; answer: string }[] = [
  {
    question: 'Wird meine PDF beim Bearbeiten hochgeladen?',
    answer:
      'Nein. Die Datei wird im Browser geöffnet, bearbeitet und wieder gespeichert. Sie verlässt Ihr Gerät nicht, und nach dem ersten Aufruf funktioniert alles auch ohne Internetverbindung.',
  },
  {
    question: 'Kann ich ein PDF-Formular ausfüllen?',
    answer:
      'Ja. LexiPulse liest die Formularfelder der Datei aus — Textfelder, Kontrollkästchen, Auswahllisten und Mehrfachauswahl — und zeigt sie als Liste. Beim Speichern können Sie die Antworten festschreiben, sodass sie niemand mehr ändert.',
  },
  {
    question: 'Wie unterschreibe ich eine PDF?',
    answer:
      'Mit dem Unterschrift-Werkzeug zeichnen Sie Ihre Unterschrift, tippen Ihren Namen in einer Schreibschrift oder setzen ein Foto Ihrer Unterschrift ein; weißes Papier im Foto wird dabei transparent. Das Ergebnis ist ein Bild Ihrer Unterschrift, wie ein unterschriebener und eingescannter Ausdruck — keine qualifizierte elektronische Signatur nach eIDAS.',
  },
  {
    question: 'Kann ich Seiten löschen oder die Reihenfolge ändern?',
    answer:
      'Ja. Seiten lassen sich drehen, löschen und verschieben, und Sie können eine leere Seite, eine andere PDF oder ein Bild einfügen. Ihre Markierungen wandern mit den Seiten mit.',
  },
  {
    question: 'Wird geschwärzter Text wirklich entfernt?',
    answer:
      'Auf Wunsch ja. Beim Speichern können Sie wählen, ob die betroffenen Seiten als Bild neu geschrieben werden — dann ist der Text darunter weg, auch für Kopieren und Suchen. Ohne diese Einstellung wird er nur überdeckt und bleibt lesbar, wenn jemand ihn markiert und kopiert.',
  },
  {
    question: 'Öffnet LexiPulse auch geschützte PDFs?',
    answer:
      'Ja, wenn Sie das Kennwort haben. Es wird nur zum Öffnen verwendet, nirgends gespeichert und nirgends gesendet.',
  },
];

export default function PdfPage() {
  return (
    <>
      <SiteHeader />
      <main id="inhalt">
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-4 sm:pt-24">
          <div className="max-w-[58ch]">
            <p className="mb-4 font-mono text-[11px] tracking-[0.08em] text-[var(--lx-accent-text)] uppercase">
              PDF im Browser
            </p>
            <h1 className="text-[39px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[49px]">
              PDF bearbeiten, ohne sie aus der Hand zu geben.
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed text-[var(--lx-text-muted)] sm:text-[19px]">
              Die meisten PDF-Dienste im Netz laden Ihre Datei auf einen fremden Server. Bei
              einem Mietvertrag, einer Gehaltsabrechnung oder einem Arztbrief ist das genau
              das, was man nicht will. LexiPulse macht dieselbe Arbeit in Ihrem Browser: die
              Datei bleibt auf Ihrem Gerät, von der ersten Markierung bis zur fertigen Datei.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/reader"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[var(--lx-accent)] px-6 text-[16px] font-medium text-[var(--lx-accent-on)] transition-colors duration-140 hover:bg-[var(--lx-accent-strong)]"
              >
                PDF öffnen
                <ArrowRightIcon width={18} height={18} />
              </Link>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-6 text-[16px] transition-colors duration-140 hover:border-[var(--lx-border-strong)] hover:bg-[var(--lx-surface-hover)]"
              >
                Auch ein Reader
              </Link>
            </div>
          </div>
        </section>

        <PdfToolkit />

        <section className="mx-auto max-w-6xl px-5 pb-20 sm:pb-28">
          <h2 className="text-[25px] font-semibold tracking-[-0.02em] sm:text-[31px]">
            Häufige Fragen zu PDF
          </h2>
          <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.question}>
                <h3 className="text-[16px] font-medium text-[var(--lx-text)]">{item.question}</h3>
                <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-[var(--lx-text-muted)]">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--lx-border)]">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="max-w-[46ch] text-[25px] font-semibold tracking-[-0.02em] sm:text-[31px]">
              Und wenn der Stapel zu groß ist: derselbe Text Wort für Wort.
            </h2>
            <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-[var(--lx-text-muted)]">
              Dieselbe Datei lässt sich als Wortstrom lesen: ein Wort nach dem anderen an
              fester Stelle, mit dem Erkennungspunkt farbig markiert. Die Leseposition ist
              dieselbe wie auf der Seite — Sie springen hin und zurück, ohne Ihre Stelle zu
              verlieren.
            </p>
            <Link
              href="/#ansichten"
              className="mt-6 inline-flex h-11 items-center rounded-[10px] border border-[var(--lx-border)] px-5 text-[15px] transition-colors duration-140 hover:border-[var(--lx-border-strong)] hover:bg-[var(--lx-surface-hover)]"
            >
              Die drei Ansichten ansehen
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />

      {/*
        Structured data. The content is the constant above — no input from anywhere else
        reaches it — and `<` is escaped anyway, because a `</script>` inside a JSON string
        would end the tag early and turn the rest of the page into markup.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }).replace(/</g, '\\u003c'),
        }}
      />
    </>
  );
}
