import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

// Read from disk at build time; there is nothing dynamic on this page.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Wie LexiPulse mit Daten umgeht: Dokumente bleiben auf dem Gerät, kein Tracking, kein Konto.',
  alternates: { canonical: '/datenschutz' },
};

export default function DatenschutzPage() {
  return <LegalPage slug="datenschutz" />;
}
