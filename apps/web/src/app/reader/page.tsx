import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReaderApp } from '@/components/reader/reader-app';

export const metadata: Metadata = {
  title: 'Reader',
  description:
    'EPUB, PDF, Text oder Web-Artikel importieren und per RSVP lesen. Alles bleibt auf Ihrem Gerät.',
  alternates: { canonical: '/reader' },
  robots: { index: true, follow: true },
};

export default function ReaderPage() {
  return (
    // `useSearchParams` needs a boundary; the fallback matches the app's loading state
    // so the transition does not jump.
    <Suspense
      fallback={
        <p className="py-24 text-center text-[15px] text-[var(--lx-text-muted)]">Wird geladen…</p>
      }
    >
      <ReaderApp />
    </Suspense>
  );
}
