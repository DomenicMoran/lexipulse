import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

// Read from disk at build time; there is nothing dynamic on this page.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen',
  description: 'Bedingungen für die Nutzung der Web-App auf lexipulse.de und Hinweise zum Kauf der mobilen Apps.',
  alternates: { canonical: '/agb' },
};

export default function AgbPage() {
  return <LegalPage slug="agb" />;
}
