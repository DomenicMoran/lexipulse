import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

// Read from disk at build time; there is nothing dynamic on this page.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum von LexiPulse nach § 5 TMG und § 18 Abs. 2 MStV.',
  alternates: { canonical: '/impressum' },
};

export default function ImpressumPage() {
  return <LegalPage slug="impressum" />;
}
