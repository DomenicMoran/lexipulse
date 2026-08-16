import type { Metadata } from 'next';
import { LibraryView } from '@/components/reader/library-view';

export const metadata: Metadata = {
  title: 'Bibliothek',
  description: 'Ihre importierten Dokumente mit Fortschritt, Restzeit und Datenexport.',
  alternates: { canonical: '/reader/library' },
};

export default function LibraryPage() {
  return <LibraryView />;
}
