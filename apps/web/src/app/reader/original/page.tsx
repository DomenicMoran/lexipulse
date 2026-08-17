import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OriginalApp } from '@/components/pdf/original-app';

export const metadata: Metadata = {
  title: 'Original',
  description:
    'Die PDF-Seite so, wie sie gesetzt wurde: mit Abbildungen, Tabellen und Formularen. Alles im Browser, nichts wird hochgeladen.',
  alternates: { canonical: '/reader/original' },
  // A surface that only ever shows a document the visitor already has on their own
  // device. There is nothing here for a search engine to index.
  robots: { index: false, follow: false },
};

export default function OriginalPage() {
  return (
    <Suspense
      fallback={
        <p className="py-24 text-center text-[15px] text-[var(--lx-text-muted)]">Wird geladen…</p>
      }
    >
      <OriginalApp />
    </Suspense>
  );
}
