import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'Diese Seite ist ohne Netzverbindung nicht verfügbar.',
  robots: { index: false, follow: false },
};

/** Served by the service worker when a navigation fails and nothing is cached. */
export default function OfflinePage() {
  return (
    <main
      id="inhalt"
      className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-5 text-center"
    >
      <Wordmark className="text-[17px] font-semibold" />
      <h1 className="text-[31px] font-semibold tracking-[-0.03em]">Gerade offline</h1>
      <p className="max-w-[46ch] text-[16px] leading-relaxed text-[var(--lx-text-muted)]">
        Diese Seite liegt noch nicht im Zwischenspeicher. Ihre bereits importierten
        Dokumente sind davon nicht betroffen — die Bibliothek und der Player funktionieren
        auch ohne Verbindung.
      </p>
      <Link
        href="/reader"
        className="inline-flex h-11 items-center rounded-[10px] bg-[var(--lx-accent)] px-5 text-[15px] font-medium text-[var(--lx-accent-on)]"
      >
        Zum Reader
      </Link>
    </main>
  );
}
